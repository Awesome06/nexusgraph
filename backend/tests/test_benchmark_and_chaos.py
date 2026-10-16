"""Tests for Benchmark, Chaos Engineering, and Cypher Query functionality.

Follows test-discipline:
- Mandatory AAA (Arrange-Act-Assert) pattern
- Deterministic assertions
"""

import pytest
from app.db.falkor_client import FalkorManager
from app.db.seed import seed_all_graphs
from app.db.benchmark import run_graph_vs_sql_benchmark
from app.db.chaos import inject_failure, reset_chaos


@pytest.fixture
def manager():
    mgr = FalkorManager(host="localhost", port=6379)
    seed_all_graphs(mgr, session_id="test_suite")
    return mgr


def test_graph_vs_sql_benchmark(manager):
    # Arrange
    target = "ledger-db"

    # Act
    bench = run_graph_vs_sql_benchmark(target_service=target, max_hops=4, manager=manager)

    # Assert
    assert bench["benchmark_title"] is not None
    assert bench["target_service"] == "ledger-db"
    assert len(bench["comparisons"]) == 4
    for row in bench["comparisons"]:
        assert row["falkordb_graphblas_ms"] > 0
        assert row["relational_recursive_sql_ms"] > row["falkordb_graphblas_ms"]
        assert "x" in row["speedup"]


def test_chaos_injection_and_reset(manager):
    # Arrange
    target = "auth-service"

    # Act 1: Inject chaos
    chaos_res = inject_failure(target_service=target, manager=manager)

    # Assert 1: Service is degraded in graph
    assert chaos_res["status"] == "injected"
    assert chaos_res["target_service"] == "auth-service"
    records, _ = manager.query("org_brain", "MATCH (s:Service {name: 'auth-service'}) RETURN s.status AS status")
    assert len(records) > 0
    status1 = records[0][0].properties.get("status") if hasattr(records[0][0], "properties") else records[0][0]
    assert status1 == "DEGRADED"

    # Act 2: Reset chaos
    reset_res = reset_chaos(manager=manager)

    # Assert 2: Graph returned to healthy baseline
    assert reset_res["status"] == "success"
    records_reset, _ = manager.query("org_brain", "MATCH (s:Service {name: 'auth-service'}) RETURN s.status AS status")
    status2 = records_reset[0][0].properties.get("status") if hasattr(records_reset[0][0], "properties") else records_reset[0][0]
    assert status2 == "HEALTHY"
