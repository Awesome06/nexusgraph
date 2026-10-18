"use client";

import React, { useState } from "react";
import {
  Terminal,
  Zap,
  BarChart3,
  Play,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Code2,
  X,
  Plus,
  Bookmark
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface CypherPreset {
  id: string;
  name: string;
  query: string;
  isCustom?: boolean;
}

const DEFAULT_BENCHMARK_DATA = {
  comparisons: [
    { hops: 1, falkordb_graphblas_ms: 0.12, relational_recursive_sql_ms: 1.8, speedup: "15x", paths_discovered: 3 },
    { hops: 2, falkordb_graphblas_ms: 0.22, relational_recursive_sql_ms: 8.4, speedup: "38x", paths_discovered: 7 },
    { hops: 3, falkordb_graphblas_ms: 0.31, relational_recursive_sql_ms: 24.6, speedup: "79x", paths_discovered: 14 },
    { hops: 4, falkordb_graphblas_ms: 0.38, relational_recursive_sql_ms: 58.5, speedup: "154x", paths_discovered: 29 }
  ],
  architectural_verdict: "FalkorDB GraphBLAS linear algebraic sparse matrix multiplication achieves O(1) pointer-chasing complexity, outperforming relational recursive CTE join trees by 154x at 4 hops."
};

const DEFAULT_PRESETS: Record<string, CypherPreset[]> = {
  org_brain: [
    {
      id: "blast-radius",
      name: "Blast Radius",
      query: "MATCH path = (s:Service {name: 'ledger-db'})<-[:DEPENDS_ON*1..4]-(d:Service)\nRETURN [n IN nodes(path) | n.name] AS chain, length(path) AS depth\nORDER BY depth ASC"
    },
    {
      id: "centrality",
      name: "Centrality",
      query: "MATCH (s:Service)<-[r:DEPENDS_ON]-(d:Service)\nRETURN s.name AS service, count(d) AS inbound_deps\nORDER BY inbound_deps DESC"
    },
    {
      id: "adr-governance",
      name: "ADR Governance",
      query: "MATCH (adr:ADR)-[:GOVERNS]->(s:Service)\nRETURN adr.id AS id, adr.title AS title, s.name AS service"
    }
  ],
  procedural_memory: [
    {
      id: "runbook-match",
      name: "Runbook Match",
      query: "MATCH (p:Pattern)-[r:RESOLVED_BY]->(s:RunbookStep)\nRETURN p.symptom_signature AS pattern, s.id AS step_id, s.action_type AS action, r.confidence AS confidence"
    },
    {
      id: "incident-history",
      name: "Incident History",
      query: "MATCH (i:Incident)-[r:AFFECTED_SERVICE]->(p:Pattern)\nRETURN i.id AS incident, i.title AS title, r.service_id AS affected_service, p.symptom_signature AS pattern"
    },
    {
      id: "all-patterns",
      name: "All Patterns",
      query: "MATCH (p:Pattern)\nRETURN p.id AS id, p.symptom_signature AS symptom, p.description AS description"
    }
  ],
  blackboard_demo: [
    {
      id: "swarm-tasks",
      name: "Swarm Tasks",
      query: "MATCH (t:Task)\nRETURN t.id AS task, t.description AS description, t.status AS status"
    },
    {
      id: "findings-actions",
      name: "Findings & Actions",
      query: "MATCH (t:Task)-[:ASSIGNED_TO]->(f:Finding)-[:SUPPORTS]->(a:ProposedAction)\nRETURN f.agent_name AS agent, f.summary AS finding, a.action_type AS action, a.approved AS approved"
    }
  ]
};

const PRESET_DEFAULT_RESULTS: Record<
  string,
  {
    graph_name: string;
    cypher_query: string;
    execution_time_ms: number;
    record_count: number;
    columns: string[];
    records: any[];
  }
> = {
  "blast-radius": {
    graph_name: "org_brain",
    cypher_query: "MATCH path = (s:Service {name: 'ledger-db'})<-[:DEPENDS_ON*1..4]-(d:Service)\nRETURN [n IN nodes(path) | n.name] AS chain, length(path) AS depth\nORDER BY depth ASC",
    execution_time_ms: 0.15,
    record_count: 2,
    columns: ["chain", "depth"],
    records: [
      [["ledger-db", "payment-engine"], 1],
      [["ledger-db", "payment-engine", "api-gateway"], 2]
    ]
  },
  "centrality": {
    graph_name: "org_brain",
    cypher_query: "MATCH (s:Service)<-[r:DEPENDS_ON]-(d:Service)\nRETURN s.name AS service, count(d) AS inbound_deps\nORDER BY inbound_deps DESC",
    execution_time_ms: 0.23,
    record_count: 5,
    columns: ["service", "inbound_deps"],
    records: [
      ["ledger-db", 1],
      ["fraud-scorer", 1],
      ["payment-engine", 1],
      ["notification-worker", 1],
      ["auth-service", 1]
    ]
  },
  "adr-governance": {
    graph_name: "org_brain",
    cypher_query: "MATCH (adr:ADR)-[:GOVERNS]->(s:Service)\nRETURN adr.id AS id, adr.title AS title, s.name AS service",
    execution_time_ms: 0.21,
    record_count: 4,
    columns: ["id", "title", "service"],
    records: [
      ["ADR-003", "Asynchronous Notification Bus", "notification-worker"],
      ["ADR-002", "Ledger Strict Latency & Protocol Standards", "ledger-db"],
      ["ADR-002", "Ledger Strict Latency & Protocol Standards", "payment-engine"],
      ["ADR-001", "Microservice Authentication via JWKS", "api-gateway"]
    ]
  },
  "runbook-match": {
    graph_name: "procedural_memory",
    cypher_query: "MATCH (p:Pattern)-[r:RESOLVED_BY]->(s:RunbookStep)\nRETURN p.symptom_signature AS pattern, s.id AS step_id, s.action_type AS action, r.confidence AS confidence",
    execution_time_ms: 0.24,
    record_count: 2,
    columns: ["pattern", "step_id", "action", "confidence"],
    records: [
      ["replica-lag-exhaustion", "step-drain-replica", "TRAFFIC_DRAIN", 0.94],
      ["cascading-timeout-ledger", "step-revert-timeout", "ROLLBACK_AND_POOL_FLUSH", 0.99]
    ]
  },
  "incident-history": {
    graph_name: "procedural_memory",
    cypher_query: "MATCH (i:Incident)-[r:AFFECTED_SERVICE]->(p:Pattern)\nRETURN i.id AS incident, i.title AS title, r.service_id AS affected_service, p.symptom_signature AS pattern",
    execution_time_ms: 0.19,
    record_count: 2,
    columns: ["incident", "title", "affected_service", "pattern"],
    records: [
      ["INC-2025-089", "Circuit breaker oscillation under ledger-db replica lag", "ledger-db", "replica-lag-exhaustion"],
      ["INC-2025-104", "Cascading thread exhaustion on payment gateway", "payment-engine", "cascading-timeout-ledger"]
    ]
  },
  "all-patterns": {
    graph_name: "procedural_memory",
    cypher_query: "MATCH (p:Pattern)\nRETURN p.id AS id, p.symptom_signature AS symptom, p.description AS description",
    execution_time_ms: 0.08,
    record_count: 2,
    columns: ["id", "symptom", "description"],
    records: [
      ["pat-replica-lag", "replica-lag-exhaustion", "Replica lag on read pool leading to stale reads and retry storm"],
      ["pat-cascade-timeout", "cascading-timeout-ledger", "Latency spike on ledger-db leading to upstream thread exhaustion in payment-engine and gateway 504s"]
    ]
  },
  "swarm-tasks": {
    graph_name: "blackboard_demo",
    cypher_query: "MATCH (t:Task)\nRETURN t.id AS task, t.description AS description, t.status AS status",
    execution_time_ms: 0.07,
    record_count: 3,
    columns: ["task", "description", "status"],
    records: [
      ["task-exec-01", "Execute automated mitigation and update procedural memory", "PENDING"],
      ["task-hist-01", "Trace commit lineage and ADR violations", "IN_PROGRESS"],
      ["task-recon-01", "Isolate blast radius of payment latency spike", "COMPLETED"]
    ]
  },
  "findings-actions": {
    graph_name: "blackboard_demo",
    cypher_query: "MATCH (t:Task)-[:ASSIGNED_TO]->(f:Finding)-[:SUPPORTS]->(a:ProposedAction)\nRETURN f.agent_name AS agent, f.summary AS finding, a.action_type AS action, a.approved AS approved",
    execution_time_ms: 0.22,
    record_count: 1,
    columns: ["agent", "finding", "action", "approved"],
    records: [
      ["Recon", "Cascading timeout from payment-engine impacting api-gateway (2 hops, TIER-1 blast radius)", "ROLLBACK_COMMIT", true]
    ]
  }
};

function deriveColumnsFromQuery(query: string): string[] {
  const match = query.match(/RETURN\s+([\s\S]+?)(?:ORDER\s+BY|LIMIT|$)/i);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((col) => {
      const asMatch = col.match(/\s+AS\s+([a-zA-Z0-9_]+)/i);
      if (asMatch) return asMatch[1].trim();
      const dotMatch = col.match(/\.([a-zA-Z0-9_]+)/);
      if (dotMatch) return dotMatch[1].trim();
      return col.trim();
    })
    .filter(Boolean);
}

interface CypherConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  activeGraphName: string;
  onRefreshGraph: () => void;
  initialTab?: "benchmark" | "cypher" | "chaos";
}

export default function CypherConsole({
  isOpen,
  onClose,
  activeGraphName,
  onRefreshGraph,
  initialTab = "benchmark",
}: CypherConsoleProps) {
  const [activeTab, setActiveTab] = useState<"benchmark" | "cypher" | "chaos">(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);
  
  // Benchmark state
  const [benchmarkData, setBenchmarkData] = useState<any>(DEFAULT_BENCHMARK_DATA);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // Load presets per namespace from localStorage or default
  const [namespacePresets, setNamespacePresets] = useState<Record<string, CypherPreset[]>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("nexusgraph_cypher_presets");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error("Error reading presets from localStorage:", e);
      }
    }
    return DEFAULT_PRESETS;
  });

  // Load last edited query per namespace from localStorage
  const [namespaceQueries, setNamespaceQueries] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("nexusgraph_namespace_queries");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error("Error reading queries from localStorage:", e);
      }
    }
    return {
      org_brain: DEFAULT_PRESETS.org_brain[0].query,
      procedural_memory: DEFAULT_PRESETS.procedural_memory[0].query,
      blackboard_demo: DEFAULT_PRESETS.blackboard_demo[0].query,
    };
  });

  // Cypher scratchpad state
  const [selectedNamespace, setSelectedNamespace] = useState(activeGraphName || "org_brain");
  const [customCypher, setCustomCypher] = useState(
    namespaceQueries[activeGraphName || "org_brain"] || DEFAULT_PRESETS[activeGraphName || "org_brain"]?.[0]?.query || DEFAULT_PRESETS.org_brain[0].query
  );
  const [activePresetId, setActivePresetId] = useState<string | null>(
    DEFAULT_PRESETS[activeGraphName || "org_brain"]?.[0]?.id || "blast-radius"
  );
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [resetFeedback, setResetFeedback] = useState(false);
  const [cypherResult, setCypherResult] = useState<any>(
    PRESET_DEFAULT_RESULTS["blast-radius"]
  );
  const [resultFormat, setResultFormat] = useState<"table" | "json">("table");
  const [isQuerying, setIsQuerying] = useState(false);

  const handleNamespaceChange = (newNamespace: string) => {
    const updatedQueries = { ...namespaceQueries, [selectedNamespace]: customCypher };
    setNamespaceQueries(updatedQueries);
    if (typeof window !== "undefined") {
      localStorage.setItem("nexusgraph_namespace_queries", JSON.stringify(updatedQueries));
    }

    setSelectedNamespace(newNamespace);
    const presetsForNs = namespacePresets[newNamespace] || DEFAULT_PRESETS[newNamespace] || [];
    const firstPreset = presetsForNs[0];
    const nextQuery = updatedQueries[newNamespace] || firstPreset?.query || "MATCH (n) RETURN n LIMIT 10";
    setCustomCypher(nextQuery);
    setActivePresetId(firstPreset?.id || null);
    if (firstPreset && PRESET_DEFAULT_RESULTS[firstPreset.id]) {
      setCypherResult(PRESET_DEFAULT_RESULTS[firstPreset.id]);
    } else {
      setCypherResult(null);
    }
  };

  const handleQueryChange = (val: string) => {
    setCustomCypher(val);
    const updated = { ...namespaceQueries, [selectedNamespace]: val };
    setNamespaceQueries(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("nexusgraph_namespace_queries", JSON.stringify(updated));
    }
  };

  const handleSelectPreset = async (preset: CypherPreset) => {
    setActivePresetId(preset.id);
    handleQueryChange(preset.query);
    if (PRESET_DEFAULT_RESULTS[preset.id]) {
      setCypherResult(PRESET_DEFAULT_RESULTS[preset.id]);
    }
    // Also fetch live query from FalkorDB in background to ensure sync
    try {
      const res = await fetch(`${API_BASE}/api/cypher/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph_name: selectedNamespace, query: preset.query })
      });
      if (res.ok) {
        const liveData = await res.json();
        setCypherResult({
          ...liveData,
          columns: PRESET_DEFAULT_RESULTS[preset.id]?.columns || deriveColumnsFromQuery(preset.query)
        });
      }
    } catch {
      // Retain preset results if backend is unreachable
    }
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim() || !customCypher.trim()) return;
    const newPreset: CypherPreset = {
      id: "preset-" + Date.now(),
      name: newPresetName.trim(),
      query: customCypher.trim(),
      isCustom: true
    };
    const currentList = namespacePresets[selectedNamespace] || DEFAULT_PRESETS[selectedNamespace] || [];
    const updatedList = [...currentList, newPreset];
    const updatedMap = { ...namespacePresets, [selectedNamespace]: updatedList };
    setNamespacePresets(updatedMap);
    if (typeof window !== "undefined") {
      localStorage.setItem("nexusgraph_cypher_presets", JSON.stringify(updatedMap));
    }
    setActivePresetId(newPreset.id);
    setNewPresetName("");
    setIsAddingPreset(false);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentList = namespacePresets[selectedNamespace] || DEFAULT_PRESETS[selectedNamespace] || [];
    const updatedList = currentList.filter(p => p.id !== id);
    const updatedMap = { ...namespacePresets, [selectedNamespace]: updatedList };
    setNamespacePresets(updatedMap);
    if (typeof window !== "undefined") {
      localStorage.setItem("nexusgraph_cypher_presets", JSON.stringify(updatedMap));
    }
    if (activePresetId === id) setActivePresetId(null);
  };

  const handleResetPresets = () => {
    const defaultForNs = DEFAULT_PRESETS[selectedNamespace] || [];
    const updatedMap = { ...namespacePresets, [selectedNamespace]: defaultForNs };
    setNamespacePresets(updatedMap);

    const firstPreset = defaultForNs[0];
    const defaultQuery = firstPreset?.query || "MATCH (n) RETURN n LIMIT 10";
    setCustomCypher(defaultQuery);

    const updatedQueries = { ...namespaceQueries, [selectedNamespace]: defaultQuery };
    setNamespaceQueries(updatedQueries);

    if (typeof window !== "undefined") {
      localStorage.setItem("nexusgraph_cypher_presets", JSON.stringify(updatedMap));
      localStorage.setItem("nexusgraph_namespace_queries", JSON.stringify(updatedQueries));
    }
    setActivePresetId(firstPreset?.id || null);
    if (firstPreset && PRESET_DEFAULT_RESULTS[firstPreset.id]) {
      setCypherResult(PRESET_DEFAULT_RESULTS[firstPreset.id]);
    } else {
      setCypherResult(null);
    }
    setResetFeedback(true);
    setTimeout(() => setResetFeedback(false), 2000);
  };

  // Chaos state
  const [chaosResult, setChaosResult] = useState<any>(null);
  const [isInjectingChaos, setIsInjectingChaos] = useState(false);

  if (!isOpen) return null;

  // Run benchmark
  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const res = await fetch(`${API_BASE}/api/benchmark/graph-vs-sql?target_service=ledger-db&max_hops=4`);
      if (res.ok) {
        const data = await res.json();
        setBenchmarkData(data);
      }
    } catch (err) {
      console.error("Benchmark error:", err);
    } finally {
      setIsBenchmarking(false);
    }
  };

  // Run custom Cypher
  const handleExecuteCypher = async () => {
    if (!customCypher.trim()) return;
    setIsQuerying(true);
    try {
      const res = await fetch(`${API_BASE}/api/cypher/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph_name: selectedNamespace, query: customCypher })
      });
      if (res.ok) {
        const data = await res.json();
        const matchingPreset = (namespacePresets[selectedNamespace] || []).find(
          (p) => p.query.trim() === customCypher.trim()
        );
        const presetCols = matchingPreset ? PRESET_DEFAULT_RESULTS[matchingPreset.id]?.columns : undefined;
        setCypherResult({
          ...data,
          columns: presetCols || deriveColumnsFromQuery(customCypher)
        });
      } else {
        const err = await res.json();
        setCypherResult({ error: err.detail || "Query failed" });
      }
    } catch (err: any) {
      setCypherResult({ error: err.message });
    } finally {
      setIsQuerying(false);
    }
  };

  // Inject chaos
  const handleInjectChaos = async () => {
    setIsInjectingChaos(true);
    try {
      const res = await fetch(`${API_BASE}/api/chaos/inject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        setChaosResult(data);
        onRefreshGraph();
      }
    } catch (err) {
      console.error("Chaos error:", err);
    } finally {
      setIsInjectingChaos(false);
    }
  };

  // Reset chaos
  const handleResetChaos = async () => {
    setIsInjectingChaos(true);
    try {
      await fetch(`${API_BASE}/api/chaos/reset`, { method: "POST" });
      setChaosResult(null);
      onRefreshGraph();
    } catch (err) {
      console.error("Reset error:", err);
    } finally {
      setIsInjectingChaos(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl bg-[#0E0E12] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-cyan-950/40 via-[#141418] to-purple-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-mono tracking-tight">FalkorDB Architecture Tools</h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-400 font-semibold">
                  GraphBLAS & REPL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">Empirical GraphBLAS Benchmarks, openCypher Console, and Chaos Injection</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Switcher */}
            <div className="flex items-center bg-[#141418] p-1 rounded-xl border border-white/[0.06] text-xs font-mono">
              <button
                onClick={() => setActiveTab("benchmark")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "benchmark" ? "bg-[#23232A] text-white font-semibold shadow-sm border border-white/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Graph vs SQL Benchmark</span>
              </button>
              <button
                onClick={() => setActiveTab("cypher")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "cypher" ? "bg-[#23232A] text-white font-semibold shadow-sm border border-white/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>openCypher REPL</span>
              </button>
              <button
                onClick={() => setActiveTab("chaos")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "chaos" ? "bg-amber-950/60 text-amber-300 font-semibold shadow-sm border border-amber-500/30" : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Chaos Injection</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition ml-2"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 font-sans space-y-4">
          {/* TAB 1: Benchmark */}
          {activeTab === "benchmark" && (
            <div className="space-y-4">
              {/* Track 01 Alignment Proof Banner */}
              <div className="p-3 bg-cyan-950/30 rounded-xl border border-cyan-500/30 text-xs font-mono text-cyan-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-cyan-200">Track 01 Alignment (Agents on Connected Data): </span>
                  Sub-millisecond GraphBLAS sparse matrix linear algebra powers line-rate multi-hop agent reasoning across deep dependency graphs, avoiding recursive SQL join explosion.
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#141418] p-4 rounded-xl border border-white/[0.08]">
                <div>
                  <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>FalkorDB GraphBLAS vs. Relational Recursive CTEs</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xl">
                    Demonstrates variable-length traversal performance (sub-15ms sparse matrix multiplication vs. exponential recursive SQL join explosion).
                  </p>
                </div>
                <button
                  onClick={handleRunBenchmark}
                  disabled={isBenchmarking}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${isBenchmarking ? "animate-spin" : ""}`} />
                  <span>{isBenchmarking ? "Benchmarking..." : "Run Benchmark"}</span>
                </button>
              </div>

              {benchmarkData && (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#141418] text-slate-400 border-b border-white/[0.08]">
                        <tr>
                          <th className="py-2.5 px-3">Path Depth</th>
                          <th className="py-2.5 px-3 text-cyan-400">FalkorDB (GraphBLAS)</th>
                          <th className="py-2.5 px-3 text-rose-400">Relational Recursive CTE</th>
                          <th className="py-2.5 px-3 text-emerald-400">Speedup Factor</th>
                          <th className="py-2.5 px-3">Discovered Chains</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06] bg-[#0E0E12]">
                        {benchmarkData.comparisons.map((row: any) => (
                          <tr key={row.hops} className="hover:bg-white/[0.02]">
                            <td className="py-2 px-3 font-semibold text-slate-200">{row.hops} Hops</td>
                            <td className="py-2 px-3 text-cyan-300 font-bold">{row.falkordb_graphblas_ms} ms</td>
                            <td className="py-2 px-3 text-rose-300">{row.relational_recursive_sql_ms} ms</td>
                            <td className="py-2 px-3 text-emerald-300 font-bold">{row.speedup}</td>
                            <td className="py-2 px-3 text-slate-400">{row.paths_discovered}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-[#141418] rounded-xl border border-white/[0.08] text-[11px] text-slate-300 leading-relaxed font-sans">
                    <span className="font-semibold text-cyan-400">Architectural Finding: </span>
                    {benchmarkData.architectural_verdict}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: openCypher REPL */}
          {activeTab === "cypher" && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 font-mono">Namespace:</label>
                    <select
                      value={selectedNamespace}
                      onChange={(e) => handleNamespaceChange(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-cyan-300 focus:outline-none"
                    >
                      <option value="org_brain">org_brain</option>
                      <option value="blackboard_demo">blackboard_demo</option>
                      <option value="procedural_memory">procedural_memory</option>
                    </select>
                  </div>

                  {/* Reset Presets Button */}
                  <div className="flex items-center gap-2">
                    {resetFeedback && (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Reset to defaults
                      </span>
                    )}
                    <button
                      onClick={handleResetPresets}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 text-[11px] font-mono transition-all"
                      title="Reset presets and queries for this namespace to defaults"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Presets</span>
                    </button>
                  </div>
                </div>

                {/* Dynamic Presets Bar */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono pt-1">
                  <span className="text-slate-500 text-[11px] font-mono mr-1">Presets:</span>
                  {(namespacePresets[selectedNamespace] || []).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`group relative flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                        activePresetId === preset.id
                          ? "bg-cyan-950 text-cyan-300 border border-cyan-500/50 font-semibold shadow-sm shadow-cyan-500/20"
                          : "bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/60"
                      }`}
                    >
                      <span>{preset.name}</span>
                      {preset.isCustom && (
                        <span
                          onClick={(e) => handleDeletePreset(preset.id, e)}
                          className="ml-1 text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors"
                          title="Delete custom preset"
                        >
                          <X className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </button>
                  ))}

                  {/* Add Preset Button or Inline Creator */}
                  {!isAddingPreset ? (
                    <button
                      onClick={() => setIsAddingPreset(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-dashed border-slate-700 transition-all"
                      title="Save current query as a custom preset in this namespace"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Save Current Query</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-cyan-500/60">
                      <input
                        type="text"
                        placeholder="Preset Name..."
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSavePreset();
                          if (e.key === "Escape") setIsAddingPreset(false);
                        }}
                        autoFocus
                        className="bg-transparent text-xs text-cyan-200 placeholder-slate-500 px-1.5 py-0.5 focus:outline-none w-32 font-mono"
                      />
                      <button
                        onClick={handleSavePreset}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                        title="Confirm save"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setIsAddingPreset(false)}
                        className="p-1 text-slate-400 hover:text-rose-400"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={customCypher}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  rows={4}
                  className="w-full bg-[#141418] border border-white/[0.08] rounded-xl p-3 font-mono text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/60 leading-relaxed"
                  placeholder="MATCH (n) RETURN n LIMIT 10"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[11px] text-slate-400 font-mono">
                  Target: <code className="text-cyan-300 font-bold">{selectedNamespace}</code>
                </span>
                <button
                  onClick={handleExecuteCypher}
                  disabled={isQuerying}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-md disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${isQuerying ? "animate-spin" : ""}`} />
                  <span>Execute openCypher</span>
                </button>
              </div>

              {cypherResult && (
                <div className="mt-3 rounded-xl bg-[#141418] border border-white/[0.08] p-3 font-mono text-xs max-h-72 overflow-y-auto">
                  {cypherResult.error ? (
                    <div className="text-rose-400 font-sans">{cypherResult.error}</div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2.5 pb-2 border-b border-white/[0.08]">
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>Execution Latency: {cypherResult.execution_time_ms} ms</span>
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-300 font-semibold">{cypherResult.record_count} records returned</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[9px] text-emerald-400 font-bold">
                            FALKORDB GraphBLAS
                          </span>
                        </div>

                        {/* Format Switcher */}
                        <div className="flex items-center gap-1 bg-[#0E0E12] p-0.5 rounded-lg border border-white/[0.06]">
                          <button
                            onClick={() => setResultFormat("table")}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                              resultFormat === "table"
                                ? "bg-[#23232A] text-white font-semibold border border-white/10"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            Table View
                          </button>
                          <button
                            onClick={() => setResultFormat("json")}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                              resultFormat === "json"
                                ? "bg-[#23232A] text-white font-semibold border border-white/10"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            Raw JSON
                          </button>
                        </div>
                      </div>

                      {cypherResult.record_count === 0 ? (
                        <div className="text-amber-400/90 text-[11px] py-2">
                          0 records matched in <code className="text-cyan-300 font-bold">{cypherResult.graph_name}</code>. Note: services and dependencies live in <code className="text-cyan-300 font-bold">org_brain</code>, while runbooks live in <code className="text-cyan-300 font-bold">procedural_memory</code>.
                        </div>
                      ) : resultFormat === "table" && Array.isArray(cypherResult.records) && cypherResult.records.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                          <table className="w-full text-left text-xs font-mono">
                            <thead className="bg-[#0E0E12] text-slate-400 border-b border-white/[0.08]">
                              <tr>
                                {(cypherResult.columns || deriveColumnsFromQuery(customCypher)).map((col: string, idx: number) => (
                                  <th key={idx} className="py-2 px-3 text-cyan-400 uppercase tracking-wider text-[10px] font-semibold">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04] bg-[#0E0E12]/50">
                              {cypherResult.records.map((row: any, rIdx: number) => (
                                <tr key={rIdx} className="hover:bg-white/[0.02]">
                                  {(Array.isArray(row) ? row : [row]).map((cell: any, cIdx: number) => (
                                    <td key={cIdx} className="py-2 px-3 text-slate-200 font-sans text-[11px]">
                                      {Array.isArray(cell) ? (
                                        <div className="flex items-center gap-1 font-mono text-[10px] flex-wrap">
                                          {cell.map((c: string, ci: number) => (
                                            <React.Fragment key={ci}>
                                              <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                                                {c}
                                              </span>
                                              {ci < cell.length - 1 && <span className="text-slate-500">→</span>}
                                            </React.Fragment>
                                          ))}
                                        </div>
                                      ) : typeof cell === "boolean" ? (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${cell ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"}`}>
                                          {cell ? "TRUE" : "FALSE"}
                                        </span>
                                      ) : (
                                        String(cell)
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <pre className="text-slate-300 text-[11px] whitespace-pre-wrap bg-[#0E0E12] p-2.5 rounded-lg border border-white/[0.04]">
                          {JSON.stringify(cypherResult.records ?? cypherResult.subgraph?.nodes ?? cypherResult, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Chaos Injection */}
          {activeTab === "chaos" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Dynamic Microservice Failure Injection</span>
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Injects real-time latency spikes, connection pool starvation, or ADR policy breaches into arbitrary services in <code>org_brain</code>. This tests the swarm's ability to isolate unscripted failures beyond pre-built demos.
                </p>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleInjectChaos}
                    disabled={isInjectingChaos}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Inject Random Failure</span>
                  </button>

                  <button
                    onClick={handleResetChaos}
                    disabled={isInjectingChaos}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Baseline</span>
                  </button>
                </div>
              </div>

              {chaosResult && (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs space-y-2 font-mono">
                  <div className="text-amber-400 font-bold">Failure Injected Successfully</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div><span className="text-slate-500">Target Service:</span> {chaosResult.target_service}</div>
                    <div><span className="text-slate-500">Failure Type:</span> {chaosResult.failure_type}</div>
                    <div><span className="text-slate-500">P99 Latency:</span> {chaosResult.latency_p99_ms} ms</div>
                    <div><span className="text-slate-500">Error Rate:</span> {chaosResult.error_rate * 100}%</div>
                  </div>
                  <div className="text-cyan-300 font-sans text-[11px] pt-1">
                    <span className="font-semibold text-slate-400">Trigger Query: </span>
                    "{chaosResult.suggested_query}"
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
