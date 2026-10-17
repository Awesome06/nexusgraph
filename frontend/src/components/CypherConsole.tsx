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
  X
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CypherConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  activeGraphName: string;
  onRefreshGraph: () => void;
}

export default function CypherConsole({
  isOpen,
  onClose,
  activeGraphName,
  onRefreshGraph
}: CypherConsoleProps) {
  const [activeTab, setActiveTab] = useState<"benchmark" | "cypher" | "chaos">("benchmark");
  
  // Benchmark state
  const [benchmarkData, setBenchmarkData] = useState<any>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // Cypher scratchpad state
  const [selectedNamespace, setSelectedNamespace] = useState(activeGraphName || "org_brain");
  const [customCypher, setCustomCypher] = useState(
    "MATCH path = (s:Service {name: 'ledger-db'})<-[:DEPENDS_ON*1..4]-(d:Service)\nRETURN [n IN nodes(path) | n.name] AS chain, length(path) AS depth\nORDER BY depth ASC"
  );
  const [cypherResult, setCypherResult] = useState<any>(null);
  const [isQuerying, setIsQuerying] = useState(false);

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
        setCypherResult(data);
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">FalkorDB Architecture Tools</h2>
              <p className="text-[11px] text-slate-400">GraphBLAS Benchmarks, openCypher Console, and Chaos Injection</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Switcher */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setActiveTab("benchmark")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                  activeTab === "benchmark" ? "bg-cyan-950 text-cyan-300 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Graph vs SQL Benchmark</span>
              </button>
              <button
                onClick={() => setActiveTab("cypher")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                  activeTab === "cypher" ? "bg-cyan-950 text-cyan-300 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>openCypher REPL</span>
              </button>
              <button
                onClick={() => setActiveTab("chaos")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                  activeTab === "chaos" ? "bg-amber-950 text-amber-300 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Chaos Injection</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto flex-1 font-sans space-y-4">
          {/* TAB 1: Benchmark */}
          {activeTab === "benchmark" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-950/70 p-4 rounded-xl border border-slate-800">
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
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Path Depth</th>
                          <th className="py-2.5 px-3 text-cyan-400">FalkorDB (GraphBLAS)</th>
                          <th className="py-2.5 px-3 text-rose-400">Relational Recursive CTE</th>
                          <th className="py-2.5 px-3 text-emerald-400">Speedup Factor</th>
                          <th className="py-2.5 px-3">Discovered Chains</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
                        {benchmarkData.comparisons.map((row: any) => (
                          <tr key={row.hops} className="hover:bg-slate-800/40">
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

                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-300 leading-relaxed font-sans">
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 font-mono">Namespace:</label>
                  <select
                    value={selectedNamespace}
                    onChange={(e) => setSelectedNamespace(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-cyan-300 focus:outline-none"
                  >
                    <option value="org_brain">org_brain</option>
                    <option value="blackboard_demo">blackboard_demo</option>
                    <option value="procedural_memory">procedural_memory</option>
                  </select>
                </div>

                {/* Templates based on selected namespace */}
                <div className="flex gap-1.5 text-[10px] font-mono">
                  {selectedNamespace === "org_brain" && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedNamespace("org_brain");
                          setCustomCypher("MATCH path = (s:Service {name: 'ledger-db'})<-[:DEPENDS_ON*1..4]-(d:Service)\nRETURN [n IN nodes(path) | n.name] AS chain, length(path) AS depth\nORDER BY depth ASC");
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                      >
                        Blast Radius
                      </button>
                      <button
                        onClick={() => {
                          setSelectedNamespace("org_brain");
                          setCustomCypher("MATCH (s:Service)<-[r:DEPENDS_ON]-(d:Service)\nRETURN s.name AS service, count(d) AS inbound_deps\nORDER BY inbound_deps DESC");
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                      >
                        Centrality
                      </button>
                      <button
                        onClick={() => {
                          setSelectedNamespace("org_brain");
                          setCustomCypher("MATCH (adr:ADR)-[:GOVERNS]->(s:Service)\nRETURN adr.id AS id, adr.title AS title, s.name AS service");
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                      >
                        ADR Governance
                      </button>
                    </>
                  )}

                  {selectedNamespace === "procedural_memory" && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedNamespace("procedural_memory");
                          setCustomCypher("MATCH (p:Pattern)-[r:RESOLVED_BY]->(s:RunbookStep)\nRETURN p.symptom_signature AS pattern, s.id AS step_id, s.action_type AS action, r.confidence AS confidence");
                        }}
                        className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 hover:text-white"
                      >
                        Runbook Match
                      </button>
                      <button
                        onClick={() => {
                          setSelectedNamespace("procedural_memory");
                          setCustomCypher("MATCH (i:Incident)-[r:AFFECTED_SERVICE]->(p:Pattern)\nRETURN i.id AS incident, i.title AS title, r.service_id AS affected_service, p.symptom_signature AS pattern");
                        }}
                        className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 hover:text-white"
                      >
                        Incident History
                      </button>
                      <button
                        onClick={() => {
                          setSelectedNamespace("procedural_memory");
                          setCustomCypher("MATCH (p:Pattern)\nRETURN p.id AS id, p.symptom_signature AS symptom, p.description AS description");
                        }}
                        className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 hover:text-white"
                      >
                        All Patterns
                      </button>
                    </>
                  )}

                  {selectedNamespace === "blackboard_demo" && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedNamespace("blackboard_demo");
                          setCustomCypher("MATCH (t:Task)\nRETURN t.id AS task, t.description AS description, t.status AS status");
                        }}
                        className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 hover:text-white"
                      >
                        Swarm Tasks
                      </button>
                      <button
                        onClick={() => {
                          setSelectedNamespace("blackboard_demo");
                          setCustomCypher("MATCH (t:Task)-[:ASSIGNED_TO]->(f:Finding)-[:SUPPORTS]->(a:ProposedAction)\nRETURN f.agent_name AS agent, f.summary AS finding, a.action_type AS action, a.approved AS approved");
                        }}
                        className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 hover:text-white"
                      >
                        Findings & Actions
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={customCypher}
                  onChange={(e) => setCustomCypher(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/60 leading-relaxed"
                  placeholder="MATCH (n) RETURN n LIMIT 10"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleExecuteCypher}
                  disabled={isQuerying}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${isQuerying ? "animate-spin" : ""}`} />
                  <span>Execute openCypher</span>
                </button>
              </div>

              {cypherResult && (
                <div className="mt-2 rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-xs max-h-56 overflow-y-auto">
                  {cypherResult.error ? (
                    <div className="text-rose-400">{cypherResult.error}</div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 pb-1 border-b border-slate-800">
                        <span>Latency: {cypherResult.execution_time_ms} ms</span>
                        <span>Records: {cypherResult.record_count}</span>
                      </div>
                      {cypherResult.record_count === 0 ? (
                        <div className="text-amber-400/90 text-[11px] py-1">
                          0 records matched in <code className="text-cyan-300 font-bold">{cypherResult.graph_name}</code>. Note: services and dependencies live in <code className="text-cyan-300 font-bold">org_brain</code>, while runbooks live in <code className="text-cyan-300 font-bold">procedural_memory</code>.
                        </div>
                      ) : (
                        <pre className="text-slate-300 text-[11px] whitespace-pre-wrap">
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
