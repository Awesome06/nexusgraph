---
title: "Specification: FastMCP Cypher Graph Tools"
summary: Complete interface and Cypher query contracts for the 6 FastMCP tools powering autonomous graph analysis and remediation.
type: spec
status: active
tags: [spec, mcp, cypher, tools, graphblas, falkordb]
aliases: [mcp-graph-tools, fastmcp-tools, cypher-tools]
---

# Specification: FastMCP Cypher Graph Tools

NexusGraph agents interact with FalkorDB through standardized FastMCP tools executing deterministic openCypher queries over GraphBLAS sparse matrices.

## FastMCP Tool Contracts

### 1. `trace_blast_radius(service_name: str, max_hops: int = 4)`
Traverses downstream dependency chains (`<-[:DEPENDS_ON*1..4]-`) to identify all services impacted if `service_name` degrades, returning topological depth, affected tiers, and an impact severity score.

```cypher
MATCH path = (source:Service {name: $service_name})<-[:DEPENDS_ON*1..4]-(downstream:Service)
RETURN [n IN nodes(path) | n.name] AS dependency_chain,
       length(path) AS hops,
       downstream.tier AS tier,
       nodes(path) AS path_nodes,
       relationships(path) AS path_edges
ORDER BY hops ASC
```

### 2. `find_breaking_commit_and_owner(service_name: str)`
Traverses upstream service dependencies up to 2 hops, examines recent code commits and authors, and evaluates commit messages against active ADRs to detect non-compliant changes.

```cypher
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
```

### 3. `find_shortest_ownership_path(person_name: str, service_name: str)`
Executes native Cypher `shortestPath` across any relationship type up to 6 hops to reconstruct organizational governance and ownership chains between engineers and services.

```cypher
MATCH (p:Person {name: $person_name}), (s:Service {name: $service_name})
MATCH path = shortestPath((p)-[*..6]-(s))
RETURN [n IN nodes(path) | coalesce(n.name, n.title, n.sha)] AS node_trace,
       [r IN relationships(path) | type(r)] AS rel_trace
```

### 4. `compute_critical_bottlenecks()`
Calculates in-degree centrality (`count(dependent)`) to flag architectural single points of failure and calculates author diversity (`count(DISTINCT p)`) to isolate "Bus Factor = 1" operational risks.

```cypher
MATCH (s:Service)<-[r:DEPENDS_ON]-(dependent:Service)
WITH s, count(dependent) AS inbound_deps
MATCH (t:Team)-[:OWNS]->(s)
OPTIONAL MATCH (p:Person)-[:AUTHORED]->(:Commit)-[:DEPLOYED_TO]->(s)
RETURN s.name AS service,
       inbound_deps,
       t.name AS owning_team,
       count(DISTINCT p) AS contributor_bus_factor
ORDER BY inbound_deps DESC
```

### 5. `recall_or_update_procedural_memory(symptom_signature: str, new_action: str = None)`
Queries `procedural_memory` for historical runbook resolutions matching symptom patterns, or reinforces runbook weights upon successful incident resolution.

```cypher
MERGE (pat:Pattern {symptom_signature: $symptom_signature})
WITH pat
OPTIONAL MATCH (pat)-[rel:RESOLVED_BY]->(step:RunbookStep)
RETURN pat.symptom_signature AS pattern,
       step.command_template AS recommended_fix,
       rel.confidence AS confidence,
       rel.times_used AS times_used
ORDER BY rel.confidence DESC
```

### 6. `mutate_graph_action(service_name: str, action: str, session_id: str)`
Mutates `org_brain` state to mark degraded services `HEALTHY`, logs an approved `ProposedAction` on the session blackboard, and reinforces confidence scores in `procedural_memory`.

## References
- Swarm Protocol: [[wiki/specs/agent-swarm]] (implements)
- Multigraph Namespaces: [[wiki/specs/multigraph-namespaces]] (relates_to)
- System Architecture: [[wiki/architecture]] (relates_to)
- Entry Index: [[wiki/index]] (relates_to)
