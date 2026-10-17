"use client";

import React, { useState } from "react";
import { Play, Sparkles, Send, ShieldAlert, Users, History, Zap, CheckCircle2 } from "lucide-react";

export interface Scenario {
  id: string;
  title: string;
  description: string;
  trigger_type: string;
  suggested_query: string;
  track_focus: string[];
}

interface ScenarioSelectorProps {
  scenarios: Scenario[];
  onTriggerScenario: (query: string, scenarioId?: string) => void;
  isLoading: boolean;
}

const SCENARIO_THEMES: Record<
  string,
  {
    icon: any;
    accent: string;
    borderActive: string;
    badgeBg: string;
    badgeText: string;
    trackBadge: string;
  }
> = {
  "scenario-latency-cascade": {
    icon: ShieldAlert,
    accent: "text-red-400",
    borderActive: "border-red-500/70 ring-1 ring-red-500/40 bg-red-950/20",
    badgeBg: "bg-red-950/80 border-red-500/40 text-red-300",
    badgeText: "ALERT / P1",
    trackBadge: "Track 01 & 02",
  },
  "scenario-bus-factor-audit": {
    icon: Users,
    accent: "text-amber-400",
    borderActive: "border-amber-500/70 ring-1 ring-amber-500/40 bg-amber-950/20",
    badgeBg: "bg-amber-950/80 border-amber-500/40 text-amber-300",
    badgeText: "CENTRALITY / SPoF",
    trackBadge: "Track 01 & 03",
  },
  "scenario-memory-recall": {
    icon: History,
    accent: "text-emerald-400",
    borderActive: "border-emerald-500/70 ring-1 ring-emerald-500/40 bg-emerald-950/20",
    badgeBg: "bg-emerald-950/80 border-emerald-500/40 text-emerald-300",
    badgeText: "EPISODIC / RUNBOOK",
    trackBadge: "Track 02 & 03",
  },
};

export default function ScenarioSelector({
  scenarios,
  onTriggerScenario,
  isLoading,
}: ScenarioSelectorProps) {
  const [customQuery, setCustomQuery] = useState("");
  const [activeScenarioId, setActiveScenarioId] = useState<string>("scenario-latency-cascade");

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim() || isLoading) return;
    onTriggerScenario(customQuery);
  };

  return (
    <div className="bg-[#0b0f19]/90 border border-slate-800/90 rounded-xl p-3 shadow-2xl backdrop-blur-xl space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-cyan-950 border border-cyan-500/40 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-cyan-400" />
          </div>
          <span className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
            Autonomous Swarm Workflows
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
            FalkorDB Graph Hacks 2026
          </span>
        </div>
      </div>

      {/* 3 Specialized Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {scenarios.map((sc) => {
          const theme = SCENARIO_THEMES[sc.id] || {
            icon: Zap,
            accent: "text-cyan-400",
            borderActive: "border-cyan-500/60 ring-1 ring-cyan-500/40 bg-cyan-950/20",
            badgeBg: "bg-cyan-950 text-cyan-300",
            badgeText: sc.trigger_type,
            trackBadge: "Track 01",
          };
          const Icon = theme.icon;
          const isSelected = activeScenarioId === sc.id;

          return (
            <div
              key={sc.id}
              onClick={() => {
                setActiveScenarioId(sc.id);
                onTriggerScenario(sc.suggested_query, sc.id);
              }}
              className={`group p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? `${theme.borderActive} shadow-[0_0_20px_rgba(6,182,212,0.12)]`
                  : "bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${theme.accent}`} />
                    <span className="font-semibold text-slate-100 text-xs truncate group-hover:text-cyan-200 transition-colors">
                      {sc.title}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0 font-medium ${theme.badgeBg}`}
                  >
                    {theme.badgeText}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2 font-sans">
                  {sc.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-auto">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                  {theme.trackBadge}
                </span>

                <button
                  disabled={isLoading}
                  className={`flex items-center gap-1 text-[11px] font-semibold font-mono transition-all disabled:opacity-50 ${
                    isSelected ? "text-cyan-300 hover:text-cyan-200" : "text-slate-400 group-hover:text-cyan-400"
                  }`}
                >
                  <Play className={`w-3 h-3 ${isSelected ? "fill-cyan-300" : "fill-slate-400 group-hover:fill-cyan-400"}`} />
                  <span>Execute</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Natural Language Cypher Query Input */}
      <form onSubmit={handleSubmitCustom} className="flex gap-2 pt-0.5">
        <input
          type="text"
          value={customQuery}
          onChange={(e) => setCustomQuery(e.target.value)}
          placeholder="Ask custom graph query (e.g., 'Audit fraud-scorer bus factor and check ADR compliance')..."
          disabled={isLoading}
          className="flex-1 bg-slate-950/80 border border-slate-800/90 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-all font-sans"
        />
        <button
          type="submit"
          disabled={isLoading || !customQuery.trim()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-mono"
        >
          <Send className="w-3 h-3" />
          <span>Dispatch</span>
        </button>
      </form>
    </div>
  );
}
