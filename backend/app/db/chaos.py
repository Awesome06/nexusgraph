"""Chaos Engineering Failure Injection Engine for NexusGraph.

Enables on-demand, non-deterministic incident generation to evaluate the multi-agent
swarm's ability to diagnose and remediate arbitrary microservice failures beyond
pre-scripted scenarios.
"""

import random
from typing import Any, Dict, Optional
from app.db.falkor_client import FalkorManager, get_falkor_manager
from app.db.seed import seed_all_graphs

SERVICES_POOL = [
    {"name": "auth-service", "role": "JWKS Token Authentication", "tier": "Tier-1"},
    {"name": "payment-engine", "role": "Card Processing & Transaction Ledger", "tier": "Tier-1"},
    {"name": "fraud-scorer", "role": "ML Realtime Risk Evaluation", "tier": "Tier-2"},
    {"name": "notification-worker", "role": "Async Notification Dispatcher", "tier": "Tier-3"},
]

CHAOS_TEMPLATES = [
    {
        "type": "LATENCY_CASCADE",
        "description": "gRPC connection exhaustion and thread starvation",
        "latency_p99": 4200,
        "error_rate": 0.35,
        "violation": "ADR-002: Maximum allowed gRPC timeout exceeded"
    },
    {
        "type": "CIRCUIT_BREAKER_TRIPPED",
        "description": "Cascading downstream connection dropouts",
        "latency_p99": 3100,
        "error_rate": 0.52,
        "violation": "Transient upstream threadpool starvation"
    },
    {
        "type": "MEMORY_PRESSURE",
        "description": "Unbounded cache growth and GC pause degradation",
        "latency_p99": 2800,
        "error_rate": 0.22,
        "violation": "ADR-001: Cache eviction strategy bypass detected"
    }
]


def inject_failure(
    target_service: Optional[str] = None,
    manager: Optional[FalkorManager] = None
) -> Dict[str, Any]:
    """Injects a controlled failure into a microservice in org_brain."""
    manager = manager or get_falkor_manager()

    target = target_service
    if not target:
        selected = random.choice(SERVICES_POOL)
        target = selected["name"]

    chaos = random.choice(CHAOS_TEMPLATES)

    # Mutate the service state in org_brain
    cypher_mutate = (
        "MATCH (s:Service {name: $service_name}) "
        "SET s.status = 'DEGRADED', "
        "    s.latency_p99 = $p99, "
        "    s.error_rate = $err_rate, "
        "    s.failure_type = $ftype "
        "RETURN s.name AS name, s.status AS status"
    )

    manager.query(
        "org_brain",
        cypher_mutate,
        {
            "service_name": target,
            "p99": chaos["latency_p99"],
            "err_rate": chaos["error_rate"],
            "ftype": chaos["type"]
        }
    )

    return {
        "status": "injected",
        "target_service": target,
        "failure_type": chaos["type"],
        "description": chaos["description"],
        "latency_p99_ms": chaos["latency_p99"],
        "error_rate": chaos["error_rate"],
        "policy_violation": chaos["violation"],
        "suggested_query": f"Investigate critical alert on {target}: {chaos['description']}"
    }


def reset_chaos(manager: Optional[FalkorManager] = None) -> Dict[str, str]:
    """Resets org_brain and all graphs back to healthy baseline."""
    manager = manager or get_falkor_manager()
    seed_all_graphs(manager, session_id="demo")
    return {"status": "success", "message": "Graph topology restored to baseline healthy state."}
