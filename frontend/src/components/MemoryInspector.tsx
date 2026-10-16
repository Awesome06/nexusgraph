"use client";

import React from "react";
import { Database, Network, BrainCircuit, History, RotateCcw, ShieldCheck, Terminal } from "lucide-react";

interface MemoryInspectorProps {
  activeGraph: string;
  onSelectGraph: (graphName: string) => void;
  onResetSeed: () => void;
  onOpenConsole?: () => void;
  isSeeding: boolean;
  nodeCount: number;
  edgeCount: number;
  falkorConnected: boolean;
}

export default function MemoryInspector({
  activeGraph,
  onSelectGraph,
  onResetSeed,
  onOpenConsole,
  isSeeding,
  nodeCount,
  edgeCount,
  falkorConnected,
}: MemoryInspectorProps) {
  const graphs = [
    {
      id: "org_brain",
      name: "org_brain",
      label: "Company Brain & Topology",
      description: "Services, Teams, Commits, ADRs",
      icon: Network,
      track: "Track 01 & 03",
      color: "border-cyan-500/50 text-cyan-300",
    },
    {
      id: "blackboard_demo",
      name: "blackboard_demo",
      label: "Agent Coordination Blackboard",
      description: "Tasks, Findings, Actions, Handoffs",
      icon: BrainCircuit,
      track: "Track 02",
      color: "border-purple-500/50 text-purple-300",
    },
    {
      id: "procedural_memory",
      name: "procedural_memory",
      label: "Procedural & Episodic Memory",
      description: "Incidents, Failure Patterns, Runbooks",
      icon: History,
      track: "Track 02 & 03",
      color: "border-emerald-500/50 text-emerald-300",
    },
  ];

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 bg-slate-900/90 border-b border-slate-800/90 backdrop-blur-xl">
      {/* Left: Brand & FalkorDB Connection Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Database className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">NexusGraph</h1>
              <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-[10px] font-mono text-cyan-300">
                FalkorDB Swarm
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Autonomous Engineering Brain & Remediation</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-mono">
          <span className={`w-2 h-2 rounded-full ${falkorConnected ? "bg-emerald-400 animate-pulse" : "bg-cyan-400"}`} />
          <span className="text-slate-400">Engine:</span>
          <span className="text-slate-200">FalkorDB (Bolt :6379)</span>
        </div>
      </div>

      {/* Center: Multigraph Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 shadow-inner">
        {graphs.map((g) => {
          const Icon = g.icon;
          const isSelected = activeGraph === g.id || (g.id.startsWith("blackboard") && activeGraph.startsWith("blackboard"));

          return (
            <button
              key={g.id}
              onClick={() => onSelectGraph(g.name)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                isSelected
                  ? "bg-slate-800 text-white border border-slate-700 shadow-md font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-cyan-400" : "text-slate-500"}`} />
              <div className="text-left">
                <span className="block leading-tight">{g.name}</span>
                <span className="text-[9px] text-slate-500 block leading-tight">{g.track}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right: Console, Reseed & Stats */}
      <div className="flex items-center gap-2">
        {onOpenConsole && (
          <button
            onClick={onOpenConsole}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/50 text-xs font-mono text-cyan-300 hover:text-cyan-100 transition-all shadow-md"
            title="Open FalkorDB Architecture Console (Benchmarks & openCypher REPL)"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>FalkorDB Console</span>
          </button>
        )}

        <button
          onClick={onResetSeed}
          disabled={isSeeding}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition-all shadow-md disabled:opacity-50"
          title="Reset and reseed all FalkorDB multigraphs with synthetic topology"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isSeeding ? "animate-spin text-cyan-400" : "text-slate-400"}`} />
          <span>Reseed Data</span>
        </button>

        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>Tracks 01, 02, 03</span>
        </div>
      </div>
    </div>
  );
}
