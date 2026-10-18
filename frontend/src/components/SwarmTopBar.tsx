"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Terminal,
  Database,
  Network,
  BrainCircuit,
  History,
  Activity,
  Sliders,
  CheckCircle2,
} from "lucide-react";

interface SwarmTopBarProps {
  activeGraph: string;
  onSelectGraph: (graphName: string) => void;
  onOpenConsole: () => void;
  nodeCount: number;
  edgeCount: number;
  falkorConnected: boolean;
  onOpenWorkflows?: () => void;
}

export default function SwarmTopBar({
  activeGraph,
  onSelectGraph,
  onOpenConsole,
  nodeCount,
  edgeCount,
  falkorConnected,
  onOpenWorkflows,
}: SwarmTopBarProps) {
  const namespaces = [
    { id: "org_brain", name: "org_brain", label: "Org Brain", icon: Network, track: "Track 01 & 03" },
    { id: "blackboard_demo", name: "blackboard_demo", label: "Blackboard", icon: BrainCircuit, track: "Track 02" },
    { id: "procedural_memory", name: "procedural_memory", label: "Procedural Memory", icon: History, track: "Track 02 & 03" },
  ];

  return (
    <header className="h-16 px-6 bg-[#0E0E12] border-b border-white/[0.06] flex items-center justify-between gap-4 select-none flex-shrink-0 z-10">
      {/* ── LEFT: GREETING & FEED STATUS (NetWatch style) ───────── */}
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Swarm Mission Control</span>
            <span className="text-slate-500">•</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>FEED LIVE</span>
            </div>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            FalkorDB Engine (Bolt :6379) • Sub-millisecond GraphBLAS
          </div>
        </div>
      </div>

      {/* ── CENTER: EVALUATION WORKFLOWS TRIGGER BUTTON ─────────── */}
      <div className="flex-1 max-w-md hidden md:flex items-center justify-center">
        {onOpenWorkflows && (
          <button
            onClick={onOpenWorkflows}
            className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#141418] hover:bg-[#1C1C24] border border-white/[0.08] hover:border-cyan-500/40 text-xs font-mono text-slate-300 hover:text-white transition shadow-sm group"
            title="Open Hackathon Evaluation Workflows Suite"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Evaluation Workflows (4 Scenarios)</span>
            <span className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[9px] text-slate-400 font-mono">
              Press W
            </span>
          </button>
        )}
      </div>

      {/* ── RIGHT: MULTIGRAPH TABS & CONSOLE DRAWER BUTTON ──────── */}
      <div className="flex items-center gap-3">
        {/* Multigraph Selector Pills */}
        <div className="flex items-center gap-1 bg-[#141418] p-1 rounded-xl border border-white/[0.06]">
          {namespaces.map((ns) => {
            const Icon = ns.icon;
            const isSelected = activeGraph === ns.id || (ns.id.startsWith("blackboard") && activeGraph.startsWith("blackboard"));

            return (
              <button
                key={ns.id}
                onClick={() => onSelectGraph(ns.name)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  isSelected
                    ? "bg-[#23232A] text-white font-semibold shadow-sm border border-white/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-cyan-400" : "text-slate-500"}`} />
                <span>{ns.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live Topology Stat Badge */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141418] border border-white/[0.06] text-xs font-mono text-slate-300">
          <span className="text-cyan-400 font-bold">{nodeCount}</span>
          <span className="text-slate-500">nodes</span>
          <span className="text-slate-600">/</span>
          <span className="text-indigo-400 font-bold">{edgeCount}</span>
          <span className="text-slate-500">edges</span>
        </div>

        {/* openCypher & Benchmarks Console Toggle */}
        <button
          onClick={onOpenConsole}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 text-xs font-mono font-semibold transition"
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Console</span>
        </button>
      </div>
    </header>
  );
}
