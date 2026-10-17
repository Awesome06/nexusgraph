/**
 * NexusGraph Frontend Contract
 * Single source of truth for UI components, Stitch layout generation, and 21st.dev micro-components.
 * Strictly reflects FastAPI routes, Pydantic schemas, SSE event shapes, and design tokens.
 */

// === Base URL ===
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// === Graph & Entity Types ===
export type EntityLabel =
  | "Service"
  | "Person"
  | "Team"
  | "Commit"
  | "ADR"
  | "Incident"
  | "Pattern"
  | "RunbookStep"
  | "Task"
  | "Finding"
  | "ProposedAction"
  | "Entity";

export type EntityType =
  | "service"
  | "person"
  | "team"
  | "commit"
  | "adr"
  | "incident"
  | "pattern"
  | "runbook_step"
  | "generic";

export type RelationshipType =
  | "DEPENDS_ON"
  | "AUTHORED"
  | "GOVERNS"
  | "OWNS"
  | "REVIEWED"
  | "PART_OF"
  | "LED_TO"
  | "RESOLVED_BY"
  | "REFERENCES";

export type GraphNamespace =
  | "org_brain"
  | "procedural_memory"
  | `blackboard_${string}`
  | string;

export interface NodePayload {
  id: string;
  name: string;
  label: EntityLabel | string;
  labels: string[];
  properties: Record<string, unknown>;
  type: EntityType | string;
  color?: string | null;
  val?: number | null;
}

export interface EdgePayload {
  id: string;
  source: string;
  target: string;
  type: RelationshipType | string;
  label: string;
  properties: Record<string, unknown>;
  highlighted: boolean;
}

export interface SubgraphPayload {
  nodes: NodePayload[];
  edges: EdgePayload[];
  cypher_query: string;
  highlight_path: string[];
}

// === Cypher Trace & Tool Types ===
export interface CypherTrace {
  tool_name: string;
  agent_name: "Recon" | "Historian" | "Executor" | "System" | string;
  cypher_query: string;
  parameters: Record<string, unknown>;
  execution_time_ms: number;
  nodes_affected: number;
  relationships_affected: number;
  explanation: string;
}

// === Agent SSE Event Stream ===
export type AgentName = "Recon" | "Historian" | "Executor" | "System";
export type AgentStage =
  | "Stage 1: Blast Radius"
  | "Stage 2: Lineage & ADR"
  | "Stage 3: Remediation"
  | "Final"
  | "Error"
  | string;
export type AgentStatus = "running" | "success" | "error" | "complete";

export interface AgentStepEvent {
  step_id: string;
  session_id: string;
  agent: AgentName;
  stage: AgentStage;
  status: AgentStatus;
  thought: string;
  tool_call?: Record<string, unknown> | null;
  cypher_trace?: CypherTrace | null;
  subgraph?: SubgraphPayload | null;
  timestamp: string;
  is_final: boolean;
  final_answer?: string | null;
}

// === Scenario & Benchmark Types ===
export interface ScenarioInfo {
  id: string;
  title: string;
  description: string;
  trigger_type: string;
  suggested_query: string;
  track_focus: string[];
}

export interface BenchmarkComparison {
  hops: number;
  falkordb_latency_ms: number;
  falkordb_speedup: string;
  falkordb_path_count: number;
  sql_latency_ms: number;
  sql_path_count: number;
}

export interface BenchmarkResponse {
  target_service: string;
  max_hops: number;
  results: BenchmarkComparison[];
  summary: {
    max_speedup: string;
    falkordb_scaling: string;
    sql_scaling: string;
    verdict: string;
  };
}

export interface HealthResponse {
  status: "healthy" | "unhealthy" | string;
  service: string;
  falkordb_host: string;
  schema_status: {
    native_connected: boolean;
    graphs: string[];
    [key: string]: unknown;
  };
}

export interface CypherQueryResponse {
  graph_name: string;
  cypher_query: string;
  execution_time_ms: number;
  record_count: number;
  records: Array<Record<string, unknown>>;
  subgraph: SubgraphPayload;
}

export interface ChaosResponse {
  status: "injected" | "reset" | string;
  affected_service?: string;
  affected_nodes?: string[];
  message?: string;
  [key: string]: unknown;
}

export interface TelemetrySpan {
  caller_service?: string;
  parent_service?: string;
  callee_service?: string;
  service_name?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

// === Design Tokens ===
export const DESIGN_TOKENS = {
  colors: {
    background: "#07090e",
    backgroundSubtle: "#0b0f19",
    backgroundElevated: "#0f172a",
    foreground: "#f8fafc",
    foregroundMuted: "#94a3b8",
    border: "rgba(255, 255, 255, 0.08)",
    borderElevated: "rgba(255, 255, 255, 0.12)",
    accentCyan: "#06b6d4",
    accentAmber: "#f59e0b",
    accentRose: "#f43f5e",
    accentEmerald: "#10b981",
    accentIndigo: "#6366f1",
  },
  typography: {
    fontSans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  },
} as const;

export const NODE_COLORS: Record<string, string> = {
  Service: "#06b6d4",        // cyan-500
  Person: "#3b82f6",         // blue-500
  Team: "#6366f1",           // indigo-500
  Commit: "#f59e0b",         // amber-500
  ADR: "#10b981",            // emerald-500
  Incident: "#f43f5e",       // rose-500
  Pattern: "#a855f7",        // purple-500
  RunbookStep: "#ec4899",    // pink-500
  Task: "#14b8a6",           // teal-500
  Finding: "#eab308",        // yellow-500
  ProposedAction: "#84cc16", // lime-500
  Unknown: "#64748b",        // slate-500
};

export const STATUS_COLORS: Record<AgentStatus, { bg: string; text: string; border: string }> = {
  running: {
    bg: "rgba(6, 182, 212, 0.15)",
    text: "#22d3ee",
    border: "rgba(6, 182, 212, 0.4)",
  },
  success: {
    bg: "rgba(16, 185, 129, 0.15)",
    text: "#34d399",
    border: "rgba(16, 185, 129, 0.4)",
  },
  complete: {
    bg: "rgba(99, 102, 241, 0.15)",
    text: "#818cf8",
    border: "rgba(99, 102, 241, 0.4)",
  },
  error: {
    bg: "rgba(244, 63, 94, 0.15)",
    text: "#fb7185",
    border: "rgba(244, 63, 94, 0.4)",
  },
};

// === API Endpoints Map ===
export const ENDPOINTS = {
  health: () => `${API_BASE}/api/health`,
  scenarios: () => `${API_BASE}/api/scenarios`,
  seed: (sessionId: string = "demo") => `${API_BASE}/api/seed?session_id=${encodeURIComponent(sessionId)}`,
  graph: (graphName: string) => `${API_BASE}/api/graph/${encodeURIComponent(graphName)}`,
  investigateStream: (params: {
    query: string;
    targetService?: string;
    sessionId?: string;
    scenarioId?: string;
  }) => {
    const url = new URL(`${API_BASE}/api/investigate/stream`);
    url.searchParams.set("query", params.query);
    if (params.targetService) url.searchParams.set("target_service", params.targetService);
    if (params.sessionId) url.searchParams.set("session_id", params.sessionId);
    if (params.scenarioId) url.searchParams.set("scenario_id", params.scenarioId);
    return url.toString();
  },
  investigateSync: () => `${API_BASE}/api/investigate`,
  benchmark: (targetService: string = "ledger-db", maxHops: number = 4) =>
    `${API_BASE}/api/benchmark/graph-vs-sql?target_service=${encodeURIComponent(targetService)}&max_hops=${maxHops}`,
  chaosInject: () => `${API_BASE}/api/chaos/inject`,
  chaosReset: () => `${API_BASE}/api/chaos/reset`,
  cypherQuery: () => `${API_BASE}/api/cypher/query`,
  telemetrySpans: () => `${API_BASE}/api/telemetry/spans`,
} as const;
