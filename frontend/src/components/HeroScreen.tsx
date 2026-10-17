"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Network,
  Cpu,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  History,
  GitBranch,
  Terminal,
} from "lucide-react";
import { DESIGN_TOKENS, NODE_COLORS } from "@/lib/frontend-contract";

interface HeroScreenProps {
  onEnterDashboard: (scenarioId?: string) => void;
  falkorConnected?: boolean;
}

// Count-up animated number hook matching NetWatch pattern
function useCountUp(end: number, duration: number = 1400, trigger: boolean = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(ease * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration, trigger]);

  return count;
}

const PRESET_SCENARIOS = [
  {
    id: "scenario-latency-cascade",
    num: "01",
    tag: "ALERT TRIAGE",
    tagColor: "border-rose-500/30 text-rose-300 bg-rose-950/30",
    title: "Cascading Timeout & Breaking Commit",
    desc: "4-hop upstream GraphBLAS traversal isolates commit 8f92a1c violating ADR-002, triggering automated rollback.",
    metric: "4 Hops Traversal",
    time: "0.38 ms",
  },
  {
    id: "scenario-bus-factor-audit",
    num: "02",
    tag: "GOVERNANCE & SPoF",
    tagColor: "border-amber-500/30 text-amber-300 bg-amber-950/30",
    title: "Bus Factor & ADR Governance Audit",
    desc: "Computes GraphBLAS in-degree centrality, isolates SPoF (fraud-scorer Bus Factor = 1), and drafts governance.",
    metric: "In-Degree Centrality",
    time: "0.45 ms",
  },
  {
    id: "scenario-memory-recall",
    num: "03",
    tag: "PROCEDURAL MEMORY",
    tagColor: "border-emerald-500/30 text-emerald-300 bg-emerald-950/30",
    title: "Cross-Session Procedural Memory",
    desc: "Recalls past incident INC-2025-104 and reinforces runbook remediation confidence from 0.95 to 0.99.",
    metric: "Confidence 0.99",
    time: "0.32 ms",
  },
];

const ARCHITECTURE_PILLARS = [
  {
    num: "01",
    title: "Line-Rate Graph Ingestion",
    desc: "Continuous OpenTelemetry distributed trace ingestion updating service dependencies, error states, and p99 latencies directly in org_brain.",
    badge: "ZERO PAYLOAD OVERHEAD",
  },
  {
    num: "02",
    title: "Causal Blast-Radius Traversal",
    desc: "Variable-length GraphBLAS matrix multiplications up to 4 hops in < 0.4ms to isolate upstream cascading failure origins with zero SQL joins.",
    badge: "GRAPHBLAS LINEAR SCALING",
  },
  {
    num: "03",
    title: "ADR Governance & SPoF",
    desc: "Calculates in-degree centrality across company entities, detects architecture decision record breaches, and maps code commit ownership.",
    badge: "POLICY ENFORCEMENT",
  },
  {
    num: "04",
    title: "Procedural Memory Reinforcement",
    desc: "Cross-session episodic memory in procedural_memory. Matches symptom fingerprints to past incident runbooks with self-learning confidence weights.",
    badge: "HUMAN-VERIFIED AUTONOMY",
  },
];

export default function HeroScreen({ onEnterDashboard, falkorConnected = true }: HeroScreenProps) {
  const [statsInView, setStatsInView] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");

  const hopsCounted = useCountUp(4, 1200, statsInView);
  const speedupCounted = useCountUp(154, 1500, statsInView);
  const agentsCounted = useCountUp(3, 1000, statsInView);

  return (
    <div className="relative min-h-screen w-full bg-[#050508] text-white flex flex-col justify-between overflow-x-hidden select-none">
      {/* ── TOP AURORA GLOW (Direction 2) ────────────────────────── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-indigo-600/20 via-violet-600/10 to-transparent blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-cyan-500/10 blur-[90px] pointer-events-none z-0" />

      {/* ── TOP NAV BAR (NetWatch style) ─────────────────────────── */}
      <header className="relative z-20 px-6 sm:px-10 py-4 flex items-center justify-between border-b border-white/5 backdrop-blur-xl bg-[#07070b]/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-extrabold text-sm shadow-[0_2px_12px_rgba(255,255,255,0.2)]">
            N
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">NexusGraph</span>
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono tracking-widest text-slate-300 uppercase">
                SWARM
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">Autonomous Engineering Brain & Remediation</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-white/10">
            <span
              className={`w-2 h-2 rounded-full ${
                falkorConnected ? "bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="text-slate-300">
              {falkorConnected ? "FalkorDB GraphBLAS • Live" : "FalkorDB Offline"}
            </span>
          </div>

          <button
            onClick={() => onEnterDashboard()}
            className="px-5 py-2 rounded-full bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all shadow-[0_2px_12px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98]"
          >
            Launch Swarm Console →
          </button>
        </div>
      </header>

      {/* ── HERO CORE SECTION (NetWatch & Direction 2 Merge) ──────── */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-12 flex flex-col items-center text-center my-auto">
        {/* Top Tag Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-neutral-200 text-xs font-mono tracking-wider mb-6 backdrop-blur-md shadow-lg shadow-black/40">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          AUTONOMOUS MULTI-AGENT INCIDENT REMEDIATION
        </div>

        {/* Big Bold Headline */}
        <h1
          className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-neutral-100 to-neutral-400 select-none drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] max-w-4xl"
          style={{ letterSpacing: "-0.03em", lineHeight: 1.08 }}
        >
          Self-Healing Architecture.
          <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300">
            Zero Downtime.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-neutral-300 text-base sm:text-lg lg:text-xl leading-relaxed max-w-2xl font-normal drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
          Multi-agent causal reasoning graph on FalkorDB GraphBLAS matrix engine. Three autonomous agents{" "}
          <span className="text-white font-medium">(Recon, Historian, Executor)</span> traverse
          causal dependencies, isolate breaking commits against ADRs, and reinforce self-learning runbooks.
        </p>

        {/* Action Buttons (Primary White Pill + Secondary Ghost Pill) */}
        <div className="mt-8 flex flex-wrap gap-4 items-center justify-center">
          <button
            onClick={() => onEnterDashboard()}
            className="px-8 py-3.5 rounded-full bg-white font-semibold text-sm sm:text-base text-black hover:bg-neutral-200 transition-all shadow-2xl shadow-black/80 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-2.5"
          >
            <span>Launch Swarm Console</span>
            <span className="text-black font-bold">→</span>
          </button>

          <button
            onClick={() => onEnterDashboard()}
            className="px-7 py-3.5 rounded-full bg-black/40 hover:bg-white/[0.12] border border-white/15 font-semibold text-sm sm:text-base text-neutral-200 transition-all backdrop-blur-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-2"
          >
            <Network className="w-4 h-4 text-cyan-400" />
            <span>View 3D Topology</span>
          </button>
        </div>

        {/* ── 4 STAT COUNTERS (NetWatch style) ────────────────────── */}
        <div className="mt-14 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          {/* Stat 1 */}
          <div className="bg-[#0E0E12] rounded-2xl p-5 border border-white/[0.05] hover:border-white/[0.12] transition-all">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
              Traversal Latency
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight mb-1 font-mono text-cyan-300">
              &lt; 0.40 ms
            </div>
            <div className="text-xs text-slate-400 leading-snug">
              Sub-millisecond FalkorDB GraphBLAS matrix multiplications.
            </div>
          </div>

          {/* Stat 2 */}
          <div className="bg-[#0E0E12] rounded-2xl p-5 border border-white/[0.05] hover:border-white/[0.12] transition-all">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
              Relational Speedup
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight mb-1 font-mono text-indigo-300">
              {speedupCounted}x
            </div>
            <div className="text-xs text-slate-400 leading-snug">
              Measured against PostgreSQL recursive CTE joins at 4 hops.
            </div>
          </div>

          {/* Stat 3 */}
          <div className="bg-[#0E0E12] rounded-2xl p-5 border border-white/[0.05] hover:border-white/[0.12] transition-all">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
              Autonomous Swarm
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight mb-1 font-mono text-emerald-300">
              {agentsCounted} Agents
            </div>
            <div className="text-xs text-slate-400 leading-snug">
              Recon, Historian, and Executor coordinated over blackboard.
            </div>
          </div>

          {/* Stat 4 */}
          <div className="bg-[#0E0E12] rounded-2xl p-5 border border-white/[0.05] hover:border-white/[0.12] transition-all">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
              ADR Disruption Gate
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight mb-1 font-mono text-amber-300">
              0% Breach
            </div>
            <div className="text-xs text-slate-400 leading-snug">
              Automated rollback when commits violate architecture limits.
            </div>
          </div>
        </div>

        {/* ── 1-CLICK INTERACTIVE SCENARIOS SECTION ───────────────── */}
        <div className="mt-14 w-full">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
                1-Click Demonstration Scenarios
              </span>
            </div>
            <span className="text-xs font-mono text-slate-500">Click to launch live in Console</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            {PRESET_SCENARIOS.map((sc) => (
              <div
                key={sc.id}
                onClick={() => onEnterDashboard(sc.id)}
                className="group relative bg-[#0E0E12] hover:bg-[#141418] rounded-2xl p-5 border border-white/[0.05] hover:border-cyan-500/40 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${sc.tagColor}`}>
                    {sc.tag}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{sc.metric}</span>
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {sc.title}
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  {sc.desc}
                </p>
                <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs font-mono text-cyan-400">
                  <span className="group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 font-semibold">
                    Execute Swarm →
                  </span>
                  <span className="text-[10px] text-slate-500">{sc.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── HOW IT WORKS: 4 VALUE PILLARS (NetWatch pattern) ────── */}
        <div className="mt-20 w-full pt-16 border-t border-white/[0.06]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white/[0.04] border border-white/10 text-[10px] font-mono tracking-widest text-slate-400 uppercase mb-4">
            HOW IT WORKS
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            From live alert trigger to causal graph remediation.
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Four coordinated stages engineered to eliminate developer alert fatigue, isolate root causes in milliseconds, and maintain self-learning memory.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
            {ARCHITECTURE_PILLARS.map((p) => (
              <div
                key={p.num}
                className="bg-[#0E0E12] rounded-2xl p-6 border border-white/[0.05] hover:border-white/[0.12] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center font-mono font-bold text-xs text-white mb-4">
                    {p.num}
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{p.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">{p.desc}</p>
                </div>
                <div className="text-[10px] font-mono font-semibold tracking-wider text-cyan-400 uppercase">
                  {p.badge}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="relative z-10 px-8 py-6 border-t border-white/[0.06] bg-[#07070b]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-slate-400">NexusGraph Autonomous Swarm Engine</span>
            <span>•</span>
            <span>FalkorDB GraphBLAS Native</span>
          </div>

          <div className="flex items-center gap-6 text-slate-400">
            <button onClick={() => onEnterDashboard()} className="hover:text-white transition">
              Launch Console
            </button>
            <button onClick={() => onEnterDashboard("scenario-latency-cascade")} className="hover:text-white transition">
              Run Cascade Triage
            </button>
            <button onClick={() => onEnterDashboard("scenario-bus-factor-audit")} className="hover:text-white transition">
              Audit Bus Factor
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
