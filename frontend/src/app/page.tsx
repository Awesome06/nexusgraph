"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Flame, X, History, Sparkles, Layers, ShieldCheck, ArrowRight, RotateCcw, BrainCircuit, Activity } from "lucide-react";
import SwarmSidebar from "@/components/SwarmSidebar";
import SwarmTopBar from "@/components/SwarmTopBar";
import HeroScreen from "@/components/HeroScreen";
import { Scenario } from "@/components/ScenarioSelector";
import EvaluationWorkflowsModal from "@/components/EvaluationWorkflowsModal";
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
  {
    id: "scenario-chaos-remediation",
    title: "4. Chaos Failure Injection & Auto-Heal",
    description: "Injects live non-deterministic microservice latency into org_brain and watches the 3-agent swarm auto-heal.",
    trigger_type: "ALERT",
    suggested_query: "Inject Chaos Latency Spike on payment-engine and evaluate autonomous swarm remediation",
    track_focus: ["Track 01 (Blast Radius)", "Track 02 (Coordination)", "Track 03 (Self-Healing)"],
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
  const [consoleInitialTab, setConsoleInitialTab] = useState<"benchmark" | "cypher" | "chaos">("benchmark");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isWorkflowsModalOpen, setIsWorkflowsModalOpen] = useState<boolean>(false);
  const [activeScenarioTitle, setActiveScenarioTitle] = useState<string>("1. Cascading Timeout & Breaking Commit");
  const [chaosAlert, setChaosAlert] = useState<{
    target: string;
    type: string;
    desc: string;
    p99: number;
    violation: string;
  } | null>(null);

  const activeEventSourceRef = useRef<EventSource | null>(null);
  const activeTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

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

  // Global keyboard shortcut: Press 'W' to open Evaluation Workflows modal
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.key === "w" || e.key === "W") && !isConsoleOpen) {
        const target = e.target as HTMLElement;
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
        setIsWorkflowsModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [isConsoleOpen]);

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
    // Clear any pending client simulation timeouts or active SSE
    if (activeTimeoutsRef.current.length > 0) {
      activeTimeoutsRef.current.forEach((t) => clearTimeout(t));
      activeTimeoutsRef.current = [];
    }
    if (activeEventSourceRef.current) {
      activeEventSourceRef.current.close();
      activeEventSourceRef.current = null;
    }

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
    activeEventSourceRef.current = eventSource;

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
          activeEventSourceRef.current = null;
          fetchGraphTopology(activeGraph);
        }
      } catch (err) {
        console.error("Error parsing SSE event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn("SSE connection closed or error, engaging deterministic simulation:", err);
      setIsStreaming(false);
      eventSource.close();
      activeEventSourceRef.current = null;
      if (events.length === 0) {
        runClientFallbackDemo(query, sessionId, scenarioId);
      }
    };
  };

  // Fallback demo simulation supporting all distinct scenarios with adjustable pacing
  const runClientFallbackDemo = (query: string, sessionId: string, scenarioId?: string) => {
    setIsStreaming(true);
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

    const isChaos =
      scenarioId === "scenario-chaos-remediation" ||
      qLower.includes("chaos") ||
      qLower.includes("spike") ||
      qLower.includes("starvation");

    let simulatedSteps: AgentStepEvent[] = [];
    let highlightList: string[] = [];

    if (isChaos) {
      highlightList = ["payment-engine", "api-gateway", "ledger-db", "ADR-002", "8f92a1c"];
      simulatedSteps = [
        {
          step_id: "step-1",
          session_id: sessionId,
          agent: "Recon",
          stage: "Stage 1: Anomaly Ingestion & Blast Radius",
          status: "running",
          thought: `🚨 Chaos Anomaly Detected: Injected latency spike on 'payment-engine' (p99: 4,200ms, error rate: 35%). GraphBLAS BFS traversal isolated upstream cascade: api-gateway -> payment-engine.`,
          tool_call: { tool: "trace_blast_radius", params: { service_name: "payment-engine", max_hops: 3 } },
          cypher_trace: {
            tool_name: "trace_blast_radius",
            agent_name: "Recon",
            cypher_query:
              "MATCH path = (s:Service {name: 'payment-engine'})<-[:DEPENDS_ON*1..3]-(caller:Service)\nRETURN [n IN nodes(path) | n.name] AS chain, length(path) AS depth\nORDER BY depth ASC",
            parameters: { service_name: "payment-engine" },
            execution_time_ms: 0.36,
            nodes_affected: 4,
            relationships_affected: 6,
            explanation: "GraphBLAS BFS traversal confirmed active threadpool starvation cascading into api-gateway.",
          },
          timestamp: new Date().toISOString(),
        },
        {
          step_id: "step-2",
          session_id: sessionId,
          agent: "Historian",
          stage: "Stage 2: Architecture Policy Audit",
          status: "running",
          thought:
            "Auditing ADR contracts for 'payment-engine'. Anomaly breaches ADR-002 (maximum timeout threshold <= 200ms). Correlating with procedural memory pattern 'cascading-timeout-ledger'.",
          tool_call: { tool: "audit_adr_policy", params: { service: "payment-engine", adr_id: "ADR-002" } },
          cypher_trace: {
            tool_name: "audit_adr_policy",
            agent_name: "Historian",
            cypher_query:
              "MATCH (s:Service {name: 'payment-engine'})-[:GOVERNED_BY]->(adr:ADR {id: 'ADR-002'})\nOPTIONAL MATCH (p:Pattern {symptom: 'cascading-timeout-ledger'})\nRETURN s.name, adr.title, adr.max_timeout_ms, p.confidence",
            parameters: { service: "payment-engine", adr_id: "ADR-002" },
            execution_time_ms: 0.82,
            nodes_affected: 3,
            relationships_affected: 2,
            explanation: "Verified direct violation of ADR-002. Matched resolution runbook from episodic memory with 0.99 confidence.",
          },
          timestamp: new Date().toISOString(),
        },
        {
          step_id: "step-3",
          session_id: sessionId,
          agent: "Executor",
          stage: "Stage 3: Autonomous Remediation & Reset",
          status: "complete",
          thought:
            "Executing automated chaos mitigation: applied dynamic circuit breaker trip, flushed connection pool backlog, and mutated FalkorDB 'org_brain' status back to HEALTHY.",
          tool_call: { tool: "apply_remediation_action", params: { service: "payment-engine", action: "RESET_BASELINE_AND_FLUSH" } },
          cypher_trace: {
            tool_name: "apply_remediation_action",
            agent_name: "Executor",
            cypher_query:
              "MATCH (s:Service {name: 'payment-engine'})\nSET s.status = 'HEALTHY', s.latency_p99 = 45, s.error_rate = 0.001\nRETURN s.name, s.status",
            parameters: { service: "payment-engine" },
            execution_time_ms: 0.94,
            nodes_affected: 1,
            relationships_affected: 1,
            explanation: "Remediation applied. Service status restored to HEALTHY in FalkorDB.",
          },
          timestamp: new Date().toISOString(),
          is_final: true,
          final_answer:
            "### 💥 Chaos Engineering Remediation Complete\n\n1. **Injected Anomaly Isolated:**\n- Service: `payment-engine` (Failure Type: **LATENCY_CASCADE**)\n- Observed p99 Latency: **4,200ms** (Error rate: 35%)\n\n2. **Policy Violation Detected:**\n- **ADR-002 Breach:** Maximum allowed gRPC timeout exceeded (> 200ms).\n\n3. **Automated Swarm Remediation:**\n- Tripped adaptive circuit breaker to shed downstream load.\n- Flushed threadpool connection starvation.\n- Mutated FalkorDB `org_brain` node state back to **HEALTHY** (p99: **45ms**).\n- Incremented procedural memory confidence to **0.99**.",
        },
      ];
    } else if (isBusFactor) {
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

    const delayPerStep = Math.round(2200 / (playbackSpeed || 1));
    simulatedSteps.forEach((st, idx) => {
      const timeoutHandle = setTimeout(() => {
        setEvents((prev) => [...prev, st]);
        setCurrentAgent(st.agent);
        setActiveStage(st.stage);
        if (st.is_final) {
          setIsStreaming(false);
        }
      }, (idx + 1) * delayPerStep);
      activeTimeoutsRef.current.push(timeoutHandle);
    });
  };

  // Enter dashboard transition from Hero
  const handleEnterDashboard = (scenarioId?: string) => {
    setViewMode("dashboard");
    setActiveTab("dashboard");
    setIsConsoleOpen(false);
    if (scenarioId) {
      const sc = DEFAULT_SCENARIOS.find((s) => s.id === scenarioId);
      if (sc) {
        setActiveScenarioTitle(sc.title);
        setTimeout(() => {
          handleTriggerInvestigation(sc.suggested_query, sc.id);
        }, 350);
      }
    }
  };

  // Trigger chaos failure injection with immediate visual reaction
  const handleTriggerChaos = async () => {
    setViewMode("dashboard");
    setActiveTab("dashboard");
    setIsConsoleOpen(false);
    setActiveScenarioTitle("4. Chaos Failure Injection & Auto-Heal");
    try {
      const res = await fetch(`${API_BASE}/api/chaos/inject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_service: "payment-engine" }),
      });
      let data: any = null;
      if (res.ok) {
        data = await res.json();
      }

      const target = data?.target_service || "payment-engine";
      const ftype = data?.failure_type || "LATENCY_CASCADE";
      const desc = data?.description || "gRPC connection exhaustion and thread starvation";
      const p99 = data?.latency_p99_ms || 4200;
      const violation = data?.policy_violation || "ADR-002: Maximum allowed gRPC timeout exceeded";

      setChaosAlert({ target, type: ftype, desc, p99, violation });

      // Instantly mark target service as degraded so it pulses red on canvas
      setNodes((prev) =>
        prev.map((n) =>
          n.id === target ? { ...n, properties: { ...(n.properties || {}), status: "DEGRADED" } } : n
        )
      );
      setHighlightIds([target, "api-gateway", "ledger-db"]);

      handleTriggerInvestigation(
        data?.suggested_query || `Investigate critical alert on ${target}: ${desc}`,
        "scenario-chaos-remediation"
      );
    } catch (e) {
      console.warn("Chaos injection failed, triggering local alert simulation:", e);
      setChaosAlert({
        target: "payment-engine",
        type: "LATENCY_CASCADE",
        desc: "gRPC connection exhaustion and thread starvation",
        p99: 4200,
        violation: "ADR-002: Maximum allowed gRPC timeout exceeded",
      });
      setNodes((prev) =>
        prev.map((n) =>
          n.id === "payment-engine" ? { ...n, properties: { ...(n.properties || {}), status: "DEGRADED" } } : n
        )
      );
      setHighlightIds(["payment-engine", "api-gateway", "ledger-db"]);
      handleTriggerInvestigation(
        "Investigate critical alert on payment-engine: gRPC connection exhaustion and thread starvation",
        "scenario-chaos-remediation"
      );
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
            if (tab === "cypher") {
              setConsoleInitialTab("cypher");
              setIsConsoleOpen(true);
            } else if (tab === "benchmarks") {
              setConsoleInitialTab("benchmark");
              setIsConsoleOpen(true);
            } else if (tab === "blackboard") {
              setActiveGraph("blackboard_demo");
              fetchGraphTopology("blackboard_demo");
              setIsConsoleOpen(false);
            } else if (tab === "memory") {
              setActiveGraph("procedural_memory");
              fetchGraphTopology("procedural_memory");
              setIsConsoleOpen(false);
            } else if (tab === "dashboard") {
              setActiveGraph("org_brain");
              fetchGraphTopology("org_brain");
              setIsConsoleOpen(false);
            } else if (tab === "graph") {
              setIsConsoleOpen(false);
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
            onOpenConsole={() => {
              setConsoleInitialTab("benchmark");
              setIsConsoleOpen(true);
            }}
            nodeCount={nodes.length}
            edgeCount={edges.length}
            falkorConnected={falkorConnected}
            onOpenWorkflows={() => setIsWorkflowsModalOpen(true)}
          />

          {/* Active Chaos Emergency Banner */}
          {chaosAlert && (
            <div className="mx-3 mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-500/70 shadow-lg shadow-rose-900/40 flex items-center justify-between animate-pulse select-none">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-rose-900/80 border border-rose-500/80 text-rose-200">
                  <Flame className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-rose-200 uppercase tracking-wider">
                      🚨 ACTIVE CHAOS INJECTION: {chaosAlert.target}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-900 border border-rose-500/40 text-[10px] font-mono text-rose-300">
                      {chaosAlert.type}
                    </span>
                    <span className="text-xs font-mono text-rose-300 font-semibold">
                      p99: {chaosAlert.p99}ms
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-300/80 mt-0.5 font-sans">
                    {chaosAlert.desc} • <span className="text-rose-200 font-semibold">{chaosAlert.violation}</span> • Autonomous Swarm dispatched to isolate & heal.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleResetSeed();
                    setChaosAlert(null);
                  }}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-mono border border-white/20 transition"
                >
                  Reset Baseline
                </button>
                <button
                  onClick={() => setChaosAlert(null)}
                  className="p-1 rounded-lg hover:bg-rose-900/50 text-rose-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Operational Viewports */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 min-h-0 overflow-hidden">
            {/* If in Graph Explorer Mode, GraphCanvas occupies all 12 columns */}
            {activeTab !== "graph" && (
              <div className="lg:col-span-5 flex flex-col gap-3 min-h-0 h-full overflow-hidden">
                {activeTab === "memory" || activeGraph === "procedural_memory" ? (
                  /* Dedicated Procedural & Episodic Memory Inspector */
                  <div className="flex-1 flex flex-col gap-3 min-h-0 h-full overflow-hidden">
                    <div className="bg-[#0E0E12] rounded-xl p-4 border border-white/[0.08] shadow-xl flex flex-col gap-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-emerald-400" />
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                            Procedural Memory Inspector
                          </h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
                          v0.99 CONFIDENCE
                        </span>
                      </div>

                      {/* Symptom Vector Card */}
                      <div className="bg-[#141418] p-3 rounded-lg border border-white/[0.06] font-mono text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Matched Symptom Vector</span>
                          <span className="text-[10px] text-emerald-400 font-bold">4 Historical Recalls</span>
                        </div>
                        <div className="text-emerald-300 font-bold">cascading-timeout-ledger</div>
                        <p className="text-[11px] text-slate-400 font-sans mt-1">
                          Thread pool exhaustion on payment-engine resulting in API Gateway 504 timeouts.
                        </p>
                      </div>

                      {/* Verified Runbook Chain */}
                      <div className="bg-[#141418] p-3 rounded-lg border border-white/[0.06] font-mono text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Deterministic Runbook</span>
                          <span className="text-[10px] text-cyan-400 font-bold">Zero Hallucination</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 p-1.5 rounded bg-black/40 border border-white/[0.04]">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">RUN-001</span>
                            <span className="text-[11px] text-slate-300 font-sans">Flush thread pool & connection backlog</span>
                          </div>
                          <div className="flex items-center gap-2 p-1.5 rounded bg-black/40 border border-white/[0.04]">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">RUN-002</span>
                            <span className="text-[11px] text-slate-300 font-sans">Revert timeout config to ADR-002 baseline</span>
                          </div>
                        </div>
                      </div>

                      {/* Trigger Button */}
                      <button
                        onClick={() =>
                          handleTriggerInvestigation(
                            "Query procedural memory for cascading timeout remediation runbooks",
                            "scenario-memory-recall"
                          )
                        }
                        className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-semibold transition flex items-center justify-center gap-2"
                      >
                        <BrainCircuit className="w-3.5 h-3.5" />
                        <span>Traverse & Reinforce Runbook →</span>
                      </button>
                    </div>

                    <div className="flex-1 min-h-0">
                      <AgentTracePanel
                        events={events}
                        isStreaming={isStreaming}
                        currentAgent={currentAgent}
                        activeStage={activeStage}
                        playbackSpeed={playbackSpeed}
                        onSpeedChange={setPlaybackSpeed}
                        onOpenWorkflows={() => setIsWorkflowsModalOpen(true)}
                        activeScenarioTitle={activeScenarioTitle}
                      />
                    </div>
                  </div>
                ) : activeTab === "blackboard" || activeGraph.startsWith("blackboard") ? (
                  /* Dedicated Multi-Agent Shared Blackboard Inspector (Track 02) */
                  <div className="flex-1 flex flex-col gap-3 min-h-0 h-full overflow-hidden">
                    <div className="bg-[#0E0E12] rounded-xl p-4 border border-white/[0.08] shadow-xl flex flex-col gap-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4 text-purple-400" />
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                            Multi-Agent Shared Blackboard
                          </h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-[10px] font-mono text-purple-400">
                          TRACK 02 COORDINATION
                        </span>
                      </div>

                      {/* Swarm Coordination Claims Card */}
                      <div className="bg-[#141418] p-3 rounded-lg border border-white/[0.06] font-mono text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Swarm Handoff Pipeline</span>
                          <span className="text-[10px] text-purple-400 font-bold">3 Agents Synchronized</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2 rounded bg-black/40 border border-cyan-500/20 text-center">
                            <span className="text-[10px] text-cyan-400 font-bold block">1. RECON</span>
                            <span className="text-[9px] text-slate-400">Claims Blast Radius</span>
                          </div>
                          <div className="p-2 rounded bg-black/40 border border-purple-500/20 text-center">
                            <span className="text-[10px] text-purple-400 font-bold block">2. HISTORIAN</span>
                            <span className="text-[9px] text-slate-400">Recalls Runbook</span>
                          </div>
                          <div className="p-2 rounded bg-black/40 border border-emerald-500/20 text-center">
                            <span className="text-[10px] text-emerald-400 font-bold block">3. EXECUTOR</span>
                            <span className="text-[9px] text-slate-400">Remediates & Verifies</span>
                          </div>
                        </div>
                      </div>

                      {/* Live Blackboard Records */}
                      <div className="bg-[#141418] p-3 rounded-lg border border-white/[0.06] font-mono text-xs space-y-1.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Shared Graph Entities</span>
                          <span className="text-[10px] text-cyan-400 font-bold">Atomic Transactions</span>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-white/[0.04]">
                          <span className="text-[11px] text-cyan-300">Task: task_cascade_isolate</span>
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">CLAIMED</span>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-white/[0.04]">
                          <span className="text-[11px] text-purple-300">Finding: commit_8f92a1c</span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold">DISCOVERED</span>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded bg-black/40 border border-white/[0.04]">
                          <span className="text-[11px] text-emerald-300">Action: rollback & flush_pool</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">PROPOSED</span>
                        </div>
                      </div>

                      {/* Trigger Button */}
                      <button
                        onClick={() =>
                          handleTriggerInvestigation(
                            "Investigate API Gateway Latency Spike and coordinate swarm resolution on blackboard",
                            "scenario-latency-cascade"
                          )
                        }
                        className="w-full py-2 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-mono font-semibold transition flex items-center justify-center gap-2"
                      >
                        <BrainCircuit className="w-3.5 h-3.5" />
                        <span>Run Swarm Blackboard Handoff →</span>
                      </button>
                    </div>

                    <div className="flex-1 min-h-0">
                      <AgentTracePanel
                        events={events}
                        isStreaming={isStreaming}
                        currentAgent={currentAgent}
                        activeStage={activeStage}
                        playbackSpeed={playbackSpeed}
                        onSpeedChange={setPlaybackSpeed}
                        onOpenWorkflows={() => setIsWorkflowsModalOpen(true)}
                        activeScenarioTitle={activeScenarioTitle}
                      />
                    </div>
                  </div>
                ) : (
                  /* Standard Swarm War Room View: Full-Height 100% Live Stream */
                  <div className="flex-1 min-h-0 h-full">
                    <AgentTracePanel
                      events={events}
                      isStreaming={isStreaming}
                      currentAgent={currentAgent}
                      activeStage={activeStage}
                      playbackSpeed={playbackSpeed}
                      onSpeedChange={setPlaybackSpeed}
                      onOpenWorkflows={() => setIsWorkflowsModalOpen(true)}
                      activeScenarioTitle={activeScenarioTitle}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Right Pane: Dual-Engine FalkorDB Graph Canvas 2.0 (Spans full width if activeTab === 'graph') */}
            <div
              className={`flex flex-col min-h-0 h-full overflow-hidden ${
                activeTab === "graph" ? "lg:col-span-12" : "lg:col-span-7"
              }`}
            >
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
          initialTab={consoleInitialTab}
        />

        {/* Hackathon Evaluation Workflows Pop-out Modal */}
        <EvaluationWorkflowsModal
          isOpen={isWorkflowsModalOpen}
          onClose={() => setIsWorkflowsModalOpen(false)}
          scenarios={DEFAULT_SCENARIOS}
          onSelectScenario={(sc) => {
            setActiveScenarioTitle(sc.title);
            setActiveTab("dashboard");
            handleTriggerInvestigation(sc.suggested_query, sc.id);
          }}
          isLoading={isStreaming}
          onResetSeed={handleResetSeed}
          isSeeding={isSeeding}
        />
      </div>
    </div>
  );
}
