---
title: "ADR 001: FalkorDB Graph Database Backend"
summary: Architectural decision record adopting FalkorDB over flat vector databases for relational knowledge graph traversal and sub-millisecond multi-agent blackboards.
type: adr
status: accepted
tags: [adr, database, falkordb, cypher]
aliases: [001-falkordb-backend, adr-001, falkor-selection]
---

# ADR 001: FalkorDB Graph Database Backend

## Context & Problem Statement
Autonomous incident triaging requires multi-hop relational pathfinding across services, teams, past incidents, and recent code changes. Traditional retrieval-augmented generation (RAG) using flat vector stores performs semantic text matching but fails to execute topological queries such as:
- Which Tier-1 services depend on the degraded service?
- Who authored the latest commit deployed to that upstream dependency?
- Has a matching failure pattern occurred in the past 6 months?

Flat vector embeddings cannot reliably trace 3+ hops of relational topology with deterministic latency.

## Decision
We select **FalkorDB** (Redis Graph BLAS engine) as the foundational graph database for NexusGraph.

1. **Sub-millisecond Graph Traversals**: Powered by GraphBLAS sparse-matrix linear algebra, FalkorDB executes multi-hop Cypher queries in under 5 milliseconds.
2. **First-Class Cypher Support**: Enables declarative querying across heterogeneous nodes and edges (`MATCH (s:Service)-[:DEPENDS_ON*1..3]->(t:Service) RETURN s, t`).
3. **Multigraph Namespace Isolation**: Supports separate named graphs (`org_brain`, `procedural_memory`, `blackboard_{session_id}`) within a single server instance.
4. **FastMCP & OpenCypher Ecosystem**: Integrates natively with FastMCP tools and accepts open standard Cypher export streams generated from the markdown wiki.

## Consequences & Mitigations
- **Graph Schema Consistency**: Unconstrained Cypher queries can produce unindexed scans. We enforce schema validation and node property indexes via `app.db.schema.create_graph_indexes`.
- **In-Memory Footprint**: FalkorDB runs as an in-memory graph engine. For enterprise deployments, snapshot persistence (RDB/AOF) ensures data durability across restarts.

## References
- Architecture: [[wiki/architecture]] (governs)
- Swarm Protocol: [[wiki/specs/agent-swarm]] (relates_to)
- Entry Index: [[wiki/index]] (relates_to)
