"use client";

import React, { useRef, useEffect } from "react";
import {
  ShieldAlert,
  Brain,
  Terminal,
  Clock,
  Sparkles,
  CheckCircle2,
  Database,
  ArrowRight,
  ChevronRight,
  Code2,
  Copy,
  Check,
  Zap,
} from "lucide-react";

export interface CypherTrace {
  tool_name: string;
  agent_name: string;
  cypher_query: string;
  parameters: Record<string, any>;
  execution_time_ms: number;
  nodes_affected: number;
  relationships_affected: number;
  explanation: string;
}

export interface AgentStepEvent {
  step_id: string;
  session_id: string;
  agent: string;
  stage: string;
  status: string;
  thought: string;
  tool_call?: { tool: string; params: Record<string, any> };
  cypher_trace?: CypherTrace;
  subgraph?: any;
  timestamp: string;
  is_final?: boolean;
  final_answer?: string;
}

interface AgentTracePanelProps {
  events: AgentStepEvent[];
  isStreaming: boolean;
  currentAgent: string;
  activeStage: string;
  playbackSpeed?: number;
  onSpeedChange?: (speed: number) => void;
  onOpenWorkflows?: () => void;
  activeScenarioTitle?: string;
}

function renderInlineFormatting(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-[11px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={i} className="text-slate-300 italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

function FormattedMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-2 text-slate-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-0.5" />;

        // Header ###
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={idx} className="text-xs font-bold text-white flex items-center gap-1.5 pb-1 border-b border-emerald-500/20 mt-2">
              {renderInlineFormatting(trimmed.replace(/^###\s+/, ""))}
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={idx} className="text-sm font-bold text-white pb-1 border-b border-slate-800 mt-2">
              {renderInlineFormatting(trimmed.replace(/^##\s+/, ""))}
            </h2>
          );
        }

        // List item - or *
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 text-xs leading-relaxed text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
              <span>{renderInlineFormatting(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered list item: 1. 2.
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 text-xs leading-relaxed text-slate-300 mt-1">
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono text-[10px] font-bold mt-0.5 flex-shrink-0">
                {numMatch[1]}
              </span>
              <span>{renderInlineFormatting(numMatch[2])}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-xs leading-relaxed text-slate-300">
            {renderInlineFormatting(line)}
          </p>
        );
      })}
    </div>
  );
}

const AGENT_META: Record<
  string,
  { color: string; badgeBg: string; border: string; icon: any; title: string; track: string }
> = {
  Recon: {
    color: "#22d3ee",
    badgeBg: "bg-cyan-950/70 text-cyan-300",
    border: "border-cyan-500/40",
    icon: ShieldAlert,
    title: "Recon Agent",
    track: "Track 01 (Connected Data)",
  },
  Historian: {
    color: "#ec4899",
    badgeBg: "bg-pink-950/70 text-pink-300",
    border: "border-pink-500/40",
    icon: Brain,
    title: "Historian Agent",
    track: "Track 02 & 03 (Brain & ADRs)",
  },
  Executor: {
    color: "#10b981",
    badgeBg: "bg-emerald-950/70 text-emerald-300",
    border: "border-emerald-500/40",
    icon: CheckCircle2,
    title: "Executor Agent",
    track: "Track 01 & 02 (Remediation)",
  },
  System: {
    color: "#f59e0b",
    badgeBg: "bg-amber-950/70 text-amber-300",
    border: "border-amber-500/40",
    icon: Sparkles,
    title: "System Coordinator",
    track: "FalkorDB Multigraph",
  },
};

export default function AgentTracePanel({
  events,
  isStreaming,
  currentAgent,
  activeStage,
  playbackSpeed = 1,
  onSpeedChange,
  onOpenWorkflows,
  activeScenarioTitle,
}: AgentTracePanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleCopyDispatch = (text: string) => {
    const dispatchCard = `🚨 *NexusGraph Incident Remediation Dispatch*\n\n${text}\n\n*Verified by FalkorDB Multigraph Engine* (org_brain & procedural_memory)`;
    navigator.clipboard.writeText(dispatchCard);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-scroll as events stream in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="flex flex-col h-full bg-[#0a0d16] rounded-xl border border-slate-800/80 overflow-hidden shadow-2xl">
      {/* Header Pipeline Tracker */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-100">Autonomous Swarm Live Stream</h2>
            {activeScenarioTitle && (
              <span
                title={activeScenarioTitle}
                className="hidden xl:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 truncate max-w-[320px] cursor-help"
              >
                {activeScenarioTitle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onOpenWorkflows && (
              <button
                onClick={onOpenWorkflows}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-semibold transition shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                title="Open Hackathon Evaluation Workflows Suite"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Workflows ⚡</span>
              </button>
            )}
            {/* Speed Pacing Toggle for Demo & Judges */}
            {onSpeedChange && (
              <div className="flex items-center bg-slate-950/90 border border-slate-800 rounded-lg p-0.5 text-[10px] font-mono">
                <span className="px-1.5 text-slate-500">Pacing:</span>
                {[0.5, 1, 2].map((sp) => (
                  <button
                    key={sp}
                    onClick={() => onSpeedChange(sp)}
                    className={`px-1.5 py-0.5 rounded transition ${
                      playbackSpeed === sp
                        ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/40"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {sp}x
                  </button>
                ))}
              </div>
            )}
            {isStreaming ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[11px] font-mono text-cyan-300 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Swarm Active</span>
              </div>
            ) : (
              <div className="text-[11px] font-mono text-slate-500">Ready</div>
            )}
          </div>
        </div>

        {/* 3-Agent Stepper Visualizer */}
        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          {(["Recon", "Historian", "Executor"] as const).map((agentName, idx) => {
            const meta = AGENT_META[agentName];
            const isActive = isStreaming && currentAgent === agentName;
            const hasPassed = events.some((e) => e.agent === agentName);

            return (
              <div
                key={agentName}
                className={`p-2 rounded-lg border transition-all flex items-center justify-between ${
                  isActive
                    ? "bg-slate-800/90 border-cyan-400/70 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                    : hasPassed
                    ? "bg-slate-900/80 border-slate-700/80 text-slate-300"
                    : "bg-slate-950/50 border-slate-800/50 text-slate-600"
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[10px] text-slate-500 font-bold">{idx + 1}.</span>
                  <span className="font-semibold truncate" style={{ color: isActive ? meta.color : undefined }}>
                    {agentName}
                  </span>
                </div>
                {hasPassed && !isActive && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {isActive && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stream Messages Container */}
      <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-3 font-sans text-xs">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <Brain className="w-10 h-10 mb-3 text-slate-700 stroke-[1.5]" />
            <p className="font-semibold text-slate-400 mb-1">No Active Investigation</p>
            <p className="text-[11px] max-w-xs text-slate-500">
              Select a 1-Click Judge Scenario from above or enter an alert query to trigger the 3-agent FalkorDB swarm.
            </p>
          </div>
        ) : (
          events.map((evt, idx) => {
            const meta = AGENT_META[evt.agent] || AGENT_META.System;
            const Icon = meta.icon;

            return (
              <div
                key={evt.step_id || idx}
                className={`rounded-xl border ${meta.border} bg-slate-900/75 p-3.5 transition-all shadow-md hover:border-opacity-80`}
              >
                {/* Agent & Stage Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-slate-800">
                      <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                    </div>
                    <span className="font-bold text-slate-200">{meta.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${meta.badgeBg}`}>
                      {meta.track}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[10px]">
                    <Clock className="w-3 h-3" />
                    <span>{evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ""}</span>
                  </div>
                </div>

                {/* Cognitive Reasoning Thought */}
                <div className="text-slate-300 leading-relaxed font-sans mb-2.5 pl-1 text-[12px]">
                  {renderInlineFormatting(evt.thought)}
                </div>

                {/* MCP Tool Call Pill */}
                {evt.tool_call && (
                  <div className="mb-2.5 flex items-center gap-2 p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-[11px]">
                    <span className="text-cyan-400 font-semibold">⚡ MCP:</span>
                    <span className="text-slate-200">{evt.tool_call.tool}</span>
                    <span className="text-slate-500 text-[10px]">
                      ({JSON.stringify(evt.tool_call.params).slice(0, 50)}
                      {JSON.stringify(evt.tool_call.params).length > 50 ? "..." : ""})
                    </span>
                  </div>
                )}

                {/* Cypher Query Trace Block */}
                {evt.cypher_trace && (
                  <div className="rounded-lg bg-slate-950 border border-slate-800/90 overflow-hidden font-mono mb-2">
                    <div className="flex items-center justify-between px-2.5 py-1 bg-slate-900/80 border-b border-slate-800 text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Code2 className="w-3 h-3 text-amber-400" />
                        <span>FalkorDB Cypher</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-semibold">
                          {evt.cypher_trace.execution_time_ms}ms
                        </span>
                        <span className="text-slate-600">·</span>
                        <span>{evt.cypher_trace.nodes_affected} nodes</span>
                      </div>
                    </div>
                    <pre className="p-2.5 text-[11px] text-cyan-200/90 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                      {evt.cypher_trace.cypher_query}
                    </pre>
                  </div>
                )}

                {/* Final Explanation Display */}
                {evt.is_final && evt.final_answer && (
                  <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/50 shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Autonomous Incident Remediation Report</span>
                      </div>
                      <button
                        onClick={() => handleCopyDispatch(evt.final_answer || "")}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-500/40 text-[10px] text-emerald-200 transition-all font-mono"
                        title="Copy formatted post-mortem for Slack or PagerDuty"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? "Copied!" : "Copy Dispatch (Slack)"}</span>
                      </button>
                    </div>
                    <div className="text-slate-200 font-sans text-xs leading-relaxed space-y-2">
                      <FormattedMarkdown content={evt.final_answer} />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
