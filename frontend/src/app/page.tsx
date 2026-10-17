"use client";

import React, { useState, useEffect, useCallback } from "react";
import SwarmSidebar from "@/components/SwarmSidebar";
import SwarmTopBar from "@/components/SwarmTopBar";
import HeroScreen from "@/components/HeroScreen";
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
  const [viewMode, setViewMode] = useState<"hero" | "dashboard">("hero");
  const [activeTab, setActiveTab] = useState<string>("dashboard");
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
              "MATCH (s:Service)<-[r:DEPENDS_ON]-(caller:Service)\nRETURN s.name AS service, count(r) AS in_degree, collect(caller.name) AS callers\nORDER BY in_degree DESC LIMIT 5",
            parameters: {},
            execution_time_ms: 1.4,
            nodes_affected: 5,
            relationships_affected: 12,
            explanation: "Isolated services with high in-degree centrality. Identified critical single points of failure.",
          },
          timestamp: new Date().toISOString(),
        },
        {
          step_id: "step-2",
          session_id: sessionId,
          agent: "Historian",
          stage: "Stage 2: ADR Governance & Ownership Audit",
          status: "running",
          thought:
            "Auditing ADR governance for 'fraud-scorer'. Discovered Bus Factor = 1 (Lucas Silva). Service violates ADR-005 (Mandatory dual-maintainer redundancy).",
          tool_call: { tool: "find_shortest_ownership_path", params: { service: "fraud-scorer" } },
          cypher_trace: {
            tool_name: "find_shortest_ownership_path",
            agent_name: "Historian",
            cypher_query:
              "MATCH (p:Person)-[:OWNS]->(s:Service {name: 'fraud-scorer'})\nOPTIONAL MATCH (s)-[:GOVERNED_BY]->(adr:ADR)\nRETURN p.name AS owner, s.name AS service, adr.title AS adr",
            parameters: { service: "fraud-scorer" },
            execution_time_ms: 0.9,
            nodes_affected: 3,
            relationships_affected: 2,
            explanation: "Identified that 'fraud-scorer' is owned exclusively by Lucas Silva without a designated secondary maintainer.",
          },
          timestamp: new Date().toISOString(),
        },
        {
          step_id: "step-3",
          session_id: sessionId,
          agent: "Executor",
          stage: "Stage 3: Remediation & Policy Enforcement",
          status: "complete",
          thought:
            "Drafted ADR governance policy update into blackboard. Recommended co-ownership assignment to Elena Rostova to achieve Bus Factor >= 2.",
          tool_call: { tool: "draft_governance_remediation", params: { service: "fraud-scorer", co_owner: "Elena Rostova" } },
          cypher_trace: {
            tool_name: "draft_governance_remediation",
            agent_name: "Executor",
            cypher_query:
              "MATCH (s:Service {name: 'fraud-scorer'}), (p:Person {name: 'Elena Rostova'})\nMERGE (p)-[r:CO_OWNS]->(s)\nRETURN s.name, p.name",
            parameters: { service: "fraud-scorer", co_owner: "Elena Rostova" },
            execution_time_ms: 1.2,
            nodes_affected: 2,
            relationships_affected: 1,
            explanation: "Assigned co-ownership to Elena Rostova, elevating Bus Factor to 2 and satisfying ADR-005 governance rules.",
          },
          timestamp: new Date().toISOString(),
          is_final: true,
          final_answer:
            "### 📋 NexusGraph Organizational Bus Factor & ADR Governance Audit Complete\n\n1. **Critical Bottleneck Identified:**\n- Service: `fraud-scorer` (In-degree centrality: **4 callers**)\n- Current Bus Factor: **1 (Lucas Silva)**\n\n2. **Policy Violation:**\n- **ADR-005 Breach:** Core tier-1 scoring services must maintain >= 2 active maintainers.\n\n3. **Automated Governance Action:**\n- Co-ownership assigned to **Elena Rostova** (`Core-Platform` squad).\n- Bus Factor elevated to **2**; governance ticket dispatched to engineering leadership.",
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
          stage: "Stage 1: Blast Radius Traversal",
          status: "running",
          thought: `Received alert: '${query}'. Executing variable-length openCypher query on FalkorDB 'org_brain'. Traversed 4 hops upstream from 'payment-engine' in 0.38ms.`,
          tool_call: { tool: "trace_blast_radius", params: { service_name: "payment-engine", max_hops: 4 } },
          cypher_trace: {
            tool_name: "trace_blast_radius",
            agent_name: "Recon",
            cypher_query:
              "MATCH path = (s:Service {name: 'payment-engine'})<-[:DEPENDS_ON*1..4]-(caller:Service)\nRETURN [n IN nodes(path) | n.name] AS chain, length(path) AS depth\nORDER BY depth ASC",
            parameters: { service_name: "payment-engine", max_hops: 4 },
            execution_time_ms: 0.38,
            nodes_affected: 6,
            relationships_affected: 8,
            explanation: "GraphBLAS BFS traversal isolated upstream impact path: api-gateway -> payment-engine -> ledger-db.",
          },
          timestamp: new Date().toISOString(),
        },
        {
          step_id: "step-2",
          session_id: sessionId,
          agent: "Historian",
          stage: "Stage 2: Lineage & Policy Audit",
          status: "running",
          thought:
            "Correlating git commits and ADR contracts in FalkorDB. Discovered commit 8f92a1c ('fix: increase timeout') authored by Arjun Mehta directly violates ADR-002 (ledger timeout <= 200ms).",
          tool_call: { tool: "find_breaking_commit_and_owner", params: { service_name: "payment-engine" } },
          cypher_trace: {
            tool_name: "find_breaking_commit_and_owner",
            agent_name: "Historian",
            cypher_query:
              "MATCH (c:Commit)-[:AUTHORED_BY]->(p:Person)\nMATCH (c)-[:MODIFIED]->(s:Service {name: 'payment-engine'})\nMATCH (s)-[:GOVERNED_BY]->(adr:ADR)\nWHERE c.sha = '8f92a1c'\nRETURN c.sha AS commit, p.name AS author, adr.title AS adr",
            parameters: { service_name: "payment-engine" },
            execution_time_ms: 1.1,
            nodes_affected: 4,
            relationships_affected: 3,
            explanation: "Cross-domain join matched offending git SHA to ADR policy violation.",
          },
          timestamp: new Date().toISOString(),
        },
        {
          step_id: "step-3",
          session_id: sessionId,
          agent: "Executor",
          stage: "Stage 3: Remediation & Memory",
          status: "complete",
          thought:
            "Executing automated remediation: rolling back timeout config, flushing connection pool, mutating FalkorDB org_brain to HEALTHY state, and logging incident resolution in procedural_memory.",
          tool_call: { tool: "mutate_graph_action", params: { action: "ROLLBACK_CONFIG_AND_FLUSH_POOL" } },
          cypher_trace: {
            tool_name: "mutate_graph_action",
            agent_name: "Executor",
            cypher_query:
              "MATCH (s:Service {name: 'payment-engine'})\nSET s.status = 'HEALTHY', s.p99_latency_ms = 45\nRETURN s",
            parameters: { service_name: "payment-engine" },
            execution_time_ms: 0.85,
            nodes_affected: 1,
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

  // Enter dashboard transition from Hero
  const handleEnterDashboard = (scenarioId?: string) => {
    setViewMode("dashboard");
    if (scenarioId) {
      const sc = DEFAULT_SCENARIOS.find((s) => s.id === scenarioId);
      if (sc) {
        setTimeout(() => {
          handleTriggerInvestigation(sc.suggested_query, sc.id);
        }, 350);
      }
    }
  };

  // Trigger chaos failure injection
  const handleTriggerChaos = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chaos/inject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_service: "payment-engine" }),
      });
      if (res.ok) {
        fetchGraphTopology(activeGraph);
        handleTriggerInvestigation("ALERT: High Latency and Connection Pool Starvation detected on payment-engine");
      }
    } catch (e) {
      console.warn("Chaos injection failed, triggering local alert simulation:", e);
      handleTriggerInvestigation("ALERT: High Latency and Connection Pool Starvation detected on payment-engine");
    }
  };

  return (
    <div className="relative h-screen w-screen bg-[#050508] text-slate-100 overflow-hidden font-sans flex">
      {/* ── 0. HERO SCREEN OVERLAY / STAGE ───────────────────────── */}
      <div
        className={`absolute inset-0 z-30 overflow-y-auto transition-all duration-500 ease-out ${
          viewMode === "hero"
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <HeroScreen
          onEnterDashboard={handleEnterDashboard}
          falkorConnected={falkorConnected}
        />
      </div>

      {/* ── 1. MAIN MISSION CONTROL OPS CENTER (NetWatch Layout) ─── */}
      <div
        className={`flex h-full w-full transition-all duration-500 ease-out ${
          viewMode === "dashboard"
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-105 pointer-events-none"
        }`}
      >
        {/* Left Navigation Rail (NetWatch style) */}
        <SwarmSidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            if (tab === "cypher" || tab === "benchmarks") {
              setIsConsoleOpen(true);
            }
          }}
          onBackToHero={() => setViewMode("hero")}
          onTriggerChaos={handleTriggerChaos}
          onResetSeed={handleResetSeed}
          activeGraph={activeGraph}
          isSeeding={isSeeding}
        />

        {/* Right Main Stage: TopBar + Operational Workspace */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#0A0A0E]">
          {/* Top Command Bar */}
          <SwarmTopBar
            activeGraph={activeGraph}
            onSelectGraph={handleSelectGraph}
            onOpenConsole={() => setIsConsoleOpen(true)}
            nodeCount={nodes.length}
            edgeCount={edges.length}
            falkorConnected={falkorConnected}
            onSearchQuery={(q) => handleTriggerInvestigation(q)}
          />

          {/* Operational Viewports */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 min-h-0 overflow-hidden">
            {/* Left Pane (5 Cols): 1-Click Scenarios + Agent Trace Panel */}
            <div className="lg:col-span-5 flex flex-col gap-3 min-h-0 h-full overflow-hidden">
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
        </div>

        {/* Architecture Tools Drawer (Benchmarks, openCypher REPL, Chaos) */}
        <CypherConsole
          isOpen={isConsoleOpen}
          onClose={() => setIsConsoleOpen(false)}
          activeGraphName={activeGraph}
          onRefreshGraph={() => fetchGraphTopology(activeGraph)}
        />
      </div>
    </div>
  );
}
