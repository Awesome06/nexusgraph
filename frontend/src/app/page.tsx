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
    description: "Isolates commit 8f92a1c violating ADR-002, traces 4-hop blast radius to api-gateway, and rolls back.",
    trigger_type: "ALERT",
    suggested_query: "Investigate API Gateway Latency Spike and isolate breaking change",
    track_focus: ["Track 01 (Connected Data)", "Track 02 (Coordination)", "Track 03 (Company Brain)"],
  },
  {
    id: "scenario-bus-factor-audit",
    title: "2. Bus Factor & ADR Governance Audit",
    description: "Analyzes in-degree centrality and detects single-point-of-failure services (fraud-scorer Bus Factor = 1).",
    trigger_type: "QUERY",
    suggested_query: "Audit organizational bus factor and check active ADR compliance",
    track_focus: ["Track 01 (Centrality)", "Track 03 (Company Brain)"],
  },
  {
    id: "scenario-memory-recall",
    title: "3. Cross-Session Procedural Memory",
    description: "Recalls prior incident INC-2025-104 from procedural_memory to verify runbook fix before execution.",
    trigger_type: "MEMORY",
    suggested_query: "Query procedural memory for cascading timeout remediation runbooks",
    track_focus: ["Track 02 (Agent Memory)"],
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
    const url = `${API_BASE}/api/investigate/stream?query=${encodeURIComponent(
      query
    )}&session_id=${sessionId}&target_service=payment-engine`;

    const eventSource = new EventSource(url);

    eventSource.onmessage = (e) => {
      try {
        const eventData: AgentStepEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, eventData]);
        setCurrentAgent(eventData.agent);
        setActiveStage(eventData.stage);

        // If subgraph with highlight IDs returned, illuminate traversal path on graph canvas
        if (eventData.subgraph?.highlight_path && eventData.subgraph.highlight_path.length > 0) {
          setHighlightIds((prev) => {
            const set = new Set([...prev, ...eventData.subgraph.highlight_path]);
            return Array.from(set);
          });
        }

        // When executor completes, refresh graph state to reflect 'HEALTHY' mutation
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
      // If backend SSE fails (e.g. offline dev test), generate deterministic client demo simulation
      if (events.length === 0) {
        runClientFallbackDemo(query, sessionId);
      }
    };
  };

  // Fallback demo simulation if backend is offline during browser preview
  const runClientFallbackDemo = (query: string, sessionId: string) => {
    const simulatedSteps: AgentStepEvent[] = [
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

    setHighlightIds(["payment-engine", "api-gateway", "ledger-db", "8f92a1c", "Arjun Mehta", "ADR-002"]);

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
    <div className="flex flex-col h-screen w-screen bg-[#080b11] text-slate-100 overflow-hidden font-sans">
      {/* 1. Top Bar: Multigraph Inspector & Brand */}
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

      {/* 2. Main Split-Screen Workspace */}
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

        {/* Right Pane (7 Cols): Live FalkorDB Graph Canvas */}
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
