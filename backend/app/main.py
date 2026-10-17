"""FastAPI Server for NexusGraph.

Provides:
- Server-Sent Events (SSE) streaming of multi-agent reasoning & Cypher traces
- Multigraph visualizer endpoints (org_brain, procedural_memory, blackboard)
- FastMCP tool invocation endpoints
- GraphBLAS vs SQL traversal benchmark engine
- Chaos engineering failure injection and reset endpoints
- Ad-hoc openCypher query scratchpad execution
- OpenTelemetry distributed trace span ingestion
"""

import json
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import settings
from app.db.falkor_client import get_falkor_manager
from app.db.schema import create_graph_indexes, verify_graph_schema
from app.db.seed import seed_all_graphs
from app.agents.orchestrator import (
    stream_swarm_investigation,
    run_swarm_pipeline,
    DEMO_SCENARIOS,
)
from app.mcp_server import graph_tools
from app.models.payloads import InvestigateRequest, SubgraphPayload
from app.db.benchmark import run_graph_vs_sql_benchmark
from app.db.chaos import inject_failure, reset_chaos

# Configure logging
logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = logging.getLogger("nexusgraph.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize FalkorDB indexes and synthetic seed dataset."""
    logger.info("Initializing NexusGraph backend on FalkorDB...")
    manager = get_falkor_manager()
    try:
        create_graph_indexes(manager)
        if settings.seed_on_startup:
            seed_all_graphs(manager, session_id="demo")
    except Exception as exc:
        logger.warning("Startup seeding notice: %s", exc)
    yield
    logger.info("NexusGraph backend shutting down.")


app = FastAPI(
    title="NexusGraph API",
    description="Autonomous Multi-Agent Engineering Brain & Incident Remediation Swarm on FalkorDB",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend and cloud deployments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
@app.get("/api/health")
def get_health() -> Dict[str, Any]:
    """Health check and FalkorDB multigraph status."""
    manager = get_falkor_manager()
    schema_status = verify_graph_schema(manager)
    return {
        "status": "healthy",
        "service": "NexusGraph Swarm Engine",
        "falkordb_host": f"{settings.falkordb_host}:{settings.falkordb_port}",
        "schema_status": schema_status
    }


@app.get("/api/scenarios")
def get_scenarios():
    """Returns the list of 1-Click judge demonstration scenarios."""
    return DEMO_SCENARIOS


@app.post("/api/seed")
def trigger_seed(session_id: str = "demo") -> Dict[str, str]:
    """Resets and reseeds all FalkorDB multigraph namespaces."""
    manager = get_falkor_manager()
    seed_all_graphs(manager, session_id=session_id)
    return {"message": "Successfully seeded org_brain, procedural_memory, and blackboard."}


@app.get("/api/graph/{graph_name}")
def get_graph_data(graph_name: str) -> SubgraphPayload:
    """Returns the complete node & edge topology of a selected multigraph."""
    manager = get_falkor_manager()
    allowed_prefixes = ("org_brain", "procedural_memory", "blackboard_")
    if not any(graph_name.startswith(p) for p in allowed_prefixes):
        raise HTTPException(status_code=400, detail=f"Invalid graph namespace: {graph_name}")
    
    return manager.get_full_graph(graph_name)


@app.get("/api/investigate/stream")
async def stream_investigation(
    query: str = Query(..., description="Alert message or investigation prompt"),
    target_service: Optional[str] = Query("payment-engine", description="Anchor service"),
    session_id: Optional[str] = Query(None, description="Session ID for blackboard isolation"),
    scenario_id: Optional[str] = Query(None, description="Scenario ID to route specialized workflow")
):
    """Server-Sent Events (SSE) streaming endpoint for live agent thoughts and Cypher traces."""
    active_session_id = session_id or f"session_{uuid.uuid4().hex[:6]}"
    manager = get_falkor_manager()

    async def event_generator():
        try:
            async for step_event in stream_swarm_investigation(
                session_id=active_session_id,
                query=query,
                scenario_id=scenario_id,
                target_service=target_service or "payment-engine",
                manager=manager
            ):
                payload_json = json.dumps(step_event.model_dump(), default=str)
                yield f"data: {payload_json}\n\n"
        except Exception as exc:
            logger.error("SSE stream error: %s", exc, exc_info=True)
            err_payload = json.dumps({
                "agent": "System",
                "stage": "Error",
                "status": "error",
                "thought": f"Streaming encountered an unexpected exception: {exc}",
                "is_final": True
            })
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/investigate")
def run_investigation(req: InvestigateRequest):
    """Synchronous endpoint to execute the 3-agent swarm pipeline."""
    session_id = req.session_id or f"session_{uuid.uuid4().hex[:6]}"
    manager = get_falkor_manager()
    result = run_swarm_pipeline(
        session_id=session_id,
        query=req.query,
        scenario_id=req.scenario_id,
        target_service=req.target_service or "payment-engine",
        manager=manager
    )
    return result


@app.post("/api/mcp/tool/{tool_name}")
def execute_mcp_tool(tool_name: str, payload: Dict[str, Any] = {}):
    """Directly invokes an individual MCP tool for verification."""
    manager = get_falkor_manager()
    tools_map = {
        "trace_blast_radius": lambda: graph_tools.trace_blast_radius(
            service_name=payload.get("service_name", "payment-engine"),
            max_hops=int(payload.get("max_hops", 4)),
            manager=manager
        ),
        "find_breaking_commit_and_owner": lambda: graph_tools.find_breaking_commit_and_owner(
            service_name=payload.get("service_name", "payment-engine"),
            manager=manager
        ),
        "find_shortest_ownership_path": lambda: graph_tools.find_shortest_ownership_path(
            person_name=payload.get("person_name", "Arjun Mehta"),
            service_name=payload.get("service_name", "payment-engine"),
            manager=manager
        ),
        "compute_critical_bottlenecks": lambda: graph_tools.compute_critical_bottlenecks(manager=manager),
        "recall_or_update_procedural_memory": lambda: graph_tools.recall_or_update_procedural_memory(
            symptom_signature=payload.get("symptom_signature", "cascading-timeout-ledger"),
            new_action=payload.get("new_action"),
            manager=manager
        ),
        "mutate_graph_action": lambda: graph_tools.mutate_graph_action(
            service_name=payload.get("service_name", "payment-engine"),
            action=payload.get("action", "ROLLBACK_CONFIG_AND_FLUSH_POOL"),
            session_id=payload.get("session_id", "demo"),
            manager=manager
        )
    }

    if tool_name not in tools_map:
        raise HTTPException(status_code=404, detail=f"Unknown tool: {tool_name}. Available: {list(tools_map.keys())}")

    return tools_map[tool_name]()


@app.get("/api/benchmark/graph-vs-sql")
def get_graph_vs_sql_benchmark(
    target_service: str = "ledger-db",
    max_hops: int = 4
):
    """Benchmarks variable-length path traversal in FalkorDB vs relational recursive CTE joins."""
    manager = get_falkor_manager()
    return run_graph_vs_sql_benchmark(
        target_service=target_service,
        max_hops=max_hops,
        manager=manager
    )


@app.post("/api/chaos/inject")
def trigger_chaos_injection(payload: Dict[str, Any] = {}):
    """Injects an on-demand microservice failure into org_brain to evaluate dynamic swarm remediation."""
    manager = get_falkor_manager()
    target_service = payload.get("target_service")
    return inject_failure(target_service=target_service, manager=manager)


@app.post("/api/chaos/reset")
def trigger_chaos_reset():
    """Resets all graphs to their baseline healthy topology."""
    manager = get_falkor_manager()
    return reset_chaos(manager=manager)


@app.post("/api/cypher/query")
def execute_custom_cypher(payload: Dict[str, Any]):
    """Executes an arbitrary openCypher query directly against a selected FalkorDB namespace."""
    graph_name = payload.get("graph_name", "org_brain")
    cypher = payload.get("query", "").strip()
    if not cypher:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    manager = get_falkor_manager()
    try:
        records, elapsed_ms = manager.query(graph_name, cypher)
        subgraph = manager.extract_subgraph(records, cypher=cypher)
        return {
            "graph_name": graph_name,
            "cypher_query": cypher,
            "execution_time_ms": round(elapsed_ms, 2),
            "record_count": len(records),
            "subgraph": subgraph
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cypher execution error: {exc}")


@app.post("/api/telemetry/spans")
def ingest_telemetry_spans(spans: List[Dict[str, Any]]):
    """Ingests OpenTelemetry distributed trace spans to update service latency in org_brain."""
    manager = get_falkor_manager()
    updated_edges = 0
    for span in spans:
        caller = span.get("caller_service") or span.get("parent_service")
        callee = span.get("callee_service") or span.get("service_name")
        duration = span.get("duration_ms", 120)
        if caller and callee and caller != callee:
            cypher = (
                "MATCH (c:Service {name: $caller})-[r:DEPENDS_ON]->(target:Service {name: $callee}) "
                "SET r.p99_latency_ms = $duration, r.last_span_at = timestamp() "
                "RETURN count(r) AS updated"
            )
            manager.query("org_brain", cypher, {"caller": caller, "callee": callee, "duration": duration})
            updated_edges += 1
            
    return {
        "status": "success",
        "spans_processed": len(spans),
        "edges_updated": updated_edges
    }

