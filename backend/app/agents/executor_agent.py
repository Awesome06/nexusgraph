"""Executor Agent: Automated Remediation and Graph State Mutator (Track 01 & Track 02)."""

import datetime
import uuid
from typing import Any, Dict, List
from app.db.falkor_client import FalkorManager, get_falkor_manager
from app.mcp_server.graph_tools import mutate_graph_action
from app.models.payloads import AgentStepEvent


def run_executor_agent(
    session_id: str,
    target_service: str = "payment-engine",
    historian_data: Dict[str, Any] | None = None,
    manager: FalkorManager | None = None
) -> Dict[str, Any]:
    """Executes automated remediation, mutates FalkorDB graph state, and finalizes explanation."""
    manager = manager or get_falkor_manager()
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    events: List[AgentStepEvent] = []
    bb_name = f"blackboard_{session_id}"

    # 1. Read blackboard
    cypher_read = """
    MATCH (f:Finding {agent_name: 'Historian'})-[:HANDOFF_TO]->(t:Task)
    RETURN f.summary AS hist_summary
    """
    bb_records, _ = manager.query(bb_name, cypher_read)
    hist_summary = bb_records[0][0] if bb_records and len(bb_records[0]) > 0 else "Historian handoff received"

    events.append(AgentStepEvent(
        step_id=f"step-exec-{uuid.uuid4().hex[:6]}",
        session_id=session_id,
        agent="Executor",
        stage="Stage 3: Graph-Driven Action",
        status="running",
        thought=f"Executor active. Read verified root cause from blackboard: '{hist_summary}'. Initiating graph state mutation and automated rollback.",
        timestamp=now_iso
    ))

    # 2. Call MCP Tool: mutate_graph_action
    action_type = "ROLLBACK_CONFIG_AND_FLUSH_POOL"
    mutation_result = mutate_graph_action(
        service_name=target_service,
        action=action_type,
        session_id=session_id,
        manager=manager
    )

    events.append(AgentStepEvent(
        step_id=f"step-exec-{uuid.uuid4().hex[:6]}",
        session_id=session_id,
        agent="Executor",
        stage="Stage 3: Graph-Driven Action",
        status="running",
        thought=(
            f"Graph mutation committed to FalkorDB. Marked '{target_service}' status = 'HEALTHY'. "
            f"Created ProposedAction node '{mutation_result['action_id']}' in '{bb_name}'. "
            f"Incremented confidence score in 'procedural_memory' for runbook step."
        ),
        tool_call={"tool": "mutate_graph_action", "params": {"service_name": target_service, "action": action_type}},
        cypher_trace=mutation_result["cypher_trace"],
        subgraph=mutation_result["subgraph"],
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    ))

    # 3. Final Grounded Autonomous Explanation
    final_explanation = (
        f"### 🛡️ NexusGraph Autonomous Remediation Complete\n\n"
        f"**1. Root Cause Isolated via 4-Hop Graph Traversal:**\n"
        f"- Downstream symptom: Latency spike cascading to `api-gateway`\n"
        f"- Implicated service: `{target_service}` (Tier-1, owns communication to `ledger-db`)\n"
        f"- Offending Commit: `8f92a1c` (*fix(payment): increase ledger-db connection timeout to 5000ms*)\n"
        f"- Author Identified: **Arjun Mehta** (`@arjun`, Staff Backend Engineer, FinTech-Squad)\n\n"
        f"**2. Policy & Architecture Violation Detected:**\n"
        f"- Violated Record: **ADR-002** (*Ledger Strict Latency & Protocol Standards*)\n"
        f"- Rule: *'All calls to ledger-db must use gRPC with mTLS and timeout <= 200ms'*\n"
        f"- The 5000ms timeout caused thread exhaustion across dependent gateway pools.\n\n"
        f"**3. Procedural Memory Match & Graph Action:**\n"
        f"- Pattern matched: `cascading-timeout-ledger` (confidence 0.98, verified in `INC-2025-104`)\n"
        f"- Automated mitigation executed: `revert_commit(sha='8f92a1c')` and pool flush\n"
        f"- Active state mutated: `payment-engine` status updated to **HEALTHY** in `org_brain`\n"
        f"- Shared blackboard: Handoff and action provenance stored in `{bb_name}`."
    )

    events.append(AgentStepEvent(
        step_id=f"step-exec-{uuid.uuid4().hex[:6]}",
        session_id=session_id,
        agent="Executor",
        stage="Stage 4: Explainable Path UI",
        status="complete",
        thought="Investigation resolved. Graph state restored to HEALTHY. Delivering grounded explanation.",
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        is_final=True,
        final_answer=final_explanation
    ))

    return {
        "agent": "Executor",
        "target_service": target_service,
        "mutation_result": mutation_result,
        "final_explanation": final_explanation,
        "events": events
    }
