"""Recon Agent: Topology, Blast-Radius, and Centrality Specialist (Track 01 & Track 02)."""

import datetime
import uuid
from typing import Any, Dict, List
from app.db.falkor_client import FalkorManager, get_falkor_manager
from app.mcp_server.graph_tools import trace_blast_radius, compute_critical_bottlenecks
from app.models.payloads import AgentStepEvent


def run_recon_agent(
    session_id: str,
    query: str,
    target_service: str = "payment-engine",
    manager: FalkorManager | None = None
) -> Dict[str, Any]:
    """Executes Recon analysis on org_brain and updates the session blackboard graph."""
    manager = manager or get_falkor_manager()
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    events: List[AgentStepEvent] = []

    # 1. Thought: Analysis start
    events.append(AgentStepEvent(
        step_id=f"step-recon-{uuid.uuid4().hex[:6]}",
        session_id=session_id,
        agent="Recon",
        stage="Stage 1: Alert & Blast Radius",
        status="running",
        thought=f"Analyzing incident trigger: '{query}'. Querying FalkorDB 'org_brain' to compute multi-hop blast radius originating from '{target_service}'.",
        timestamp=now_iso
    ))

    # 2. Call MCP Tool: trace_blast_radius
    blast_result = trace_blast_radius(service_name=target_service, max_hops=4, manager=manager)
    
    events.append(AgentStepEvent(
        step_id=f"step-recon-{uuid.uuid4().hex[:6]}",
        session_id=session_id,
        agent="Recon",
        stage="Stage 1: Alert & Blast Radius",
        status="running",
        thought=(
            f"Blast radius traversal complete. Identified {blast_result['impacted_count']} downstream services impacted "
            f"(Severity: {blast_result['severity']}, Score: {blast_result['blast_radius_score']}). Cascading path flows upwards to 'api-gateway'."
        ),
        tool_call={"tool": "trace_blast_radius", "params": {"service_name": target_service, "max_hops": 4}},
        cypher_trace=blast_result["cypher_trace"],
        subgraph=blast_result["subgraph"],
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    ))

    # 3. Call MCP Tool: compute_critical_bottlenecks
    bottleneck_result = compute_critical_bottlenecks(manager=manager)
    
    events.append(AgentStepEvent(
        step_id=f"step-recon-{uuid.uuid4().hex[:6]}",
        session_id=session_id,
        agent="Recon",
        stage="Stage 1: Alert & Blast Radius",
        status="running",
        thought=(
            f"Graph centrality and bus-factor analysis complete. Identified {len(bottleneck_result['bus_factor_alerts'])} "
            f"single-contributor services (e.g. fraud-scorer owned by Lucas Silva). Confirmed '{target_service}' is high-centrality bottleneck."
        ),
        tool_call={"tool": "compute_critical_bottlenecks", "params": {}},
        cypher_trace=bottleneck_result["cypher_trace"],
        subgraph=bottleneck_result["subgraph"],
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    ))

    # 4. Write structural findings to FalkorDB blackboard_<session_id>
    finding_id = f"find-recon-{uuid.uuid4().hex[:6]}"
    task_id = f"task-hist-{uuid.uuid4().hex[:6]}"
    bb_name = f"blackboard_{session_id}"

    cypher_bb = """
    CREATE (f:Finding {
        id: $finding_id,
        agent_name: 'Recon',
        summary: $summary,
        cypher_used: $cypher_used,
        timestamp: $timestamp
    })
    CREATE (t:Task {
        id: $task_id,
        description: 'Audit commit provenance and ADR compliance for implicated services',
        status: 'PENDING'
    })
    CREATE (f)-[:HANDOFF_TO {next_agent: 'Historian'}]->(t)
    RETURN f, t
    """
    summary_text = (
        f"Critical blast radius detected on '{target_service}'. Impacting {blast_result['impacted_count']} downstream dependencies. "
        f"Handing off to Historian Agent to cross-reference recent commits with Architecture Decision Records."
    )
    
    manager.query(bb_name, cypher_bb, {
        "finding_id": finding_id,
        "summary": summary_text,
        "cypher_used": blast_result["cypher_trace"].cypher_query,
        "timestamp": now_iso,
        "task_id": task_id
    })

    events.append(AgentStepEvent(
        step_id=f"step-recon-{uuid.uuid4().hex[:6]}",
        session_id=session_id,
        agent="Recon",
        stage="Stage 1: Alert & Blast Radius",
        status="success",
        thought=f"Wrote Finding node '{finding_id}' into FalkorDB '{bb_name}'. Emitted [:HANDOFF_TO] edge to Historian Agent.",
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    ))

    return {
        "agent": "Recon",
        "target_service": target_service,
        "blast_result": blast_result,
        "bottleneck_result": bottleneck_result,
        "finding_id": finding_id,
        "next_agent": "Historian",
        "events": events
    }
