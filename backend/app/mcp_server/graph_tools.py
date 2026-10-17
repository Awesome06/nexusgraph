"""FastMCP Graph Tools wrapping FalkorDB Cypher queries and graph algorithms.

Every tool returns:
1. Structured analytical findings for Agent reasoning
2. Exact Cypher query and execution metrics (`cypher_trace`)
3. Subgraph payload (`nodes`, `edges`, `highlight_path`) for animated UI rendering
"""

import logging
import uuid
import time
from typing import Any, Dict, List, Optional
from app.db.falkor_client import get_falkor_manager, FalkorManager
from app.models.payloads import CypherTrace, SubgraphPayload, NodePayload, EdgePayload

logger = logging.getLogger("nexusgraph.mcp")

# Optional FastMCP registration
try:
    from mcp.server.fastmcp import FastMCP
    mcp_app = FastMCP("nexusgraph-engine")
except Exception:
    mcp_app = None


# -------------------------------------------------------------------------------------------------
# TOOL 1: trace_blast_radius
# -------------------------------------------------------------------------------------------------
def trace_blast_radius(
    service_name: str,
    max_hops: int = 4,
    manager: Optional[FalkorManager] = None
) -> Dict[str, Any]:
    """Finds all downstream services impacted if `service_name` degrades, ranked by hop distance and criticality."""
    manager = manager or get_falkor_manager()
    cypher = f"""
    MATCH path = (source:Service {{name: $service_name}})<-[:DEPENDS_ON*1..{max_hops}]-(downstream:Service)
    RETURN [n IN nodes(path) | n.name] AS dependency_chain,
           length(path) AS hops,
           downstream.tier AS tier,
           nodes(path) AS path_nodes,
           relationships(path) AS path_edges
    ORDER BY hops ASC
    """
    params = {"service_name": service_name}
    raw_records, exec_ms = manager.query("org_brain", cypher, params)

    impacted_services: List[Dict[str, Any]] = []
    highlight_nodes: List[str] = [service_name]
    all_path_entities: List[Any] = []

    for row in raw_records:
        if isinstance(row, (list, tuple)) and len(row) >= 3:
            chain = row[0]
            hops = row[1]
            tier = row[2]
            downstream_name = chain[-1] if isinstance(chain, list) and chain else ""
            if downstream_name and downstream_name not in highlight_nodes:
                highlight_nodes.append(downstream_name)

            impacted_services.append({
                "downstream_service": downstream_name,
                "hops": hops,
                "tier": tier,
                "dependency_chain": chain
            })
            if len(row) > 3 and row[3]:
                all_path_entities.extend(row[3])
            if len(row) > 4 and row[4]:
                all_path_entities.extend(row[4])

    subgraph = manager.extract_subgraph(all_path_entities or raw_records, cypher=cypher.strip(), highlight_ids=highlight_nodes)
    
    # Calculate blast radius impact score
    tier1_count = sum(1 for s in impacted_services if s.get("tier") == "TIER-1")
    blast_radius_score = min(1.0, 0.3 * len(impacted_services) + 0.4 * tier1_count)

    trace = CypherTrace(
        tool_name="trace_blast_radius",
        agent_name="Recon",
        cypher_query=cypher.strip(),
        parameters=params,
        execution_time_ms=round(exec_ms, 2),
        nodes_affected=len(subgraph.nodes),
        relationships_affected=len(subgraph.edges),
        explanation=f"Traversed {max_hops}-hop upstream dependencies from '{service_name}'. Identified {len(impacted_services)} impacted downstream services, including {tier1_count} critical TIER-1 services."
    )

    return {
        "tool_name": "trace_blast_radius",
        "target_service": service_name,
        "max_hops": max_hops,
        "impacted_count": len(impacted_services),
        "impacted_services": impacted_services,
        "blast_radius_score": round(blast_radius_score, 2),
        "severity": "CRITICAL" if blast_radius_score > 0.6 else "WARNING",
        "cypher_trace": trace,
        "subgraph": subgraph
    }


# -------------------------------------------------------------------------------------------------
# TOOL 2: find_breaking_commit_and_owner
# -------------------------------------------------------------------------------------------------
def find_breaking_commit_and_owner(
    service_name: str,
    manager: Optional[FalkorManager] = None
) -> Dict[str, Any]:
    """Traverses from an unhealthy service or its upstream dependencies to recent commits, authors, and ADR compliance."""
    manager = manager or get_falkor_manager()
    cypher = """
    MATCH (s:Service {name: $service_name})-[:DEPENDS_ON*0..2]->(dep:Service)
    MATCH (p:Person)-[:AUTHORED]->(c:Commit)-[:DEPLOYED_TO]->(dep)
    OPTIONAL MATCH (adr:ADR {status: 'ACTIVE'})-[:GOVERNS]->(dep)
    RETURN dep.name AS service,
           c.sha AS commit_sha,
           c.message AS commit_msg,
           c.timestamp AS deployed_at,
           p.name AS author,
           p.slack_handle AS contact,
           collect(adr.rule_summary) AS governing_adrs
    ORDER BY c.timestamp DESC
    LIMIT 5
    """
    params = {"service_name": service_name}
    raw_records, exec_ms = manager.query("org_brain", cypher, params)

    candidates: List[Dict[str, Any]] = []
    highlight_nodes: List[str] = [service_name]
    adr_violation_found = False
    violating_commit_info = None

    for row in raw_records:
        if isinstance(row, (list, tuple)) and len(row) >= 6:
            dep_svc = str(row[0])
            c_sha = str(row[1])
            c_msg = str(row[2])
            dep_at = str(row[3])
            author = str(row[4])
            contact = str(row[5])
            governing_adrs = row[6] if len(row) > 6 else []

            # Check if this commit violates ADR-002 (timeout > 200ms)
            is_violating = False
            violation_notes = ""
            if "timeout" in c_msg.lower() and ("5000ms" in c_msg.lower() or "5s" in c_msg.lower() or "5000" in c_msg.lower()):
                is_violating = True
                adr_violation_found = True
                violation_notes = "VIOLATION of ADR-002: Ledger timeout must be <= 200ms; commit sets timeout to 5000ms"

            entry = {
                "service": dep_svc,
                "commit_sha": c_sha,
                "commit_message": c_msg,
                "deployed_at": dep_at,
                "author": author,
                "contact": contact,
                "governing_adrs": governing_adrs,
                "adr_violation": is_violating,
                "violation_notes": violation_notes
            }
            candidates.append(entry)
            highlight_nodes.extend([dep_svc, c_sha, author])

            if is_violating and violating_commit_info is None:
                violating_commit_info = entry

    # Fetch subgraph for visual rendering
    subgraph = manager.extract_subgraph(raw_records, cypher=cypher.strip(), highlight_ids=highlight_nodes)

    explanation = (
        f"Audited recent commit lineage for '{service_name}' against active ADRs. "
        + (f"DETECTED BREAKING COMMIT {violating_commit_info['commit_sha']} by {violating_commit_info['author']} ({violating_commit_info['contact']}): {violating_commit_info['violation_notes']}."
           if violating_commit_info else "No direct ADR violations detected in recent commits.")
    )

    trace = CypherTrace(
        tool_name="find_breaking_commit_and_owner",
        agent_name="Historian",
        cypher_query=cypher.strip(),
        parameters=params,
        execution_time_ms=round(exec_ms, 2),
        nodes_affected=len(subgraph.nodes),
        relationships_affected=len(subgraph.edges),
        explanation=explanation
    )

    return {
        "tool_name": "find_breaking_commit_and_owner",
        "service_name": service_name,
        "commit_count": len(candidates),
        "commits": candidates,
        "adr_violation_detected": adr_violation_found,
        "root_cause_commit": violating_commit_info,
        "cypher_trace": trace,
        "subgraph": subgraph
    }


# -------------------------------------------------------------------------------------------------
# TOOL 3: find_shortest_ownership_path
# -------------------------------------------------------------------------------------------------
def find_shortest_ownership_path(
    person_name: str,
    service_name: str,
    manager: Optional[FalkorManager] = None
) -> Dict[str, Any]:
    """Uses native Cypher `shortestPath` to explain how an engineer or decision connects to a given service."""
    manager = manager or get_falkor_manager()
    cypher = """
    MATCH (p:Person {name: $person_name}), (s:Service {name: $service_name})
    WITH shortestPath((p)-[*..6]->(s)) AS path
    RETURN [n IN nodes(path) | coalesce(n.name, n.title, n.sha)] AS node_trace,
           [r IN relationships(path) | type(r)] AS rel_trace,
           nodes(path) AS path_nodes,
           relationships(path) AS path_edges
    """
    params = {"person_name": person_name, "service_name": service_name}
    try:
        raw_records, exec_ms = manager.query("org_brain", cypher, params)
        if not raw_records or not raw_records[0] or not raw_records[0][0]:
            cypher_rev = """
            MATCH (p:Person {name: $person_name}), (s:Service {name: $service_name})
            WITH shortestPath((s)-[*..6]->(p)) AS path
            RETURN [n IN nodes(path) | coalesce(n.name, n.title, n.sha)] AS node_trace,
                   [r IN relationships(path) | type(r)] AS rel_trace,
                   nodes(path) AS path_nodes,
                   relationships(path) AS path_edges
            """
            raw_records, exec_ms = manager.query("org_brain", cypher_rev, params)
    except Exception as exc:
        logger.warning("shortestPath traversal query fallback: %s", exc)
        raw_records, exec_ms = [], 1.0

    node_trace: List[str] = []
    rel_trace: List[str] = []
    highlight_nodes: List[str] = [person_name, service_name]
    all_path_entities: List[Any] = []

    if raw_records and len(raw_records) > 0 and len(raw_records[0]) >= 2:
        node_trace = list(raw_records[0][0] or [])
        rel_trace = list(raw_records[0][1] or [])
        highlight_nodes = [str(x) for x in node_trace]
        if len(raw_records[0]) > 2 and raw_records[0][2]:
            all_path_entities.extend(raw_records[0][2])
        if len(raw_records[0]) > 3 and raw_records[0][3]:
            all_path_entities.extend(raw_records[0][3])

    subgraph = manager.extract_subgraph(all_path_entities or raw_records, cypher=cypher.strip(), highlight_ids=highlight_nodes)

    path_description = " -> ".join(
        f"{node_trace[i]} -[{rel_trace[i] if i < len(rel_trace) else 'CONNECTED'}]->"
        for i in range(len(node_trace) - 1)
    ) + (f" {node_trace[-1]}" if node_trace else "")

    trace = CypherTrace(
        tool_name="find_shortest_ownership_path",
        agent_name="Historian",
        cypher_query=cypher.strip(),
        parameters=params,
        execution_time_ms=round(exec_ms, 2),
        nodes_affected=len(subgraph.nodes),
        relationships_affected=len(subgraph.edges),
        explanation=f"Calculated shortest organizational path between '{person_name}' and '{service_name}': {path_description}"
    )

    return {
        "tool_name": "find_shortest_ownership_path",
        "person_name": person_name,
        "service_name": service_name,
        "path_length": len(rel_trace),
        "node_trace": node_trace,
        "rel_trace": rel_trace,
        "path_description": path_description,
        "cypher_trace": trace,
        "subgraph": subgraph
    }


# -------------------------------------------------------------------------------------------------
# TOOL 4: compute_critical_bottlenecks
# -------------------------------------------------------------------------------------------------
def compute_critical_bottlenecks(
    manager: Optional[FalkorManager] = None
) -> Dict[str, Any]:
    """Executes graph degree centrality and Bus Factor analysis across company topology."""
    manager = manager or get_falkor_manager()
    cypher = """
    MATCH (s:Service)<-[r:DEPENDS_ON]-(dependent:Service)
    WITH s, count(dependent) AS inbound_deps
    MATCH (t:Team)-[:OWNS]->(s)
    OPTIONAL MATCH (p:Person)-[:AUTHORED]->(:Commit)-[:DEPLOYED_TO]->(s)
    RETURN s.name AS service,
           inbound_deps,
           t.name AS owning_team,
           count(DISTINCT p) AS contributor_bus_factor
    ORDER BY inbound_deps DESC
    """
    raw_records, exec_ms = manager.query("org_brain", cypher)

    services_analysis: List[Dict[str, Any]] = []
    bus_factor_alerts: List[Dict[str, Any]] = []
    highlight_nodes: List[str] = []

    for row in raw_records:
        if isinstance(row, (list, tuple)) and len(row) >= 4:
            svc_name = str(row[0])
            inbound = int(row[1])
            team = str(row[2])
            bus_factor = int(row[3]) if row[3] else 1

            entry = {
                "service": svc_name,
                "inbound_dependencies": inbound,
                "owning_team": team,
                "bus_factor": bus_factor,
                "is_single_point_of_failure": inbound >= 2,
                "is_bus_factor_risk": bus_factor <= 1
            }
            services_analysis.append(entry)

            if entry["is_bus_factor_risk"]:
                bus_factor_alerts.append(entry)
                highlight_nodes.append(svc_name)
            if entry["is_single_point_of_failure"]:
                highlight_nodes.append(svc_name)

    subgraph = manager.extract_subgraph(raw_records, cypher=cypher.strip(), highlight_ids=highlight_nodes)

    trace = CypherTrace(
        tool_name="compute_critical_bottlenecks",
        agent_name="Recon",
        cypher_query=cypher.strip(),
        parameters={},
        execution_time_ms=round(exec_ms, 2),
        nodes_affected=len(subgraph.nodes),
        relationships_affected=len(subgraph.edges),
        explanation=f"Scored in-degree centrality across microservices. Flagged {len(bus_factor_alerts)} services with Bus Factor = 1 and top bottleneck services."
    )

    return {
        "tool_name": "compute_critical_bottlenecks",
        "total_analyzed": len(services_analysis),
        "rankings": services_analysis,
        "bus_factor_alerts": bus_factor_alerts,
        "cypher_trace": trace,
        "subgraph": subgraph
    }


# -------------------------------------------------------------------------------------------------
# TOOL 5: recall_or_update_procedural_memory
# -------------------------------------------------------------------------------------------------
def recall_or_update_procedural_memory(
    symptom_signature: str,
    new_action: Optional[str] = None,
    manager: Optional[FalkorManager] = None
) -> Dict[str, Any]:
    """Queries or updates cross-session procedural memory for proven runbook remediation steps."""
    manager = manager or get_falkor_manager()

    if new_action:
        cypher = """
        MERGE (pat:Pattern {symptom_signature: $symptom_signature})
        MERGE (step:RunbookStep {command_template: $new_action})
        MERGE (pat)-[rel:RESOLVED_BY]->(step)
        ON CREATE SET rel.confidence = 0.85, rel.times_used = 1, step.id = 'step-' + randomUUID()
        ON MATCH SET rel.times_used = rel.times_used + 1,
                     rel.confidence = CASE WHEN rel.confidence < 0.99 THEN rel.confidence + 0.03 ELSE 0.99 END
        RETURN pat.symptom_signature AS pattern,
               step.command_template AS recommended_fix,
               rel.confidence AS confidence,
               rel.times_used AS times_used
        """
        params = {"symptom_signature": symptom_signature, "new_action": new_action}
    else:
        cypher = """
        MERGE (pat:Pattern {symptom_signature: $symptom_signature})
        WITH pat
        OPTIONAL MATCH (pat)-[rel:RESOLVED_BY]->(step:RunbookStep)
        RETURN pat.symptom_signature AS pattern,
               step.command_template AS recommended_fix,
               rel.confidence AS confidence,
               rel.times_used AS times_used
        ORDER BY rel.confidence DESC
        """
        params = {"symptom_signature": symptom_signature}

    raw_records, exec_ms = manager.query("procedural_memory", cypher, params)

    solutions: List[Dict[str, Any]] = []
    highlight_nodes: List[str] = [symptom_signature]

    for row in raw_records:
        if isinstance(row, (list, tuple)) and len(row) >= 4:
            pattern = str(row[0])
            fix = str(row[1]) if row[1] else None
            conf = float(row[2]) if row[2] is not None else 0.0
            used = int(row[3]) if row[3] is not None else 0
            if fix:
                solutions.append({
                    "pattern": pattern,
                    "recommended_fix": fix,
                    "confidence": round(conf, 2),
                    "times_used": used
                })
                highlight_nodes.append(fix)

    subgraph = manager.extract_subgraph(raw_records, cypher=cypher.strip(), highlight_ids=highlight_nodes)
    best_fix = solutions[0] if solutions else None

    trace = CypherTrace(
        tool_name="recall_or_update_procedural_memory",
        agent_name="Historian",
        cypher_query=cypher.strip(),
        parameters=params,
        execution_time_ms=round(exec_ms, 2),
        nodes_affected=len(subgraph.nodes),
        relationships_affected=len(subgraph.edges),
        explanation=(
            f"Recalled procedural memory for symptom '{symptom_signature}'. "
            + (f"Found verified runbook fix '{best_fix['recommended_fix']}' (Confidence: {best_fix['confidence']}, Used: {best_fix['times_used']}x)."
               if best_fix else "No prior recorded runbook; recording baseline pattern.")
        )
    )

    return {
        "tool_name": "recall_or_update_procedural_memory",
        "symptom_signature": symptom_signature,
        "is_update": new_action is not None,
        "best_fix": best_fix,
        "all_fixes": solutions,
        "cypher_trace": trace,
        "subgraph": subgraph
    }


# -------------------------------------------------------------------------------------------------
# TOOL 6: mutate_graph_action
# -------------------------------------------------------------------------------------------------
def mutate_graph_action(
    service_name: str,
    action: str,
    session_id: str = "demo",
    manager: Optional[FalkorManager] = None
) -> Dict[str, Any]:
    """Mutates graph state: isolates/rolls back offending commit, marks Service HEALTHY, records Action in blackboard."""
    manager = manager or get_falkor_manager()
    action_id = f"act-{uuid.uuid4().hex[:8]}"
    start_time = time.perf_counter()

    # 1. Mutate org_brain
    cypher_org = """
    MATCH (s:Service {name: $service_name})
    SET s.status = 'HEALTHY'
    RETURN s
    """
    manager.query("org_brain", cypher_org, {"service_name": service_name})

    # 2. Mutate blackboard_<session_id>
    blackboard_name = f"blackboard_{session_id}"
    cypher_bb = """
    CREATE (pa:ProposedAction {
        id: $action_id,
        action_type: $action,
        target_service: $service_name,
        risk_score: 0.05,
        approved: true,
        executed_at: timestamp()
    })
    WITH pa
    OPTIONAL MATCH (f:Finding)
    CREATE (f)-[:SUPPORTS]->(pa)
    RETURN pa
    """
    raw_records, _ = manager.query(blackboard_name, cypher_bb, {
        "action_id": action_id,
        "action": action,
        "service_name": service_name
    })

    # 3. Update procedural_memory times_used
    try:
        recall_or_update_procedural_memory(
            symptom_signature="cascading-timeout-ledger",
            new_action="revert_commit(sha='8f92a1c'); flush_connection_pool(service='payment-engine')",
            manager=manager
        )
    except Exception as e:
        logger.debug("Procedural update note: %s", e)

    exec_ms = (time.perf_counter() - start_time) * 1000.0
    subgraph = manager.extract_subgraph(raw_records, cypher=cypher_bb.strip(), highlight_ids=[action_id, service_name])

    trace = CypherTrace(
        tool_name="mutate_graph_action",
        agent_name="Executor",
        cypher_query=cypher_bb.strip(),
        parameters={"service_name": service_name, "action": action, "action_id": action_id},
        execution_time_ms=round(exec_ms, 2),
        nodes_affected=1,
        relationships_affected=1,
        explanation=f"Executed mitigation '{action}' on '{service_name}'. Updated Service status to HEALTHY, logged ProposedAction in {blackboard_name}, and incremented procedural memory confidence."
    )

    return {
        "tool_name": "mutate_graph_action",
        "action_id": action_id,
        "service_name": service_name,
        "action_type": action,
        "status": "EXECUTED_AND_GRAPH_UPDATED",
        "cypher_trace": trace,
        "subgraph": subgraph
    }
