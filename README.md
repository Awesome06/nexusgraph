# 🌌 NexusGraph — Autonomous Engineering Brain & Incident Remediation Swarm

[![FalkorDB Graph Hacks](https://img.shields.io/badge/FalkorDB-Graph_Hacks_2025-blueviolet.svg)](https://www.falkordb.com/)
[![Track Qualification](https://img.shields.io/badge/Tracks-01%20%7C%2002%20%7C%2003-emerald.svg)]()
[![Backend](https://img.shields.io/badge/Python-3.12+-blue.svg)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)]()
[![Frontend](https://img.shields.io/badge/Next.js-14_App_Router-black.svg)]()
[![Cypher Engine](https://img.shields.io/badge/Cypher-GraphBLAS-cyan.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **NexusGraph** is an autonomous multi-agent engineering swarm powered natively by **FalkorDB** as its active context, shared coordination blackboard, and procedural memory layer. It eliminates production fire drills by combining multi-hop blast-radius graph traversals, organizational decision provenance (ADRs), and cross-session incident memory to isolate and roll back breaking changes in seconds.

---

## 🏆 Simultaneous 3-Track Qualification Matrix

NexusGraph is purpose-built to natively qualify for **all three Graph Hacks tracks simultaneously**:

| Track | Theme | NexusGraph Autonomous Implementation | FalkorDB Cypher & Architecture Driver |
| :--- | :--- | :--- | :--- |
| **Track 01** | **Agents That Act on Connected Data** | Autonomous blast-radius calculation, graph centrality bottleneck detection, and automated rollback execution via FastMCP tools. | Variable-length path traversal (`<-[:DEPENDS_ON*1..4]-`), in-degree centrality (`count(dependent)`), and graph state mutations (`SET s.status = 'HEALTHY'`). |
| **Track 02** | **Agent Memory & Coordination** | 3 specialized agents (`Recon`, `Historian`, `Executor`) coordinate through a shared FalkorDB Blackboard using per-session multi-tenant graph isolation. | FalkorDB Multigraph isolation (`db.select_graph()`), Blackboard graphs (`blackboard_<session_id>`), and cross-session episodic memory (`procedural_memory`). |
| **Track 03** | **Company Brain** | Connects Engineers, Teams, Services, Commits, and Architecture Decision Records (ADRs) so every system decision traces to its human owner and historical rationale. | Native Cypher `shortestPath((p:Person)-[*..6]-(s:Service))`, provenance lineage (`(Person)-[:DECIDED]->(ADR)-[:GOVERNS]->(Service)`), and ADR violation detection. |

---

## 🏗️ Interactive Architecture & Multigraph Topology

NexusGraph exploits FalkorDB's native multigraph engine (`db.select_graph()`) to maintain three strictly isolated graph namespaces within a single FalkorDB instance:

```mermaid
graph TD
    subgraph UI ["Split-Screen Command Center (Next.js 14 + Force-Directed Canvas)"]
        A[User Alert / 1-Click Judge Scenario] --> B[SSE Event Stream & Cypher Trace Panel]
        C[Live Graph Canvas: Glowing Active Path]
    end

    subgraph Swarm ["Autonomous Agent Swarm (LangGraph + FastMCP)"]
        D["1. Recon Agent (Track 01)"] -->|Handoff Finding| E["2. Historian Agent (Track 02 & 03)"]
        E -->|Handoff Finding| F["3. Executor Agent (Track 01 & 02)"]
    end

    subgraph FalkorDB ["FalkorDB Multigraph Engine (Ports 6379 / 3000)"]
        G[("Namespace A: org_brain<br/>Services · Teams · Commits · ADRs")]
        H[("Namespace B: blackboard_&lt;session_id&gt;<br/>Tasks · Findings · ProposedActions")]
        I[("Namespace C: procedural_memory<br/>Incidents · Failure Patterns · Runbooks")]
    end

    A -->|FastAPI Trigger| D
    D -->|Tool: trace_blast_radius| G
    D -->|Writes Finding & Task| H
    E -->|Tool: find_breaking_commit_and_owner| G
    E -->|Tool: recall_procedural_memory| I
    E -->|Appends Provenance| H
    F -->|Tool: mutate_graph_action| G
    F -->|Records ProposedAction| H
    F -->|Updates Runbook Confidence| I
    B <-->|Real-time SSE| Swarm
    C <-->|Cypher Subgraph Nodes & Edges| FalkorDB
```

---

## ⚡ Graph Necessity: Why NexusGraph Cannot Function Without FalkorDB

> [!IMPORTANT]
> **Rule 3 Compliance:** NexusGraph does NOT use flat vector RAG or in-memory Python dictionaries for state or memory. Removing FalkorDB breaks:
> 1. **Inter-Agent Coordination:** Agents communicate exclusively by writing and querying `(:Task)-[:ASSIGNED_TO]->(:Finding)-[:HANDOFF_TO]->(:Task)` nodes inside FalkorDB's session blackboard.
> 2. **Blast Radius Analysis:** Requires graph path traversals through dependent microservices (`*1..4`).
> 3. **ADR Governance & Policy Enforcement:** Relies on hyper-connected relationships between commits, authors, services, and architecture decisions (`(Commit)-[:DEPLOYED_TO]->(Service)<-[:GOVERNS]-(ADR)`).
> 4. **Episodic Learning:** Multi-session runbook recall is weighted by confidence attributes on graph relationships (`[:RESOLVED_BY {confidence, times_used}]`).

---

## 🔍 Required Cypher Queries & FastMCP Tools

All agent interactions are executed through standardized FastMCP tools wrapping Cypher queries:

### Tool 1: `trace_blast_radius(service_name: str, max_hops: int = 4)`
Finds all downstream services impacted if `service_name` degrades, ranked by hop distance and tier.
```cypher
MATCH path = (source:Service {name: $service_name})<-[:DEPENDS_ON*1..4]-(downstream:Service)
RETURN [n IN nodes(path) | n.name] AS dependency_chain,
       length(path) AS hops,
       downstream.tier AS tier,
       nodes(path) AS path_nodes,
       relationships(path) AS path_edges
ORDER BY hops ASC
```

### Tool 2: `find_breaking_commit_and_owner(service_name: str)`
Traverses from an unhealthy service to recent commits, their authors, and flags active ADR violations.
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

### Tool 3: `find_shortest_ownership_path(person_name: str, service_name: str)`
Uses native Cypher `shortestPath` to explain how an engineer or decision connects to a given system.
```cypher
MATCH (p:Person {name: $person_name}), (s:Service {name: $service_name})
MATCH path = shortestPath((p)-[*..6]-(s))
RETURN [n IN nodes(path) | coalesce(n.name, n.title, n.sha)] AS node_trace,
       [r IN relationships(path) | type(r)] AS rel_trace
```

### Tool 4: `compute_critical_bottlenecks()`
Executes graph centrality / degree scoring to identify single-point-of-failure services and "Bus Factor = 1" engineers.
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

### Tool 5: `recall_or_update_procedural_memory(symptom_signature: str, new_action: str = None)`
Queries cross-session memory for proven runbook remediation steps, or records newly verified actions.
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

### Tool 6: `mutate_graph_action(service_name: str, action: str, session_id: str)`
Mutates FalkorDB graph state: marks service `HEALTHY`, logs `(:ProposedAction)` in `blackboard_<session_id>`, and updates procedural memory weights.
```cypher
MATCH (s:Service {name: $service_name})
SET s.status = 'HEALTHY'
CREATE (pa:ProposedAction {
    id: $action_id,
    action_type: $action,
    target_service: $service_name,
    risk_score: 0.05,
    approved: true
})
```

---

## 🧪 Synthetic Dataset Topology (`backend/app/db/seed.py`)

The application deterministically initializes with a rich company topology:
- **6 Microservices:** `api-gateway` (Go), `auth-service` (Rust), `payment-engine` (Python), `fraud-scorer` (Python), `ledger-db` (C++), `notification-worker` (Go).
- **2 Teams & 5 Engineers:** `Core-Platform` (Elena, Marcus, Priya) and `FinTech-Squad` (Arjun, Lucas).
  - *Bus Factor Vulnerability:* `fraud-scorer` has only 1 author (`Lucas Silva`).
- **3 Architecture Decision Records:**
  - `ADR-001:` JWKS Token caching for public endpoints (Decided by Elena)
  - `ADR-002:` All calls to `ledger-db` must use gRPC with mTLS and **timeout <= 200ms** (Decided by Elena)
  - `ADR-003:` Asynchronous Kafka delivery for notifications (Decided by Priya)
- **1 Breaking Commit (`8f92a1c`):**
  - Authored by `@arjun` on `payment-engine`, setting `ledger-db` timeout to `5000ms`.
  - **Directly violates ADR-002**, causing cascading thread exhaustion up to `api-gateway`.
- **2 Historical Incidents in `procedural_memory`:**
  - `INC-2025-104:` Cascading thread exhaustion resolved by reverting config and flushing connection pool (Confidence: 0.98, Used: 4x).

---

## 🚀 1-Command Judge Quickstart

### Option A: 1-Command Docker Compose (Judge Verification)
```bash
docker compose up --build
```
Once initialized:
- **NexusGraph Split-Screen Command Center:** [http://localhost:3001](http://localhost:3001)
- **FastAPI Backend & Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **FalkorDB Browser:** [http://localhost:3000](http://localhost:3000)
- **FalkorDB Bolt Endpoint:** `localhost:6379`

### Option B: Local Development Runbook
#### 1. Backend (FastAPI + LangGraph + FastMCP)
```bash
cd backend
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend (Next.js 14 App Router)
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3001
```

---

## 🧪 Automated Test Suite (100% Pass Rate)

NexusGraph includes end-to-end tests verifying the multigraph schema, all 6 MCP Cypher tools, and the 3-agent LangGraph pipeline:
```bash
cd backend
pytest tests -v
```

Output:
```text
backend/tests/test_swarm.py::test_seed_populates_org_brain PASSED        [ 12%]
backend/tests/test_swarm.py::test_tool_trace_blast_radius PASSED         [ 25%]
backend/tests/test_swarm.py::test_tool_find_breaking_commit_and_owner PASSED [ 37%]
backend/tests/test_swarm.py::test_tool_find_shortest_ownership_path PASSED [ 50%]
backend/tests/test_swarm.py::test_tool_compute_critical_bottlenecks PASSED [ 62%]
backend/tests/test_swarm.py::test_tool_recall_and_update_procedural_memory PASSED [ 75%]
backend/tests/test_swarm.py::test_tool_mutate_graph_action PASSED        [ 87%]
backend/tests/test_swarm.py::test_full_swarm_pipeline_execution PASSED   [100%]
============================== 8 passed in 6.01s ==============================
```

---

## 👥 Hackathon Team & Track Submission
- **Project:** NexusGraph — Autonomous Engineering Brain & Incident Remediation Swarm
- **Target Event:** FalkorDB Graph Hacks 2025
- **Tracks:**
  - Track 01: Agents That Act on Connected Data
  - Track 02: Agent Memory & Coordination
  - Track 03: Company Brain
