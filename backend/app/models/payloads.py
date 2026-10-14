"""Pydantic schemas for FalkorDB subgraphs, Cypher traces, and Agent events."""

from typing import Any
from pydantic import BaseModel, Field


class NodePayload(BaseModel):
    id: str = Field(description="Unique node identifier")
    name: str = Field(default="", description="Human-readable node name or title")
    label: str = Field(default="Entity", description="Primary label e.g. Service, Person, ADR")
    labels: list[str] = Field(default_factory=list, description="All labels applied to the node")
    properties: dict[str, Any] = Field(default_factory=dict, description="Raw node properties")
    type: str = Field(default="generic", description="UI categorization type")
    color: str | None = Field(default=None, description="Hex or CSS color for graph rendering")
    val: float | None = Field(default=1.0, description="Node visual weight / radius")


class EdgePayload(BaseModel):
    id: str = Field(description="Unique edge identifier")
    source: str = Field(description="Source node ID")
    target: str = Field(description="Target node ID")
    type: str = Field(description="Relationship type, e.g. DEPENDS_ON, AUTHORED, GOVERNS")
    label: str = Field(default="", description="Relationship display label")
    properties: dict[str, Any] = Field(default_factory=dict, description="Edge properties")
    highlighted: bool = Field(default=False, description="Whether this edge is in active traversal path")


class CypherTrace(BaseModel):
    tool_name: str = Field(description="Name of the MCP tool invoked")
    agent_name: str = Field(description="Agent executing the query (Recon, Historian, Executor)")
    cypher_query: str = Field(description="Exact Cypher query sent to FalkorDB")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Cypher query parameters")
    execution_time_ms: float = Field(default=0.0, description="Execution time in milliseconds")
    nodes_affected: int = Field(default=0, description="Number of nodes returned or mutated")
    relationships_affected: int = Field(default=0, description="Number of edges returned or mutated")
    explanation: str = Field(default="", description="Plain-English explanation of why this query was executed")


class SubgraphPayload(BaseModel):
    nodes: list[NodePayload] = Field(default_factory=list)
    edges: list[EdgePayload] = Field(default_factory=list)
    cypher_query: str = Field(default="")
    highlight_path: list[str] = Field(default_factory=list, description="Node IDs in the causal/traversal chain")


class AgentStepEvent(BaseModel):
    step_id: str
    session_id: str
    agent: str = Field(description="Recon | Historian | Executor | System")
    stage: str = Field(description="Stage 1: Blast Radius | Stage 2: Lineage & ADR | Stage 3: Remediation | Final")
    status: str = Field(default="running", description="running | success | error | complete")
    thought: str = Field(default="", description="Agent's cognitive reasoning stream")
    tool_call: dict[str, Any] | None = None
    cypher_trace: CypherTrace | None = None
    subgraph: SubgraphPayload | None = None
    timestamp: str
    is_final: bool = False
    final_answer: str | None = None


class InvestigateRequest(BaseModel):
    query: str = Field(..., description="Investigation prompt or alert message")
    scenario_id: str | None = Field(default=None, description="Pre-seeded demo scenario ID if clicked")
    session_id: str | None = Field(default=None, description="Session ID for blackboard isolation")
    target_service: str | None = Field(default=None, description="Specific service to anchor investigation")


class ScenarioInfo(BaseModel):
    id: str
    title: str
    description: str
    trigger_type: str
    suggested_query: str
    track_focus: list[str]


class GraphSummary(BaseModel):
    name: str
    node_count: int
    edge_count: int
    labels: list[str]
    relationship_types: list[str]
