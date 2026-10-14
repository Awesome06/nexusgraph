---
title: "Runbook: Verification, Testing & Evaluation Guide"
summary: Complete test verification runbook covering automated pytest suites, MCP endpoints, Docker compose launch, and expected results.
type: runbook
status: active
tags: [runbook, testing, verification, pytest, docker, judge]
aliases: [verification-and-testing, testing-guide, evaluation-runbook]
---

# Runbook: Verification, Testing & Evaluation Guide

This guide details how to verify NexusGraph's complete multi-agent pipeline, Cypher tools, and split-screen visualizer.

## 1. Automated Test Suite Execution

The repository maintains an automated integration test suite in `backend/tests/test_swarm.py` validating the multigraph schema, all 6 FastMCP Cypher tools, and the end-to-end 3-agent LangGraph pipeline.

### Command
```bash
cd backend
.\.venv\Scripts\python.exe -m pytest tests -v
```

### Expected Results
```text
tests/test_swarm.py::test_seed_populates_org_brain PASSED                [ 12%]
tests/test_swarm.py::test_tool_trace_blast_radius PASSED                 [ 25%]
tests/test_swarm.py::test_tool_find_breaking_commit_and_owner PASSED     [ 37%]
tests/test_swarm.py::test_tool_find_shortest_ownership_path PASSED       [ 50%]
tests/test_swarm.py::test_tool_compute_critical_bottlenecks PASSED       [ 62%]
tests/test_swarm.py::test_tool_recall_and_update_procedural_memory PASSED [ 75%]
tests/test_swarm.py::test_tool_mutate_graph_action PASSED                [ 87%]
tests/test_swarm.py::test_full_swarm_pipeline_execution PASSED           [100%]

============================== 8 passed in ~5.9s ==============================
```

## 2. FastMCP Tool API Verification

Direct HTTP verification of individual tools can be performed against the FastAPI backend:

### Trace Blast Radius
```bash
curl -X POST http://localhost:8000/api/mcp/tool/trace_blast_radius \
     -H "Content-Type: application/json" \
     -d '{"service_name": "payment-engine", "max_hops": 4}'
```
**Expected**: Returns impacted count (2 downstream services including `api-gateway`), severity `CRITICAL`, and Cypher trace.

### Find Breaking Commit & ADR Violation
```bash
curl -X POST http://localhost:8000/api/mcp/tool/find_breaking_commit_and_owner \
     -H "Content-Type: application/json" \
     -d '{"service_name": "payment-engine"}'
```
**Expected**: Flags commit `8f92a1c` by Arjun Mehta (`@arjun`) with `adr_violation_detected: true`.

## 3. 1-Command Docker Compose Launch

For end-to-end evaluation with the live Next.js Force-Directed Graph UI and FalkorDB:

```bash
docker compose up --build
```

- **Frontend Command Center**: [http://localhost:3001](http://localhost:3001)
- **FastAPI Interactive Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **FalkorDB Browser**: [http://localhost:3000](http://localhost:3000)

## References
- Swarm Protocol: [[wiki/specs/agent-swarm]] (relates_to)
- FastMCP Tools: [[wiki/specs/mcp-graph-tools]] (relates_to)
- Incident Runbook: [[wiki/runbooks/cascading-timeout-remediation]] (relates_to)
- Entry Index: [[wiki/index]] (relates_to)
