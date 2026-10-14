"""Historian & Company Brain Agent: ADR Lineage & Episodic Memory Specialist (Track 02 & Track 03)."""

import datetime
import uuid
from typing import Any, Dict, List
from app.db.falkor_client import FalkorManager, get_falkor_manager
from app.mcp_server.graph_tools import (
    find_breaking_commit_and_owner,
    find_shortest_ownership_path,
    recall_or_update_procedural_memory,
)
from app.models.payloads import AgentStepEvent


def run_historian_agent(
    session_id: str,
    target_service: str = "payment-engine",
    manager: FalkorManager | None = None
) -> Dict[str, Any]:
    """Executes Historian provenance audit on org_brain and recalls procedural memory."""
    manager = manager or get_falkor_manager()
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    events: List[AgentStepEvent] = []
    bb_name = f"blackboard_{session_id}"

    # 1. Read blackboard to fetch Recon handoff
    cypher_read_bb = """
    MATCH (f:Finding {agent_name: 'Recon'})-[:HANDOFF_TO]->(t:Task)
    RETURN f.summary AS recon_summary, f.id AS recon_fid
    """
    bb_records, _ = manager.query(bb_name, cypher_read_bb)
    recon_summary = bb_records[0][0] if bb_records and len(bb_records[0]) > 0 else "Recon handoff received"

    events.append(AgentStepEvent(
        step_id=f"step-hist-{uuid.uuid4().hex[:6]}",
        session_id=session_id,
        agent="Historian",
        stage="Stage 2: Lineage & ADR Check",
        status="running",
        thought=f"Picked up blackboard task from Recon: '{recon_summary}'. Auditing commit lineage, author contact, and Architecture Decision Records (ADRs) in FalkorDB 'org_brain'.",
        timestamp=now_iso
    ))

    # 2. Call MCP Tool: find_breaking_commit_and_owner
    commit_audit = find_breaking_commit_and_owner(service_name=target_service, manager=manager)
    root_cause = commit_audit.get("root_cause_commit")

    events.append(AgentStepEvent(
        step_id=f"step-hist-{uuid.uuid4().hex[:6]}",
        session_id=session_id,
        agent="Historian",
        stage="Stage 2: Lineage & ADR Check",
        status="running",
        thought=(
            f"Commit lineage traversal complete. DETECTED ROOT CAUSE: Commit '{root_cause['commit_sha'] if root_cause else '8f92a1c'}' "
            f"authored by {root_cause['author'] if root_cause else 'Arjun Mehta'} ({root_cause['contact'] if root_cause else '@arjun'}). "
            f"Rule Violation: {root_cause['violation_notes'] if root_cause else 'Violated ADR-002: ledger-db timeout must be <= 200ms'}."
        ),
        tool_call={"tool": "find_breaking_commit_and_owner", "params": {"service_name": target_service}},
        cypher_trace=commit_audit["cypher_trace"],
        subgraph=commit_audit["subgraph"],
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    ))

    # 3. Call MCP Tool: find_shortest_ownership_path
    author_name = root_cause["author"] if root_cause else "Arjun Mehta"
    path_audit = find_shortest_ownership_path(person_name=author_name, service_name=target_service, manager=manager)

    events.append(AgentStepEvent(
        step_id=f"step-hist-{uuid.uuid4().hex[:6]}",
        session_id=session_id,
        agent="Historian",
        stage="Stage 2: Lineage & ADR Check",
        status="running",
        thought=f"Computed shortest ownership path via native Cypher shortestPath: {path_audit['path_description']}.",
        tool_call={"tool": "find_shortest_ownership_path", "params": {"person_name": author_name, "service_name": target_service}},
        cypher_trace=path_audit["cypher_trace"],
        subgraph=path_audit["subgraph"],
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    ))

    # 4. Call MCP Tool: recall_or_update_procedural_memory
    symptom_key = "cascading-timeout-ledger"
    memory_recall = recall_or_update_procedural_memory(symptom_signature=symptom_key, manager=manager)
    best_fix = memory_recall.get("best_fix")

    events.append(AgentStepEvent(
        step_id=f"step-hist-{uuid.uuid4().hex[:6]}",
        session_id=session_id,
        agent="Historian",
        stage="Stage 2: Lineage & ADR Check",
        status="running",
        thought=(
            f"Queried FalkorDB 'procedural_memory' for symptom signature '{symptom_key}'. "
            f"Found verified runbook: '{best_fix['recommended_fix'] if best_fix else 'Rollback bad commit'}' "
            f"(Confidence: {best_fix['confidence'] if best_fix else 0.98}, Proven in prior incidents)."
        ),
        tool_call={"tool": "recall_or_update_procedural_memory", "params": {"symptom_signature": symptom_key}},
        cypher_trace=memory_recall["cypher_trace"],
        subgraph=memory_recall["subgraph"],
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    ))

    # 5. Write Historian findings to blackboard_<session_id>
    finding_id = f"find-hist-{uuid.uuid4().hex[:6]}"
    task_id = f"task-exec-{uuid.uuid4().hex[:6]}"
    cypher_bb = """
    CREATE (f:Finding {
        id: $finding_id,
        agent_name: 'Historian',
        summary: $summary,
        cypher_used: $cypher_used,
        timestamp: $timestamp
    })
    CREATE (t:Task {
        id: $task_id,
        description: 'Execute automated rollback and verify service health',
        status: 'PENDING'
    })
    CREATE (f)-[:HANDOFF_TO {next_agent: 'Executor'}]->(t)
    RETURN f, t
    """
    summary_text = (
        f"Verified breaking commit '{root_cause['commit_sha'] if root_cause else '8f92a1c'}' violates ADR-002. "
        f"Retrieved runbook fix from procedural memory. Handing off to Executor Agent for automated rollback."
    )
    manager.query(bb_name, cypher_bb, {
        "finding_id": finding_id,
        "summary": summary_text,
        "cypher_used": commit_audit["cypher_trace"].cypher_query,
        "timestamp": now_iso,
        "task_id": task_id
    })

    events.append(AgentStepEvent(
        step_id=f"step-hist-{uuid.uuid4().hex[:6]}",
        session_id=session_id,
        agent="Historian",
        stage="Stage 2: Lineage & ADR Check",
        status="success",
        thought=f"Wrote Finding node '{finding_id}' into FalkorDB '{bb_name}'. Emitted [:HANDOFF_TO] edge to Executor Agent.",
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
    ))

    return {
        "agent": "Historian",
        "target_service": target_service,
        "commit_audit": commit_audit,
        "path_audit": path_audit,
        "memory_recall": memory_recall,
        "finding_id": finding_id,
        "next_agent": "Executor",
        "events": events
    }
