"use client";

import React, { useEffect } from "react";
import {
  X,
  Sparkles,
  ShieldAlert,
  Users,
  History,
  Flame,
  Play,
  CheckCircle2,
  Zap,
  RotateCcw,
  Activity,
  ArrowRight
} from "lucide-react";
import { Scenario } from "./ScenarioSelector";

interface EvaluationWorkflowsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: Scenario[];
  onSelectScenario: (scenario: Scenario) => void;
  isLoading: boolean;
  activeScenarioId?: string;
  onResetSeed?: () => void;
  isSeeding?: boolean;
}

const SCENARIO_DETAILS: Record<
  string,
  {
    icon: any;
    accent: string;
    borderActive: string;
    badgeBg: string;
    badgeText: string;
    trackBadge: string;
    targetBenchmark: string;
    evaluationProof: string;
    buttonColor: string;
  }
> = {
  "scenario-latency-cascade": {
    icon: ShieldAlert,
    accent: "text-red-400",
    borderActive: "border-red-500/70 ring-1 ring-red-500/40 bg-red-950/20",
    badgeBg: "bg-red-950/80 border-red-500/40 text-red-300",
    badgeText: "ALERT / P1",
    trackBadge: "Track 01 & 02",
    targetBenchmark: "0.38ms BFS Traversal",
    evaluationProof: "Isolates commit 8f92a1c by Arjun Mehta breaching ADR-002, executes rollback & connection pool flush.",
    buttonColor: "bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/40",
  },
  "scenario-bus-factor-audit": {
    icon: Users,
    accent: "text-amber-400",
    borderActive: "border-amber-500/70 ring-1 ring-amber-500/40 bg-amber-950/20",
    badgeBg: "bg-amber-950/80 border-amber-500/40 text-amber-300",
    badgeText: "CENTRALITY / SPoF",
    trackBadge: "Track 01 & 03",
    targetBenchmark: "1.4ms In-Degree Centrality",
    evaluationProof: "Detects Bus Factor = 1 on fraud-scorer (Lucas Silva) violating ADR-005; auto-assigns Elena Rostova.",
    buttonColor: "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40",
  },
  "scenario-memory-recall": {
    icon: History,
    accent: "text-emerald-400",
    borderActive: "border-emerald-500/70 ring-1 ring-emerald-500/40 bg-emerald-950/20",
    badgeBg: "bg-emerald-950/80 border-emerald-500/40 text-emerald-300",
    badgeText: "EPISODIC / RUNBOOK",
    trackBadge: "Track 02 & 03",
    targetBenchmark: "1.7ms Subgraph Recall",
    evaluationProof: "Matches symptom vector to INC-2025-104, executes RUN-001 & RUN-002, reinforces confidence to 0.99.",
    buttonColor: "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40",
  },
  "scenario-chaos-remediation": {
    icon: Flame,
    accent: "text-rose-400",
    borderActive: "border-rose-500/70 ring-1 ring-rose-500/40 bg-rose-950/20",
    badgeBg: "bg-rose-950/80 border-rose-500/40 text-rose-300",
    badgeText: "CHAOS / AUTO-HEAL",
    trackBadge: "Track 01 & 04",
    targetBenchmark: "< 5s Autonomous MTTR",
    evaluationProof: "Injects live latency spike (p99: 4,200ms) on payment-engine, trips circuit breaker, and verifies health restoration.",
    buttonColor: "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40",
  },
};

export default function EvaluationWorkflowsModal({
  isOpen,
  onClose,
  scenarios,
  onSelectScenario,
  isLoading,
  activeScenarioId,
  onResetSeed,
  isSeeding,
}: EvaluationWorkflowsModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-[#0E0E12] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-cyan-950/40 via-[#141418] to-purple-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-mono tracking-tight">
                  Hackathon Evaluation Workflows
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-400 font-semibold">
                  FalkorDB Graph Hacks 2026
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">
                Select a verified evaluation scenario to trigger autonomous multi-agent reasoning, openCypher traversals, and remediation.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: 4 Curated Evaluation Scenario Cards */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarios.map((sc, idx) => {
            const detail = SCENARIO_DETAILS[sc.id] || {
              icon: Zap,
              accent: "text-cyan-400",
              borderActive: "border-cyan-500/60 ring-1 ring-cyan-500/40 bg-cyan-950/20",
              badgeBg: "bg-cyan-950 text-cyan-300",
              badgeText: sc.trigger_type,
              trackBadge: "Track 01",
              targetBenchmark: "Sub-millisecond",
              evaluationProof: sc.description,
              buttonColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
            };
            const Icon = detail.icon;
            const isCurrent = activeScenarioId === sc.id;

            return (
              <div
                key={sc.id}
                className={`flex flex-col justify-between p-4 rounded-xl border transition-all text-left group ${
                  isCurrent
                    ? `${detail.borderActive} shadow-[0_0_25px_rgba(6,182,212,0.1)]`
                    : "bg-[#141418]/90 border-white/[0.06] hover:border-cyan-500/30 hover:bg-[#18181F]"
                }`}
              >
                <div>
                  {/* Top Bar of Card */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1.5 rounded-lg bg-black/40 border border-white/[0.06] ${detail.accent}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-200 truncate">
                        {sc.title}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${detail.badgeBg}`}>
                      {detail.badgeText}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-400 leading-relaxed mb-3 font-sans">
                    {sc.description}
                  </p>

                  {/* Evaluation Criteria & Verification Evidence Box */}
                  <div className="p-2.5 rounded-lg bg-black/50 border border-white/[0.04] mb-4 space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Evaluation Proof</span>
                      <span className="text-cyan-400 font-semibold">{detail.targetBenchmark}</span>
                    </div>
                    <p className="text-slate-300 text-[11px] font-sans leading-snug">
                      {detail.evaluationProof}
                    </p>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] mt-auto">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-400">
                    {detail.trackBadge}
                  </span>

                  <button
                    disabled={isLoading}
                    onClick={() => {
                      onSelectScenario(sc);
                      onClose();
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition shadow-sm ${detail.buttonColor} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Evaluation →</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note & Reset Option */}
        <div className="p-4 bg-[#111116] border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Runs live against FalkorDB bolt://localhost:6379 (org_brain & procedural_memory)</span>
          </div>

          <div className="flex items-center gap-3">
            {onResetSeed && (
              <button
                onClick={onResetSeed}
                disabled={isSeeding}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs border border-white/[0.08] transition"
              >
                <RotateCcw className={`w-3 h-3 ${isSeeding ? "animate-spin text-cyan-400" : ""}`} />
                <span>{isSeeding ? "Reseeding..." : "Reset All Graphs to Baseline"}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
