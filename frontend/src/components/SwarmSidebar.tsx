"use client";

import React from "react";
import {
  LayoutDashboard,
  Network,
  History,
  BarChart3,
  Terminal,
  Zap,
  ArrowLeft,
  Flame,
  CheckCircle2,
  Shield,
  Layers,
} from "lucide-react";

interface SwarmSidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onBackToHero: () => void;
  onTriggerChaos: () => void;
  onResetSeed: () => void;
  activeGraph: string;
  isSeeding: boolean;
}

export default function SwarmSidebar({
  activeTab,
  onSelectTab,
  onBackToHero,
  onTriggerChaos,
  onResetSeed,
  activeGraph,
  isSeeding,
}: SwarmSidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Swarm War Room", icon: LayoutDashboard, badge: "LIVE" },
    { id: "graph", label: "Graph Explorer", icon: Network, badge: null },
    { id: "memory", label: "Procedural Memory", icon: History, badge: "v0.99" },
    { id: "benchmarks", label: "GraphBLAS vs SQL", icon: BarChart3, badge: "154x" },
    { id: "cypher", label: "openCypher REPL", icon: Terminal, badge: null },
  ];

  return (
    <aside className="w-60 h-full bg-[#0E0E12] flex flex-col justify-between border-r border-white/[0.06] flex-shrink-0 select-none z-20">
      {/* ── TOP: BRAND & NAV ─────────────────────────────────────── */}
      <div>
        {/* Brand Header */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-extrabold text-sm shadow-[0_2px_8px_rgba(255,255,255,0.15)]">
              N
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight">NexusGraph</div>
              <div className="text-[10px] font-mono text-slate-400 tracking-wider uppercase font-semibold">
                AI SWARM OPS
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1 p-3">
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-500 font-semibold">
            Console Modules
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#18181F] text-white border-l-2 border-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                      item.badge === "LIVE"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse"
                        : "bg-white/[0.06] text-slate-300 border border-white/10"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── BOTTOM: ESCALATION CARD & RETURN TO HERO ─────────────── */}
      <div className="p-3 border-t border-white/[0.06] flex flex-col gap-3">
        {/* Chaos Injection Card (Matching NetWatch Escalate Card) */}
        <div className="bg-[#141418] rounded-xl p-3 border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-rose-300 font-bold">
              Chaos Injection
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug mb-2.5">
            Inject mock latency spike into org_brain to evaluate dynamic swarm remediation.
          </p>
          <button
            onClick={onTriggerChaos}
            className="w-full py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono font-semibold transition"
          >
            Inject Failure Test →
          </button>
        </div>

        {/* Reseed Database Button */}
        <button
          onClick={onResetSeed}
          disabled={isSeeding}
          className="w-full py-1.5 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs font-mono transition border border-white/[0.06] flex items-center justify-center gap-2"
        >
          <span>{isSeeding ? "Reseeding Graphs..." : "Reseed All Graphs"}</span>
        </button>

        {/* Return to Hero Overview Link */}
        <button
          onClick={onBackToHero}
          className="w-full py-2 px-3 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] text-xs font-mono transition flex items-center gap-2 text-left"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Landing & Proof</span>
        </button>
      </div>
    </aside>
  );
}
