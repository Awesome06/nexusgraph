"use client";

import React, { useState, useEffect, useCallback } from "react";
import MemoryInspector from "@/components/MemoryInspector";
import ScenarioSelector, { Scenario } from "@/components/ScenarioSelector";
import AgentTracePanel, { AgentStepEvent } from "@/components/AgentTracePanel";
import GraphCanvas, { GraphNode, GraphEdge } from "@/components/GraphCanvas";
import CypherConsole from "@/components/CypherConsole";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_SCENARIOS: Scenario[] = [
  {
    id: "scenario-latency-cascade",
    title: "1. Cascading Timeout & Breaking Commit",
    description: "Traverses 4-hop upstream blast radius to isolate commit 8f92a1c violating ADR-002, and executes rollback.",
    trigger_type: "ALERT",
    suggested_query: "Investigate API Gateway Latency Spike and isolate breaking change",
    track_focus: ["Track 01 (Connected Data)", "Track 02 (Coordination)", "Track 03 (Company Brain)"],
  },
  {
    id: "scenario-bus-factor-audit",
    title: "2. Bus Factor & ADR Governance Audit",
    description: "Calculates in-degree centrality, isolates SPoF (fraud-scorer Bus Factor = 1), and drafts ADR governance.",
    trigger_type: "QUERY",
    suggested_query: "Audit organizational bus factor and check active ADR compliance",
    track_focus: ["Track 01 (Centrality)", "Track 03 (Company Brain)"],
  },
  {
    id: "scenario-memory-recall",
    title: "3. Cross-Session Procedural Memory",
    description: "Traverses procedural_memory for past incident INC-2025-104 and reinforces runbook confidence to 0.99.",
    trigger_type: "MEMORY",
    suggested_query: "Query procedural memory for cascading timeout remediation runbooks",
    track_focus: ["Track 02 (Agent Memory)", "Track 03 (Company Brain)"],
  },
];

export default function NexusGraphDashboard() {
  const [activeGraph, setActiveGraph] = useState<string>("org_brain");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [events, setEvents] = useState<AgentStepEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [currentAgent, setCurrentAgent] = useState<string>("Recon");
  const [activeStage, setActiveStage] = useState<string>("Ready");
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [falkorConnected, setFalkorConnected] = useState<boolean>(true);
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);

  // Fetch full graph topology for the active namespace
  const fetchGraphTopology = useCallback(async (graphName: string) => {
    setIsLoadingGraph(true);
    try {
      const res = await fetch(`${API_BASE}/api/graph/${graphName}`);
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      }
    } catch (err) {
      console.warn("Could not fetch graph topology from backend, using fallback data:", err);
    } finally {
      setIsLoadingGraph(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchGraphTopology(activeGraph);

    // Check health
    fetch(`${API_BASE}/api/health`)
      .then((r) => r.json())
      .then((d) => setFalkorConnected(d.schema_status?.native_connected ?? true))
      .catch(() => setFalkorConnected(false));
  }, [activeGraph, fetchGraphTopology]);

  // Handle switching multigraph tabs
  const handleSelectGraph = (graphName: string) => {
    setActiveGraph(graphName);
    setHighlightIds([]);
    fetchGraphTopology(graphName);
  };

  // Reseed all graphs
  const handleResetSeed = async () => {
    setIsSeeding(true);
    try {
      await fetch(`${API_BASE}/api/seed`, { method: "POST" });
      await fetchGraphTopology(activeGraph);
      setEvents([]);
      setHighlightIds([]);
    } catch (err) {
      console.error("Reseed failed:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  // Trigger Autonomous Swarm Investigation via Server-Sent Events (SSE)
  const handleTriggerInvestigation = (query: string, scenarioId?: string) => {
    if (isStreaming) return;

    setIsStreaming(true);
    setEvents([]);
    setHighlightIds([]);

    const sessionId = `session_${Date.now().toString(36)}`;
    const qLower = query.toLowerCase();

    // Auto-focus relevant multigraph namespace
    if (
      scenarioId === "scenario-memory-recall" ||
      qLower.includes("memory") ||
      qLower.includes("procedural") ||
      qLower.includes("runbook")
    ) {
      setActiveGraph("procedural_memory");
      fetchGraphTopology("procedural_memory");
    } else if (activeGraph !== "org_brain" && scenarioId !== "scenario-memory-recall") {
      setActiveGraph("org_brain");
      fetchGraphTopology("org_brain");
    }

    const url = `${API_BASE}/api/investigate/stream?query=${encodeURIComponent(
      query
    )}&scenario_id=${encodeURIComponent(scenarioId || "")}&session_id=${sessionId}&target_service=payment-engine`;

    const eventSource = new EventSource(url);

    eventSource.onmessage = (e) => {
      try {
        const eventData: AgentStepEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, eventData]);
        setCurrentAgent(eventData.agent);
        setActiveStage(eventData.stage);

        // Illuminate traversal path on graph canvas
        if (eventData.subgraph?.highlight_path && eventData.subgraph.highlight_path.length > 0) {
          setHighlightIds((prev) => {
            const set = new Set([...prev, ...eventData.subgraph.highlight_path]);
            return Array.from(set);
          });
        }

        // When executor completes, refresh graph state to reflect mutations
        if (eventData.is_final) {
          setIsStreaming(false);
          eventSource.close();
          fetchGraphTopology(activeGraph);
        }
      } catch (err) {
        console.error("Error parsing SSE event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn("SSE connection closed or error:", err);
      setIsStreaming(false);
      eventSource.close();
      // Generate deterministic client demo simulation based on selected scenario
      if (events.length === 0) {
        runClientFallbackDemo(query, sessionId, scenarioId);
      }
    };
  };

  // Fallback demo simulation supporting all 3 distinct scenarios if backend is offline
  const runClientFallbackDemo = (query: string, sessionId: string, scenarioId?: string) => {
    const qLower = query.toLowerCase();
    const isBusFactor =
      scenarioId === "scenario-bus-factor-audit" ||
      qLower.includes("bus factor") ||
      qLower.includes("centrality") ||
      qLower.includes("governance");

    const isMemoryRecall =
      scenarioId === "scenario-memory-recall" ||
      qLower.includes("memory") ||
      qLower.includes("procedural") ||
      qLower.includes("runbook");

    let simulatedSteps: AgentStepEvent[] = [];
    let highlightList: string[] = [];

    if (isBusFactor) {
      highlightList = ["fraud-scorer", "FinTech-Squad", "Lucas Silva", "payment-engine", "ADR-002", "Elena Rostova"];
      simulatedSteps = [
        {
          step_id: "step-1",
          session_id: sessionId,
          agent: "Recon",
          stage: "Stage 1: Centrality & SPoF Analysis",
          status: "running",
          thought: `Trigger: '${query}'. Executing in-degree centrality and contributor bus factor calculations in FalkorDB 'org_brain'.`,
          tool_call: { tool: "compute_critical_bottlenecks", params: {} },
          cypher_trace: {
            tool_name: "compute_critical_bottlenecks",
            agent_name: "Recon",
            cypher_query:
              "MATCH (s:Service)<-[r:DEPENDS_ON]-(dependent:Service)\nWITH s, count(dependent) AS inbound_deps\nMATCH (t:Team)-[:OWNS]->(s)\nOPTIONAL MATCH (p:Person)-[:AUTHORED]->(:Commit)-[:DEPLOYED_TO]->(s)\nRETURN s.name AS service, inbound_deps, t.name AS owning_team, count(DISTINCT p) AS contributor_bus_factor\nORDER BY inbound_deps DESC",
            parameters: {},
            execution_time_ms: 1.6,
            nodes_affected: 6,
            relationships_affected: 5,
            explanation: "Isolated Single Point of Failure: 'fraud-scorer' has Bus Factor = 1 (sole author Lucas Silva). In-degree bottleneck: 'payment-engine'.",
          },
          timestamp: new Date().toISOString(),
        },
        {
          step_id: "step-2",
          session_id: sessionId,
          agent: "Historian",
          stage: "Stage 2: ADR Governance Audit",
          status: "running",
          thought:
            "Auditing ADR governance coverage across company services. Discovered 'fraud-scorer' is completely ungoverned by active ADRs (0 active policies).",
          tool_call: { tool: "audit_adr_governance", params: { service_name: "fraud-scorer" } },
          cypher_trace: {
            tool_name: "audit_adr_governance",
            agent_name: "Historian",
            cypher_query:
              "MATCH (s:Service)\nOPTIONAL MATCH (adr:ADR {status: 'ACTIVE'})-[:GOVERNS]->(s)\nRETURN s.name AS service, s.tier AS tier, count(adr) AS adr_count, collect(adr.id) AS governing_adrs\nORDER BY adr_count ASC",
            parameters: {},
            execution_time_ms: 1.9,
            nodes_affected: 6,
            relationships_affected: 3,
            explanation: "Identified shadow tech debt: 'fraud-scorer' has 0 governing ADRs despite being in the synchronous checkout path.",
          },
          timestamp: new Date().toISOString(),
        },
        {
          step_id: "step-3",
          session_id: sessionId,
          agent: "Executor",
          stage: "Stage 3: Governance Action Plan",
          status: "complete",
          thought:
            "Mutating FalkorDB blackboard: Dispatching succession pairing mandate (Lucas Silva + Priya Sharma) and drafting ADR-004.",
          tool_call: { tool: "mutate_governance_action", params: { target_service: "fraud-scorer" } },
          cypher_trace: {
            tool_name: "mutate_governance_action",
            agent_name: "Executor",
            cypher_query:
              "CREATE (a1:ProposedAction {action_type: 'ASSIGN_SUCCESSION_PAIRING', target_service: 'fraud-scorer', primary: 'Lucas Silva', secondary: 'Priya Sharma'})\nCREATE (a2:ProposedAction {action_type: 'DRAFT_ADR', title: 'ADR-004: ML Fraud Scoring Latency SLA'})\nRETURN a1, a2",
            parameters: { target_service: "fraud-scorer" },
            execution_time_ms: 2.0,
            nodes_affected: 2,
            relationships_affected: 0,
            explanation: "Created succession pairing and ADR draft governance directives directly in the coordination blackboard.",
          },
          timestamp: new Date().toISOString(),
          is_final: true,
          final_answer:
            "### 🏛️ NexusGraph Organizational Governance & Bus Factor Audit Complete\n\n1. **Single-Point-of-Failure (Bus Factor = 1) Isolated:**\n- **Service:** `fraud-scorer` (Tier-2 ML evaluation engine)\n- **Sole Author:** **Lucas Silva** (Data Engineer, `FinTech-Squad`)\n- **Centrality Risk:** `payment-engine` depends synchronously on `fraud-scorer` with zero fallback cache.\n\n2. **Architectural Governance Gaps:**\n- `fraud-scorer` has **0 active ADRs** governing model inference timeout budgets or degradation behavior.\n- Cross-team disconnect: 4 hops between Principal Architect (Elena Rostova) and the service owner.\n\n3. **Autonomous Governance Actions Dispatched:**\n- **Succession Pairing Mandate:** Assigned **Priya Sharma** (Senior Platform Engineer) as secondary on-call.\n- **Drafted Architecture Directive:** Emitted `ADR-004: ML Fraud Scoring Timeout and Fallback SLA` into the blackboard.\n- **Blackboard State:** Registered proposed governance directives in `blackboard_demo`.",
        },
      ];
    } else if (isMemoryRecall) {
      setActiveGraph("procedural_memory");
      highlightList = ["cascading-timeout-ledger", "INC-2025-104", "RUN-001", "RUN-002"];
      simulatedSteps = [
        {
          step_id: "step-1",
          session_id: sessionId,
          agent: "Recon",
          stage: "Stage 1: Symptom Vector Matching",
          status: "running",
          thought: `Trigger: '${query}'. Connecting to FalkorDB 'procedural_memory' multigraph namespace to match symptom signatures.`,
          tool_call: { tool: "match_symptom_signatures", params: { symptom: "cascading-timeout-ledger" } },
          cypher_trace: {
            tool_name: "match_symptom_signatures",
            agent_name: "Recon",
            cypher_query:
              "MATCH (s:SymptomPattern)-[r:TRIGGERED]->(i:Incident)\nRETURN s.name AS symptom, s.frequency AS frequency, i.id AS incident_id, i.root_cause AS root_cause\nORDER BY s.frequency DESC",
            parameters: { symptom: "cascading-timeout-ledger" },
            execution_time_ms: 1.3,
            nodes_affected: 3,
            relationships_affected: 2,
            explanation: "Symptom fingerprint matched to historical incident INC-2025-104 (Ledger connection pool exhaustion).",
          },
          timestamp: new Date().toISOString(),
        },
        {
          step_id: "step-2",
          session_id: sessionId,
          agent: "Historian",
          stage: "Stage 2: Runbook Confidence Traversal",
          status: "running",
          thought:
            "Traversing episodic resolution graph for INC-2025-104 in 'procedural_memory'. Recalled verified sequence: 1) RUN-001 (Flush Pool), 2) RUN-002 (Revert timeout).",
          tool_call: { tool: "recall_procedural_runbook", params: { incident_id: "INC-2025-104" } },
          cypher_trace: {
            tool_name: "recall_procedural_runbook",
            agent_name: "Historian",
            cypher_query:
              "MATCH (i:Incident {id: 'INC-2025-104'})-[:RESOLVED_BY]->(rb:RunbookStep)\nRETURN i.id AS incident, rb.id AS step_id, rb.action AS action, rb.confidence AS confidence\nORDER BY rb.execution_order ASC",
            parameters: { incident_id: "INC-2025-104" },
            execution_time_ms: 1.7,
            nodes_affected: 3,
            relationships_affected: 2,
            explanation: "Retrieved verified ordered runbook steps with historical resolution success rate of 98%.",
          },
          timestamp: new Date().toISOString(),
        },
        {
          step_id: "step-3",
          session_id: sessionId,
          agent: "Executor",
          stage: "Stage 3: Memory Reinforcement Mutation",
          status: "complete",
          thought:
            "Mutating FalkorDB 'procedural_memory'. Updated RUN-001 confidence to 0.99 and logged verification directive into blackboard.",
          tool_call: { tool: "reinforce_procedural_memory", params: { runbook_id: "RUN-001", new_confidence: 0.99 } },
          cypher_trace: {
            tool_name: "reinforce_procedural_memory",
            agent_name: "Executor",
            cypher_query:
              "MATCH (rb:RunbookStep {id: 'RUN-001'})\nSET rb.times_recalled = coalesce(rb.times_recalled, 3) + 1, rb.confidence = 0.99\nRETURN rb",
            parameters: { runbook_id: "RUN-001" },
            execution_time_ms: 1.5,
            nodes_affected: 1,
            relationships_affected: 0,
            explanation: "Reinforced procedural memory: updated confidence weight to 0.99 based on deterministic verification.",
          },
          timestamp: new Date().toISOString(),
          is_final: true,
          final_answer:
            "### 🧠 NexusGraph Cross-Session Procedural Memory Traversal Complete\n\n1. **Symptom Vector Fingerprint Matched:**\n- Symptom signature: `cascading-timeout-ledger` (Frequency: 4 occurrences across history)\n- Historical Anchor Incident: **INC-2025-104** (*Cascading gateway timeout via ledger pool stall*)\n\n2. **Verified Runbook Graph Recalled from FalkorDB:**\n- **Step 1 (`RUN-001`):** Flush `payment-engine` thread pool & connection backlog (Confidence: **0.99**)\n- **Step 2 (`RUN-002`):** Revert timeout configuration to ADR-002 baseline <= 200ms (Confidence: **0.99**)\n- **Historical MTTR:** 95 seconds average resolution with zero manual escalations.\n\n3. **Procedural Memory Reinforcement:**\n- Incremented recall counter for pattern `cascading-timeout-ledger` in `procedural_memory`.\n- Verified remediation steps logged into blackboard session for instant zero-hallucination execution.",
        },
      ];
    } else {
      highlightList = ["payment-engine", "api-gateway", "ledger-db", "8f92a1c", "Arjun Mehta", "ADR-002"];
      simulatedSteps = [
        {
          step_id: "step-1",
          session_id: sessionId,
          agent: "Recon",
          stage: "Stage 1: Alert & Blast Radius",
          status: "running",
          thought: `Trigger received: '${query}'. Executing variable-length Cypher traversal (*1..4) from 'payment-engine' in FalkorDB 'org_brain'.`,
          tool_call: { tool: "trace_blast_radius", params: { service_name: "payment-engine", max_hops: 4 } },
          cypher_trace: {
            tool_name: "trace_blast_radius",
            agent_name: "Recon",
            cypher_query:
              "MATCH path = (source:Service {name: 'payment-engine'})<-[:DEPENDS_ON*1..4]-(downstream:Service)\nRETURN [n IN nodes(path) | n.name] AS dependency_chain, length(path) AS hops, downstream.tier AS tier\nORDER BY hops ASC",
            parameters: { service_name: "payment-engine" },
            execution_time_ms: 1.4,
            nodes_affected: 4,
            relationships_affected: 3,
            explanation: "Identified cascading path upwards to api-gateway. Blast radius score: 0.85 (CRITICAL).",
          },
          timestamp: new Date().toISOString(),
        },
        {
          step_id: "step-2",
          session_id: sessionId,
          agent: "Historian",
          stage: "Stage 2: Lineage & ADR Check",
          status: "running",
          thought:
            "Traversing commit lineage for 'payment-engine'. CROSS-REFERENCED WITH ADR-002: Commit 8f92a1c by Arjun Mehta set timeout to 5000ms, violating ADR-002 (must be <= 200ms).",
          tool_call: { tool: "find_breaking_commit_and_owner", params: { service_name: "payment-engine" } },
          cypher_trace: {
            tool_name: "find_breaking_commit_and_owner",
            agent_name: "Historian",
            cypher_query:
              "MATCH (s:Service {name: 'payment-engine'})-[:DEPENDS_ON*0..2]->(dep:Service)\nMATCH (p:Person)-[:AUTHORED]->(c:Commit)-[:DEPLOYED_TO]->(dep)\nOPTIONAL MATCH (adr:ADR {status: 'ACTIVE'})-[:GOVERNS]->(dep)\nRETURN dep.name, c.sha, c.message, p.name, p.slack_handle, adr.rule_summary",
            parameters: { service_name: "payment-engine" },
            execution_time_ms: 2.1,
            nodes_affected: 5,
            relationships_affected: 4,
            explanation: "Isolated breaking commit 8f92a1c authored by Arjun Mehta (@arjun) violating ADR-002.",
          },
          timestamp: new Date().toISOString(),
        },
        {
          step_id: "step-3",
          session_id: sessionId,
          agent: "Executor",
          stage: "Stage 3: Graph-Driven Action",
          status: "complete",
          thought:
            "Mutating FalkorDB state: Reverting timeout commit, flushing payment-engine connection pool, setting Service status = 'HEALTHY'.",
          tool_call: {
            tool: "mutate_graph_action",
            params: { service_name: "payment-engine", action: "ROLLBACK_CONFIG_AND_FLUSH_POOL" },
          },
          cypher_trace: {
            tool_name: "mutate_graph_action",
            agent_name: "Executor",
            cypher_query:
              "MATCH (s:Service {name: 'payment-engine'})\nSET s.status = 'HEALTHY'\nCREATE (pa:ProposedAction {action_type: 'ROLLBACK', target_service: 'payment-engine', approved: true})\nRETURN s, pa",
            parameters: { service_name: "payment-engine" },
            execution_time_ms: 1.8,
            nodes_affected: 2,
            relationships_affected: 1,
            explanation: "Automated rollback applied. Graph state restored to HEALTHY.",
          },
          timestamp: new Date().toISOString(),
          is_final: true,
          final_answer:
            "### 🛡️ NexusGraph Autonomous Remediation Complete\n\n1. **Root Cause:** Commit `8f92a1c` by Arjun Mehta increased ledger timeout to 5000ms.\n2. **Policy Violation:** Direct breach of **ADR-002** (ledger timeout <= 200ms).\n3. **Mitigation Executed:** Reverted config change, flushed connection pool, marked `payment-engine` HEALTHY in `org_brain`.\n4. **Procedural Memory:** Incremented confidence to 0.99 for `cascading-timeout-ledger` pattern.",
        },
      ];
    }

    setHighlightIds(highlightList);

    simulatedSteps.forEach((st, idx) => {
      setTimeout(() => {
        setEvents((prev) => [...prev, st]);
        setCurrentAgent(st.agent);
        setActiveStage(st.stage);
        if (st.is_final) {
          setIsStreaming(false);
        }
      }, (idx + 1) * 700);
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      {/* 1. Top Bar: Multigraph Inspector, Status & Brand */}
      <MemoryInspector
        activeGraph={activeGraph}
        onSelectGraph={handleSelectGraph}
        onResetSeed={handleResetSeed}
        onOpenConsole={() => setIsConsoleOpen(true)}
        isSeeding={isSeeding}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        falkorConnected={falkorConnected}
      />

      {/* 2. Main Split-Screen Command Center */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2.5 p-2.5 min-h-0 overflow-hidden">
        {/* Left Pane (5 Cols): 1-Click Scenarios + Agent Trace Panel */}
        <div className="lg:col-span-5 flex flex-col gap-2.5 min-h-0 h-full overflow-hidden">
          <ScenarioSelector
            scenarios={DEFAULT_SCENARIOS}
            onTriggerScenario={handleTriggerInvestigation}
            isLoading={isStreaming}
          />
          <div className="flex-1 min-h-0">
            <AgentTracePanel
              events={events}
              isStreaming={isStreaming}
              currentAgent={currentAgent}
              activeStage={activeStage}
            />
          </div>
        </div>

        {/* Right Pane (7 Cols): Dual-Engine FalkorDB Graph Canvas 2.0 */}
        <div className="lg:col-span-7 flex flex-col min-h-0 h-full overflow-hidden">
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            highlightIds={highlightIds}
            activeGraphName={activeGraph}
            onRefresh={() => fetchGraphTopology(activeGraph)}
            isLoading={isLoadingGraph}
          />
        </div>
      </div>

      {/* 3. FalkorDB Architecture Console (Benchmarks, openCypher REPL, Chaos) */}
      <CypherConsole
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
        activeGraphName={activeGraph}
        onRefreshGraph={() => fetchGraphTopology(activeGraph)}
      />
    </div>
  );
}
