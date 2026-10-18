---
name: hackathon-evaluation-governance
description: Formal evaluation governance protocol for FalkorDB Graph Hacks 2026, enforcing alignment across the 3 tracks, UI card layout symmetry, and live demo verification proofs.
---

# FalkorDB Graph Hacks 2026 — Evaluation Governance Skill

## 1. Core Protocols & Invariants

### Strictly 3 Competition Tracks Governance
All features, scenario selectors, agent traces, and memory visualizations in NexusGraph MUST explicitly declare and substantiate their alignment with the official **3 competition tracks**:
1. **Track 01: Agents on Connected Data**
   - Autonomous multi-hop reasoning over FalkorDB graph topology (`org_brain`).
   - Empirical GraphBLAS sparse matrix performance proofs: sub-millisecond BFS blast radius traversals ($< 15\text{ ms}$) and In-Degree Centrality aggregations ($< 25\text{ ms}$) isolating Single Points of Failure (SPoF).
2. **Track 02: Memory & Coordination**
   - Episodic incident memory in `procedural_memory` linking symptom signatures, past incidents, and verified runbook steps.
   - Dynamic multi-agent coordination blackboard (`blackboard_<session_id>`) for non-blocking task claiming, finding publication, and proposed action handoffs.
3. **Track 03: Company Brain**
   - Unified organizational knowledge graph integrating microservices, team ownership, contributor commit history, bus factor calculation, and Architectural Decision Records (ADRs).
   - Automated compliance validation verifying that every autonomous remediation action strictly adheres to governing ADR policies before mutation.

```typescript
// Good: Explicit track mapping and empirical verification metadata
export const SCENARIO_EVALUATION = {
  id: "centrality-spof",
  title: "In-Degree Centrality & SPoF Isolation",
  tracks: ["Track 01 (Connected Data)", "Track 03 (Company Brain)"],
  proofMetrics: {
    cypherTraversalEngine: "FalkorDB GraphBLAS",
    targetLatencyMs: 1.4,
    busFactorThreshold: 1
  }
};

// Bad: Ad-hoc feature without track taxonomy or evaluation metadata
export const SCENARIO_EVALUATION = {
  id: "test",
  title: "Run some queries"
};
```

---

## 2. UI Layout & Visual Symmetry Invariants

### 1. Unified Scenario Card Bounding Boxes
- All evaluation and scenario selector cards in `ScenarioSelector.tsx` and dashboard panels MUST share identical bounding box dimensions, padding, and flex properties.
- Variable-length descriptions MUST enforce strict line clamping (`line-clamp-2` or single-line with ellipsis) to prevent uneven vertical baseline shifts between cards.

### 2. Standardized Track Badge Pills
- Track badges MUST use consistent pill styling with distinct color accents:
  - **Track 01**: Cyan border and background glow (`border-cyan-500/40 text-cyan-400 bg-cyan-950/20`)
  - **Track 02**: Purple border and background glow (`border-purple-500/40 text-purple-400 bg-purple-950/20`)
  - **Track 03**: Emerald border and background glow (`border-emerald-500/40 text-emerald-400 bg-emerald-950/20`)

### 3. Markdown Stream & Terminal Polish
- Live agent thought streams rendered via `AgentTracePanel.tsx` MUST support clean GitHub-flavored markdown parsing, syntax-highlighted Cypher blocks, and playback speed controls (`0.5x`, `1.0x`, `2.0x`).

---

## 3. Live Demo & Evaluation Verification Proofs

### One-Click Evaluation Workflows
- The application MUST provide one-click interactive evaluation presets that showcase the full end-to-end multi-agent lifecycle in $< 30\text{ seconds}$ without requiring manual Cypher authoring.
- Live telemetry streams MUST display native FalkorDB execution metrics (`result.run_time_ms`) side-by-side with relational CTE benchmark models.

### Chaos Failure & Autonomous MTTR Proof
- The live demo suite MUST feature a controlled chaos injection triggering a p99 latency spike ($> 4,000\text{ ms}$) or circuit trip, demonstrating autonomous 4-agent swarm resolution (Recon $\to$ Historian $\to$ Auditor $\to$ Executor) with verified MTTR $< 5.0\text{ seconds}$.

---

## 4. Implementation Integrity & Anti-Laziness
- **Anti-Laziness Guardrail:** Leaving unstyled placeholder cards, omitting track tags on demonstration workflows, hardcoding artificial timer delays to simulate GraphBLAS traversals, or presenting incomplete runbook actions is STRICTLY FORBIDDEN. All demo scenarios MUST execute against live or fully-seeded FalkorDB graph namespaces.
