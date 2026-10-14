"""Unit and Integration tests for NexusGraph Multi-Agent Swarm and MCP Cypher tools.

Follows test-discipline:
- Mandatory AAA (Arrange-Act-Assert) pattern
- No arbitrary sleep calls
- Deterministic assertions
"""

import pytest
from app.db.falkor_client import FalkorManager
from app.db.seed import seed_all_graphs
from app.mcp_server.graph_tools import (
    trace_blast_radius,
    find_breaking_commit_and_owner,
    find_shortest_ownership_path,
    compute_critical_bottlenecks,
    recall_or_update_procedural_memory,
    mutate_graph_action,
)
from app.agents.orchestrator import run_swarm_pipeline


@pytest.fixture
def test_manager():
    """Arrange: initialize a dedicated FalkorManager and seed all graphs."""
    manager = FalkorManager(host="localhost", port=6379)
    seed_all_graphs(manager, session_id="test_session")
    return manager


def test_seed_populates_org_brain(test_manager):
    # Arrange
    manager = test_manager

    # Act
    subgraph = manager.get_full_graph("org_brain")

    # Assert
    assert len(subgraph.nodes) >= 6, "Expected at least 6 microservices in org_brain"
    node_names = [n.properties.get("name") for n in subgraph.nodes]
    assert "api-gateway" in node_names
    assert "payment-engine" in node_names
    assert "ledger-db" in node_names


def test_tool_trace_blast_radius(test_manager):
    # Arrange
    manager = test_manager
    service = "ledger-db"

    # Act
    result = trace_blast_radius(service_name=service, max_hops=4, manager=manager)

    # Assert
    assert result["tool_name"] == "trace_blast_radius"
    assert result["target_service"] == "ledger-db"
    assert result["impacted_count"] > 0
    assert result["blast_radius_score"] > 0.0
    assert result["cypher_trace"] is not None
    assert result["subgraph"] is not None


def test_tool_find_breaking_commit_and_owner(test_manager):
    # Arrange
    manager = test_manager
    service = "payment-engine"

    # Act
    result = find_breaking_commit_and_owner(service_name=service, manager=manager)

    # Assert
    assert result["tool_name"] == "find_breaking_commit_and_owner"
    assert result["adr_violation_detected"] is True
    root_cause = result["root_cause_commit"]
    assert root_cause is not None
    assert root_cause["commit_sha"] == "8f92a1c"
    assert root_cause["author"] == "Arjun Mehta"
    assert "@arjun" in root_cause["contact"]


def test_tool_find_shortest_ownership_path(test_manager):
    # Arrange
    manager = test_manager
    person = "Arjun Mehta"
    service = "payment-engine"

    # Act
    result = find_shortest_ownership_path(person_name=person, service_name=service, manager=manager)

    # Assert
    assert result["tool_name"] == "find_shortest_ownership_path"
    assert result["path_length"] > 0
    assert person in result["node_trace"]
    assert service in result["node_trace"]


def test_tool_compute_critical_bottlenecks(test_manager):
    # Arrange
    manager = test_manager

    # Act
    result = compute_critical_bottlenecks(manager=manager)

    # Assert
    assert result["tool_name"] == "compute_critical_bottlenecks"
    assert result["total_analyzed"] >= 6
    bus_risk = any(b["service"] == "fraud-scorer" for b in result["bus_factor_alerts"])
    assert bus_risk is True, "Expected fraud-scorer to be flagged with Bus Factor = 1"


def test_tool_recall_and_update_procedural_memory(test_manager):
    # Arrange
    manager = test_manager
    symptom = "cascading-timeout-ledger"

    # Act 1: Recall
    recall_result = recall_or_update_procedural_memory(symptom_signature=symptom, manager=manager)

    # Assert 1
    assert recall_result["tool_name"] == "recall_or_update_procedural_memory"
    assert recall_result["best_fix"] is not None
    assert "revert_commit" in recall_result["best_fix"]["recommended_fix"]

    # Act 2: Update with increment
    update_result = recall_or_update_procedural_memory(
        symptom_signature=symptom,
        new_action="revert_commit(sha='8f92a1c'); flush_connection_pool(service='payment-engine')",
        manager=manager
    )

    # Assert 2
    assert update_result["is_update"] is True


def test_tool_mutate_graph_action(test_manager):
    # Arrange
    manager = test_manager
    service = "payment-engine"
    session_id = "test_mutate"

    # Act
    result = mutate_graph_action(
        service_name=service,
        action="ROLLBACK_CONFIG_AND_FLUSH_POOL",
        session_id=session_id,
        manager=manager
    )

    # Assert
    assert result["status"] == "EXECUTED_AND_GRAPH_UPDATED"
    assert result["service_name"] == service


def test_full_swarm_pipeline_execution(test_manager):
    # Arrange
    manager = test_manager
    query = "Investigate API Gateway Latency Spike and isolate breaking commit"

    # Act
    pipeline_result = run_swarm_pipeline(
        session_id="test_swarm_e2e",
        query=query,
        target_service="payment-engine",
        manager=manager
    )

    # Assert
    assert pipeline_result["session_id"] == "test_swarm_e2e"
    assert pipeline_result["recon"] is not None
    assert pipeline_result["historian"] is not None
    assert pipeline_result["executor"] is not None
    assert len(pipeline_result["events"]) >= 5
    assert "ADR-002" in pipeline_result["final_explanation"]
    assert "8f92a1c" in pipeline_result["final_explanation"]
