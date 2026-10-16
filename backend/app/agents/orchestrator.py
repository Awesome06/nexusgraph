"""LangGraph Orchestrator coordinating Recon, Historian, and Executor agents.

Uses FalkorDB per-session blackboard for inter-agent communication and state isolation.
Streams real-time step events via Server-Sent Events (SSE).
"""

import asyncio
import logging
import operator
from typing import Annotated, Any, AsyncGenerator, Dict, List, Optional, TypedDict
from app.db.falkor_client import get_falkor_manager, FalkorManager
from app.agents.recon_agent import run_recon_agent
from app.agents.historian_agent import run_historian_agent
from app.agents.executor_agent import run_executor_agent
from app.models.payloads import AgentStepEvent, ScenarioInfo

logger = logging.getLogger("nexusgraph.orchestrator")

# Pre-built scenarios for 1-Click Judge evaluation
DEMO_SCENARIOS: List[ScenarioInfo] = [
    ScenarioInfo(
        id="scenario-latency-cascade",
        title="1. Cascading Timeout & Breaking Commit Isolation",
        description="Simulates a 504 gateway spike. Swarm traverses 4 hops to isolate commit 8f92a1c violating ADR-002 and rolls it back.",
        trigger_type="ALERT",
        suggested_query="Investigate API Gateway Latency Spike and isolate breaking change",
        track_focus=["Track 01 (Connected Data)", "Track 02 (Agent Coordination)", "Track 03 (Company Brain)"]
    ),
    ScenarioInfo(
        id="scenario-bus-factor-audit",
        title="2. Bus Factor & ADR Governance Audit",
        description="Analyzes single-point-of-failure microservices and detects engineers with Bus Factor = 1 (fraud-scorer).",
        trigger_type="QUERY",
        suggested_query="Audit organizational bus factor and check active ADR compliance",
        track_focus=["Track 01 (Centrality)", "Track 03 (Company Brain)"]
    ),
    ScenarioInfo(
        id="scenario-memory-recall",
        title="3. Cross-Session Procedural Memory Recall",
        description="Recalls prior incident INC-2025-104 from procedural_memory to verify runbook confidence before executing fixes.",
        trigger_type="MEMORY",
        suggested_query="Query procedural memory for cascading timeout remediation runbooks",
        track_focus=["Track 02 (Agent Memory)"]
    )
]


class SwarmState(TypedDict):
    session_id: str
    query: str
    target_service: str
    recon_data: Optional[Dict[str, Any]]
    historian_data: Optional[Dict[str, Any]]
    executor_data: Optional[Dict[str, Any]]
    events: Annotated[List[AgentStepEvent], operator.add]


def build_langgraph_pipeline():
    """Builds the LangGraph StateGraph pipeline if langgraph is available."""
    try:
        from langgraph.graph import StateGraph, END

        def recon_node(state: SwarmState) -> Dict[str, Any]:
            res = run_recon_agent(
                session_id=state["session_id"],
                query=state["query"],
                target_service=state["target_service"]
            )
            return {"recon_data": res, "events": res["events"]}

        def historian_node(state: SwarmState) -> Dict[str, Any]:
            res = run_historian_agent(
                session_id=state["session_id"],
                target_service=state["target_service"]
            )
            return {"historian_data": res, "events": res["events"]}

        def executor_node(state: SwarmState) -> Dict[str, Any]:
            res = run_executor_agent(
                session_id=state["session_id"],
                target_service=state["target_service"],
                historian_data=state.get("historian_data")
            )
            return {"executor_data": res, "events": res["events"]}

        workflow = StateGraph(SwarmState)
        workflow.add_node("recon", recon_node)
        workflow.add_node("historian", historian_node)
        workflow.add_node("executor", executor_node)

        workflow.set_entry_point("recon")
        workflow.add_edge("recon", "historian")
        workflow.add_edge("historian", "executor")
        workflow.add_edge("executor", END)

        return workflow.compile()
    except Exception as exc:
        logger.warning("Native LangGraph compilation fallback: %s", exc)
        return None


# Compiled LangGraph pipeline
langgraph_app = build_langgraph_pipeline()


async def stream_swarm_investigation(
    session_id: str,
    query: str,
    target_service: str = "payment-engine",
    manager: Optional[FalkorManager] = None
) -> AsyncGenerator[AgentStepEvent, None]:
    """Async generator streaming each step event through the 3-agent FalkorDB swarm."""
    manager = manager or get_falkor_manager()

    # Determine service from query if target not specified
    q_lower = query.lower()
    if "gateway" in q_lower or "api-gateway" in q_lower:
        target_service = "payment-engine"  # Root source of gateway cascade
    elif "fraud" in q_lower or "fraud-scorer" in q_lower:
        target_service = "fraud-scorer"
    elif "ledger" in q_lower or "ledger-db" in q_lower:
        target_service = "ledger-db"

    # Stage 1: Recon Agent
    recon_result = run_recon_agent(
        session_id=session_id,
        query=query,
        target_service=target_service,
        manager=manager
    )
    for event in recon_result["events"]:
        yield event
        await asyncio.sleep(0.4)

    # Stage 2: Historian Agent
    historian_result = run_historian_agent(
        session_id=session_id,
        target_service=target_service,
        manager=manager
    )
    for event in historian_result["events"]:
        yield event
        await asyncio.sleep(0.4)

    # Stage 3: Executor Agent
    executor_result = run_executor_agent(
        session_id=session_id,
        target_service=target_service,
        historian_data=historian_result,
        manager=manager
    )
    for event in executor_result["events"]:
        yield event
        await asyncio.sleep(0.3)


def run_swarm_pipeline(
    session_id: str,
    query: str,
    target_service: str = "payment-engine",
    manager: Optional[FalkorManager] = None
) -> Dict[str, Any]:
    """Synchronous execution of the multi-agent pipeline."""
    manager = manager or get_falkor_manager()
    all_events: List[AgentStepEvent] = []

    recon = run_recon_agent(session_id, query, target_service, manager)
    all_events.extend(recon["events"])

    hist = run_historian_agent(session_id, target_service, manager)
    all_events.extend(hist["events"])

    exec_res = run_executor_agent(session_id, target_service, hist, manager)
    all_events.extend(exec_res["events"])

    return {
        "session_id": session_id,
        "query": query,
        "target_service": target_service,
        "recon": recon,
        "historian": hist,
        "executor": exec_res,
        "events": all_events,
        "final_explanation": exec_res["final_explanation"]
    }
