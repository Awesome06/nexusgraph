"use client";

import React, { useState } from "react";
import { Play, Sparkles, Send, Flame, ShieldAlert, Cpu } from "lucide-react";

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
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-xl backdrop-blur-md space-y-3">
      {/* 1-Click Demo Scenarios Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>1-Click Hackathon Judge Scenarios</span>
        </div>
        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
          Ready for Instant Evaluation
        </span>
      </div>

      {/* Scenario Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {scenarios.map((sc) => {
          const isSelected = activeScenarioId === sc.id;
          return (
            <div
              key={sc.id}
              onClick={() => {
                setActiveScenarioId(sc.id);
                onTriggerScenario(sc.suggested_query, sc.id);
              }}
              className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? "bg-slate-800/90 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/40"
                  : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="font-semibold text-slate-100 text-xs truncate">{sc.title}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">
                    {sc.trigger_type}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                  {sc.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-auto">
                <div className="flex flex-wrap gap-1">
                  {sc.track_focus.slice(0, 2).map((tr) => (
                    <span
                      key={tr}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-400"
                    >
                      {tr.split(" ")[0]} {tr.split(" ")[1]}
                    </span>
                  ))}
                </div>
                <button
                  disabled={isLoading}
                  className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                >
                  <Play className="w-3 h-3 fill-cyan-400" />
                  <span>Run</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Query Input Box */}
      <form onSubmit={handleSubmitCustom} className="flex gap-2 pt-1">
        <input
          type="text"
          value={customQuery}
          onChange={(e) => setCustomQuery(e.target.value)}
          placeholder="Or ask a custom question (e.g. 'Audit ADR-002 violations and isolate blast radius')..."
          disabled={isLoading}
          className="flex-1 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-all font-sans"
        />
        <button
          type="submit"
          disabled={isLoading || !customQuery.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Investigate</span>
        </button>
      </form>
    </div>
  );
}
