"""Synthetic seed data generator for FalkorDB multigraphs.

Populates:
1. `org_brain`: Microservices, Teams, Engineers, Commits, ADRs, Documents
2. `procedural_memory`: Past incidents, failure symptom patterns, verified runbook steps
3. `blackboard_demo`: Initial multi-agent coordination blackboard
"""

import logging
from typing import Dict, Any
from app.db.falkor_client import FalkorManager, EmulatedNode, EmulatedEdge, get_falkor_manager

logger = logging.getLogger("nexusgraph.seed")


def seed_org_brain(manager: FalkorManager):
    """Populates org_brain graph with company microservices, people, ADRs, and breaking commit."""
    logger.info("Seeding org_brain multigraph...")

    if manager.check_connection():
        # Clear existing org_brain graph
        try:
            manager.query("org_brain", "MATCH (n) DETACH DELETE n")
        except Exception as e:
            logger.debug("Clear notice: %s", e)

        # 1. Services
        cypher_services = """
        CREATE (gw:Service {name: 'api-gateway', tier: 'TIER-1', status: 'DEGRADED', language: 'Go', pagerank_score: 0.85}),
               (auth:Service {name: 'auth-service', tier: 'TIER-1', status: 'HEALTHY', language: 'Rust', pagerank_score: 0.65}),
               (pay:Service {name: 'payment-engine', tier: 'TIER-1', status: 'DEGRADED', language: 'Python', pagerank_score: 0.92}),
               (fraud:Service {name: 'fraud-scorer', tier: 'TIER-2', status: 'HEALTHY', language: 'Python', pagerank_score: 0.40}),
               (ledger:Service {name: 'ledger-db', tier: 'TIER-0', status: 'HEALTHY', language: 'C++', pagerank_score: 0.98}),
               (notif:Service {name: 'notification-worker', tier: 'TIER-3', status: 'HEALTHY', language: 'Go', pagerank_score: 0.25})

        CREATE (gw)-[:DEPENDS_ON {criticality: 'HIGH', protocol: 'gRPC'}]->(auth),
               (gw)-[:DEPENDS_ON {criticality: 'HIGH', protocol: 'REST'}]->(pay),
               (pay)-[:DEPENDS_ON {criticality: 'MEDIUM', protocol: 'gRPC'}]->(fraud),
               (pay)-[:DEPENDS_ON {criticality: 'HIGH', protocol: 'gRPC'}]->(ledger),
               (pay)-[:DEPENDS_ON {criticality: 'LOW', protocol: 'Kafka'}]->(notif)
        """
        manager.query("org_brain", cypher_services)

        # 2. Teams & People
        cypher_teams_people = """
        MATCH (gw:Service {name: 'api-gateway'}),
              (auth:Service {name: 'auth-service'}),
              (pay:Service {name: 'payment-engine'}),
              (fraud:Service {name: 'fraud-scorer'}),
              (ledger:Service {name: 'ledger-db'}),
              (notif:Service {name: 'notification-worker'})

        CREATE (t_core:Team {name: 'Core-Platform', oncall_channel: '#core-oncall'}),
               (t_fin:Team {name: 'FinTech-Squad', oncall_channel: '#fintech-oncall'})

        CREATE (t_core)-[:OWNS]->(gw),
               (t_core)-[:OWNS]->(auth),
               (t_core)-[:OWNS]->(notif),
               (t_fin)-[:OWNS]->(pay),
               (t_fin)-[:OWNS]->(ledger),
               (t_fin)-[:OWNS]->(fraud)

        CREATE (arjun:Person {id: 'arjun', name: 'Arjun Mehta', role: 'Staff Backend Engineer', slack_handle: '@arjun', timezone: 'UTC-5'}),
               (elena:Person {id: 'elena', name: 'Elena Rostova', role: 'Principal Architect', slack_handle: '@elena', timezone: 'UTC+1'}),
               (marcus:Person {id: 'marcus', name: 'Marcus Chen', role: 'DevOps Lead', slack_handle: '@marcus', timezone: 'UTC-8'}),
               (priya:Person {id: 'priya', name: 'Priya Sharma', role: 'Senior Platform Engineer', slack_handle: '@priya', timezone: 'UTC+5:30'}),
               (lucas:Person {id: 'lucas', name: 'Lucas Silva', role: 'Data Engineer', slack_handle: '@lucas', timezone: 'UTC-3'})

        CREATE (elena)-[:MEMBER_OF]->(t_core),
               (marcus)-[:MEMBER_OF]->(t_core),
               (priya)-[:MEMBER_OF]->(t_core),
               (arjun)-[:MEMBER_OF]->(t_fin),
               (lucas)-[:MEMBER_OF]->(t_fin)
        """
        manager.query("org_brain", cypher_teams_people)

        # 3. Architecture Decision Records (ADRs) & Governance
        cypher_adrs = """
        MATCH (pay:Service {name: 'payment-engine'}),
              (ledger:Service {name: 'ledger-db'}),
              (gw:Service {name: 'api-gateway'}),
              (notif:Service {name: 'notification-worker'}),
              (elena:Person {name: 'Elena Rostova'}),
              (priya:Person {name: 'Priya Sharma'})

        CREATE (adr1:ADR {id: 'ADR-001', title: 'Microservice Authentication via JWKS', status: 'ACTIVE', rule_summary: 'All public endpoints must validate auth-service tokens via local JWKS cache with 5m TTL', created_at: '2025-02-10T10:00:00Z'}),
               (adr2:ADR {id: 'ADR-002', title: 'Ledger Strict Latency & Protocol Standards', status: 'ACTIVE', rule_summary: 'All calls to ledger-db must use gRPC with mTLS and timeout <= 200ms', created_at: '2025-05-18T14:30:00Z'}),
               (adr3:ADR {id: 'ADR-003', title: 'Asynchronous Notification Bus', status: 'ACTIVE', rule_summary: 'Outbound user notices must emit via Kafka topic with at-least-once delivery', created_at: '2025-08-01T09:00:00Z'})

        CREATE (elena)-[:DECIDED]->(adr1)-[:GOVERNS]->(gw),
               (elena)-[:DECIDED]->(adr2)-[:GOVERNS]->(pay),
               (elena)-[:DECIDED]->(adr2)-[:GOVERNS]->(ledger),
               (priya)-[:DECIDED]->(adr3)-[:GOVERNS]->(notif)
        """
        manager.query("org_brain", cypher_adrs)

        # 4. Commits & Breaking Commit (8f92a1c authored by Arjun violating ADR-002)
        cypher_commits = """
        MATCH (pay:Service {name: 'payment-engine'}),
              (fraud:Service {name: 'fraud-scorer'}),
              (gw:Service {name: 'api-gateway'}),
              (arjun:Person {name: 'Arjun Mehta'}),
              (lucas:Person {name: 'Lucas Silva'}),
              (priya:Person {name: 'Priya Sharma'})

        CREATE (c_break:Commit {
            sha: '8f92a1c',
            message: 'fix(payment): increase ledger-db connection timeout to 5000ms to tolerate slow queries',
            timestamp: '2026-10-14T07:45:00Z',
            files_changed: '["payment/config/ledger_client.go", "config/env.production"]'
        }),
        (c_fraud:Commit {
            sha: '4a1b89e',
            message: 'feat(fraud): update XGBoost inference score threshold to 0.75',
            timestamp: '2026-10-13T16:20:00Z',
            files_changed: '["fraud/model.py"]'
        }),
        (c_gw:Commit {
            sha: '3c89d2f',
            message: 'perf(gateway): optimize route lookup radix tree',
            timestamp: '2026-10-12T11:00:00Z',
            files_changed: '["gateway/router.go"]'
        })

        CREATE (arjun)-[:AUTHORED]->(c_break)-[:DEPLOYED_TO]->(pay),
               (lucas)-[:AUTHORED]->(c_fraud)-[:DEPLOYED_TO]->(fraud),
               (priya)-[:AUTHORED]->(c_gw)-[:DEPLOYED_TO]->(gw)
        """
        manager.query("org_brain", cypher_commits)
    else:
        # Populate resilient emulated graph for org_brain
        graph_storage = manager.select_graph("org_brain").storage
        graph_storage["nodes"].clear()
        graph_storage["edges"].clear()

        # Services
        s_gw = EmulatedNode(1, ["Service"], {"id": "api-gateway", "name": "api-gateway", "tier": "TIER-1", "status": "DEGRADED", "language": "Go", "pagerank_score": 0.85})
        s_auth = EmulatedNode(2, ["Service"], {"id": "auth-service", "name": "auth-service", "tier": "TIER-1", "status": "HEALTHY", "language": "Rust", "pagerank_score": 0.65})
        s_pay = EmulatedNode(3, ["Service"], {"id": "payment-engine", "name": "payment-engine", "tier": "TIER-1", "status": "DEGRADED", "language": "Python", "pagerank_score": 0.92})
        s_fraud = EmulatedNode(4, ["Service"], {"id": "fraud-scorer", "name": "fraud-scorer", "tier": "TIER-2", "status": "HEALTHY", "language": "Python", "pagerank_score": 0.40})
        s_ledger = EmulatedNode(5, ["Service"], {"id": "ledger-db", "name": "ledger-db", "tier": "TIER-0", "status": "HEALTHY", "language": "C++", "pagerank_score": 0.98})
        s_notif = EmulatedNode(6, ["Service"], {"id": "notification-worker", "name": "notification-worker", "tier": "TIER-3", "status": "HEALTHY", "language": "Go", "pagerank_score": 0.25})

        for s in [s_gw, s_auth, s_pay, s_fraud, s_ledger, s_notif]:
            graph_storage["nodes"][s.id] = s

        # Dependencies
        graph_storage["edges"].append(EmulatedEdge(101, "DEPENDS_ON", s_gw, s_auth, {"criticality": "HIGH", "protocol": "gRPC"}))
        graph_storage["edges"].append(EmulatedEdge(102, "DEPENDS_ON", s_gw, s_pay, {"criticality": "HIGH", "protocol": "REST"}))
        graph_storage["edges"].append(EmulatedEdge(103, "DEPENDS_ON", s_pay, s_fraud, {"criticality": "MEDIUM", "protocol": "gRPC"}))
        graph_storage["edges"].append(EmulatedEdge(104, "DEPENDS_ON", s_pay, s_ledger, {"criticality": "HIGH", "protocol": "gRPC"}))
        graph_storage["edges"].append(EmulatedEdge(105, "DEPENDS_ON", s_pay, s_notif, {"criticality": "LOW", "protocol": "Kafka"}))

        # Teams
        t_core = EmulatedNode(10, ["Team"], {"id": "Core-Platform", "name": "Core-Platform", "oncall_channel": "#core-oncall"})
        t_fin = EmulatedNode(11, ["Team"], {"id": "FinTech-Squad", "name": "FinTech-Squad", "oncall_channel": "#fintech-oncall"})
        graph_storage["nodes"][t_core.id] = t_core
        graph_storage["nodes"][t_fin.id] = t_fin

        graph_storage["edges"].append(EmulatedEdge(106, "OWNS", t_core, s_gw, {}))
        graph_storage["edges"].append(EmulatedEdge(107, "OWNS", t_core, s_auth, {}))
        graph_storage["edges"].append(EmulatedEdge(108, "OWNS", t_core, s_notif, {}))
        graph_storage["edges"].append(EmulatedEdge(109, "OWNS", t_fin, s_pay, {}))
        graph_storage["edges"].append(EmulatedEdge(110, "OWNS", t_fin, s_ledger, {}))
        graph_storage["edges"].append(EmulatedEdge(111, "OWNS", t_fin, s_fraud, {}))

        # People
        p_arjun = EmulatedNode(20, ["Person"], {"id": "arjun", "name": "Arjun Mehta", "role": "Staff Backend Engineer", "slack_handle": "@arjun", "timezone": "UTC-5"})
        p_elena = EmulatedNode(21, ["Person"], {"id": "elena", "name": "Elena Rostova", "role": "Principal Architect", "slack_handle": "@elena", "timezone": "UTC+1"})
        p_marcus = EmulatedNode(22, ["Person"], {"id": "marcus", "name": "Marcus Chen", "role": "DevOps Lead", "slack_handle": "@marcus", "timezone": "UTC-8"})
        p_priya = EmulatedNode(23, ["Person"], {"id": "priya", "name": "Priya Sharma", "role": "Senior Platform Engineer", "slack_handle": "@priya", "timezone": "UTC+5:30"})
        p_lucas = EmulatedNode(24, ["Person"], {"id": "lucas", "name": "Lucas Silva", "role": "Data Engineer", "slack_handle": "@lucas", "timezone": "UTC-3"})

        for p in [p_arjun, p_elena, p_marcus, p_priya, p_lucas]:
            graph_storage["nodes"][p.id] = p

        graph_storage["edges"].append(EmulatedEdge(112, "MEMBER_OF", p_elena, t_core, {}))
        graph_storage["edges"].append(EmulatedEdge(113, "MEMBER_OF", p_marcus, t_core, {}))
        graph_storage["edges"].append(EmulatedEdge(114, "MEMBER_OF", p_priya, t_core, {}))
        graph_storage["edges"].append(EmulatedEdge(115, "MEMBER_OF", p_arjun, t_fin, {}))
        graph_storage["edges"].append(EmulatedEdge(116, "MEMBER_OF", p_lucas, t_fin, {}))

        # ADRs
        adr1 = EmulatedNode(30, ["ADR"], {"id": "ADR-001", "title": "ADR-001: Microservice Authentication via JWKS", "name": "ADR-001", "status": "ACTIVE", "rule_summary": "All public endpoints must validate auth-service tokens via local JWKS cache with 5m TTL"})
        adr2 = EmulatedNode(31, ["ADR"], {"id": "ADR-002", "title": "ADR-002: Ledger Strict Latency & Protocol Standards", "name": "ADR-002", "status": "ACTIVE", "rule_summary": "All calls to ledger-db must use gRPC with mTLS and timeout <= 200ms"})
        adr3 = EmulatedNode(32, ["ADR"], {"id": "ADR-003", "title": "ADR-003: Asynchronous Notification Bus", "name": "ADR-003", "status": "ACTIVE", "rule_summary": "Outbound user notices must emit via Kafka topic with at-least-once delivery"})

        for a in [adr1, adr2, adr3]:
            graph_storage["nodes"][a.id] = a

        graph_storage["edges"].append(EmulatedEdge(117, "DECIDED", p_elena, adr1, {}))
        graph_storage["edges"].append(EmulatedEdge(118, "GOVERNS", adr1, s_gw, {}))
        graph_storage["edges"].append(EmulatedEdge(119, "DECIDED", p_elena, adr2, {}))
        graph_storage["edges"].append(EmulatedEdge(120, "GOVERNS", adr2, s_pay, {}))
        graph_storage["edges"].append(EmulatedEdge(121, "GOVERNS", adr2, s_ledger, {}))
        graph_storage["edges"].append(EmulatedEdge(122, "DECIDED", p_priya, adr3, {}))
        graph_storage["edges"].append(EmulatedEdge(123, "GOVERNS", adr3, s_notif, {}))

        # Commits
        c_break = EmulatedNode(40, ["Commit"], {
            "id": "8f92a1c",
            "sha": "8f92a1c",
            "name": "commit: 8f92a1c",
            "message": "fix(payment): increase ledger-db connection timeout to 5000ms to tolerate slow queries",
            "timestamp": "2026-10-14T07:45:00Z",
            "files_changed": '["payment/config/ledger_client.go", "config/env.production"]'
        })
        c_fraud = EmulatedNode(41, ["Commit"], {
            "id": "4a1b89e",
            "sha": "4a1b89e",
            "name": "commit: 4a1b89e",
            "message": "feat(fraud): update XGBoost inference score threshold to 0.75",
            "timestamp": "2026-10-13T16:20:00Z",
            "files_changed": '["fraud/model.py"]'
        })
        c_gw = EmulatedNode(42, ["Commit"], {
            "id": "3c89d2f",
            "sha": "3c89d2f",
            "name": "commit: 3c89d2f",
            "message": "perf(gateway): optimize route lookup radix tree",
            "timestamp": "2026-10-12T11:00:00Z",
            "files_changed": '["gateway/router.go"]'
        })

        for c in [c_break, c_fraud, c_gw]:
            graph_storage["nodes"][c.id] = c

        graph_storage["edges"].append(EmulatedEdge(124, "AUTHORED", p_arjun, c_break, {}))
        graph_storage["edges"].append(EmulatedEdge(125, "DEPLOYED_TO", c_break, s_pay, {}))
        graph_storage["edges"].append(EmulatedEdge(126, "AUTHORED", p_lucas, c_fraud, {}))
        graph_storage["edges"].append(EmulatedEdge(127, "DEPLOYED_TO", c_fraud, s_fraud, {}))
        graph_storage["edges"].append(EmulatedEdge(128, "AUTHORED", p_priya, c_gw, {}))
        graph_storage["edges"].append(EmulatedEdge(129, "DEPLOYED_TO", c_gw, s_gw, {}))

    logger.info("org_brain successfully seeded.")


def seed_procedural_memory(manager: FalkorManager):
    """Populates procedural_memory graph with historical incidents, patterns, and runbooks."""
    logger.info("Seeding procedural_memory multigraph...")

    if manager.check_connection():
        try:
            manager.query("procedural_memory", "MATCH (n) DETACH DELETE n")
        except Exception as e:
            logger.debug("Clear notice: %s", e)

        cypher_incidents = """
        CREATE (inc1:Incident {
            id: 'INC-2025-104',
            title: 'Cascading thread exhaustion on payment gateway',
            timestamp: '2025-11-20T14:15:00Z',
            root_cause_sha: '8f92a1c',
            resolved: true
        }),
        (inc2:Incident {
            id: 'INC-2025-089',
            title: 'Circuit breaker oscillation under ledger-db replica lag',
            timestamp: '2025-09-14T08:30:00Z',
            root_cause_sha: '1b892da',
            resolved: true
        })

        CREATE (pat1:Pattern {
            id: 'pat-cascade-timeout',
            symptom_signature: 'cascading-timeout-ledger',
            description: 'Latency spike on ledger-db leading to upstream thread exhaustion in payment-engine and gateway 504s'
        }),
        (pat2:Pattern {
            id: 'pat-replica-lag',
            symptom_signature: 'replica-lag-exhaustion',
            description: 'Replica lag on read pool leading to stale reads and retry storm'
        })

        CREATE (step1:RunbookStep {
            id: 'step-revert-timeout',
            action_type: 'ROLLBACK_AND_POOL_FLUSH',
            command_template: "revert_commit(sha='8f92a1c'); flush_connection_pool(service='payment-engine')",
            success_rate: 0.98
        }),
        (step2:RunbookStep {
            id: 'step-drain-replica',
            action_type: 'TRAFFIC_DRAIN',
            command_template: "drain_replica(target='ledger-db-replica-2'); adjust_read_quorum(min=2)",
            success_rate: 0.94
        })

        CREATE (inc1)-[:AFFECTED_SERVICE {service_id: 'payment-engine'}]->(pat1),
               (pat1)-[:RESOLVED_BY {confidence: 0.98, times_used: 4}]->(step1),
               (inc2)-[:AFFECTED_SERVICE {service_id: 'ledger-db'}]->(pat2),
               (pat2)-[:RESOLVED_BY {confidence: 0.94, times_used: 2}]->(step2),
               (inc2)-[:PRECEDED]->(inc1)
        """
        manager.query("procedural_memory", cypher_incidents)
    else:
        graph_storage = manager.select_graph("procedural_memory").storage
        graph_storage["nodes"].clear()
        graph_storage["edges"].clear()

        inc1 = EmulatedNode(50, ["Incident"], {"id": "INC-2025-104", "title": "INC-2025-104: Cascading thread exhaustion", "name": "INC-2025-104", "timestamp": "2025-11-20T14:15:00Z", "resolved": True})
        inc2 = EmulatedNode(51, ["Incident"], {"id": "INC-2025-089", "title": "INC-2025-089: Circuit breaker oscillation", "name": "INC-2025-089", "timestamp": "2025-09-14T08:30:00Z", "resolved": True})
        pat1 = EmulatedNode(52, ["Pattern"], {"id": "pat-cascade-timeout", "symptom_signature": "cascading-timeout-ledger", "name": "cascading-timeout-ledger", "description": "Latency spike on ledger-db leading to upstream thread exhaustion in payment-engine and gateway 504s"})
        pat2 = EmulatedNode(53, ["Pattern"], {"id": "pat-replica-lag", "symptom_signature": "replica-lag-exhaustion", "name": "replica-lag-exhaustion", "description": "Replica lag on read pool leading to stale reads and retry storm"})
        step1 = EmulatedNode(54, ["RunbookStep"], {"id": "step-revert-timeout", "name": "Rollback & Pool Flush", "command_template": "revert_commit(sha='8f92a1c'); flush_connection_pool(service='payment-engine')", "success_rate": 0.98})
        step2 = EmulatedNode(55, ["RunbookStep"], {"id": "step-drain-replica", "name": "Drain Replica", "command_template": "drain_replica(target='ledger-db-replica-2'); adjust_read_quorum(min=2)", "success_rate": 0.94})

        for item in [inc1, inc2, pat1, pat2, step1, step2]:
            graph_storage["nodes"][item.id] = item

        graph_storage["edges"].append(EmulatedEdge(201, "AFFECTED_SERVICE", inc1, pat1, {"service_id": "payment-engine"}))
        graph_storage["edges"].append(EmulatedEdge(202, "RESOLVED_BY", pat1, step1, {"confidence": 0.98, "times_used": 4}))
        graph_storage["edges"].append(EmulatedEdge(203, "AFFECTED_SERVICE", inc2, pat2, {"service_id": "ledger-db"}))
        graph_storage["edges"].append(EmulatedEdge(204, "RESOLVED_BY", pat2, step2, {"confidence": 0.94, "times_used": 2}))
        graph_storage["edges"].append(EmulatedEdge(205, "PRECEDED", inc2, inc1, {}))

    logger.info("procedural_memory successfully seeded.")


def seed_blackboard_demo(manager: FalkorManager, session_id: str = "demo"):
    """Populates the initial blackboard graph for a given session."""
    graph_name = f"blackboard_{session_id}"
    logger.info("Seeding %s multigraph...", graph_name)

    if manager.check_connection():
        try:
            manager.query(graph_name, "MATCH (n) DETACH DELETE n")
        except Exception as e:
            logger.debug("Clear notice: %s", e)

        cypher_blackboard = """
        CREATE (t1:Task {id: 'task-recon-01', description: 'Isolate blast radius of payment latency spike', status: 'COMPLETED'}),
               (t2:Task {id: 'task-hist-01', description: 'Trace commit lineage and ADR violations', status: 'IN_PROGRESS'}),
               (t3:Task {id: 'task-exec-01', description: 'Execute automated mitigation and update procedural memory', status: 'PENDING'})

        CREATE (f1:Finding {
            id: 'find-01',
            agent_name: 'Recon',
            summary: 'Cascading timeout from payment-engine impacting api-gateway (2 hops, TIER-1 blast radius)',
            cypher_used: 'MATCH path = (s:Service {name: "ledger-db"})<-[:DEPENDS_ON*1..4]-(downstream:Service) RETURN path',
            timestamp: '2026-10-14T10:00:00Z'
        })

        CREATE (a1:ProposedAction {
            id: 'act-01',
            action_type: 'ROLLBACK_COMMIT',
            target_service: 'payment-engine',
            risk_score: 0.05,
            approved: true
        })

        CREATE (t1)-[:ASSIGNED_TO]->(f1),
               (f1)-[:SUPPORTS]->(a1),
               (f1)-[:HANDOFF_TO {next_agent: 'Historian'}]->(t2)
        """
        manager.query(graph_name, cypher_blackboard)
    else:
        graph_storage = manager.select_graph(graph_name).storage
        graph_storage["nodes"].clear()
        graph_storage["edges"].clear()

        t1 = EmulatedNode(60, ["Task"], {"id": "task-recon-01", "name": "Task: Isolate blast radius", "status": "COMPLETED"})
        t2 = EmulatedNode(61, ["Task"], {"id": "task-hist-01", "name": "Task: Trace lineage & ADRs", "status": "IN_PROGRESS"})
        t3 = EmulatedNode(62, ["Task"], {"id": "task-exec-01", "name": "Task: Execute mitigation", "status": "PENDING"})

        f1 = EmulatedNode(63, ["Finding"], {
            "id": "find-01",
            "name": "Finding: Blast Radius",
            "agent_name": "Recon",
            "summary": "Cascading timeout from payment-engine impacting api-gateway (2 hops, TIER-1 blast radius)",
            "cypher_used": 'MATCH path = (s:Service {name: "ledger-db"})<-[:DEPENDS_ON*1..4]-(downstream:Service) RETURN path',
            "timestamp": "2026-10-14T10:00:00Z"
        })

        a1 = EmulatedNode(64, ["ProposedAction"], {
            "id": "act-01",
            "name": "Action: Rollback Commit",
            "action_type": "ROLLBACK_COMMIT",
            "target_service": "payment-engine",
            "risk_score": 0.05,
            "approved": True
        })

        for item in [t1, t2, t3, f1, a1]:
            graph_storage["nodes"][item.id] = item

        graph_storage["edges"].append(EmulatedEdge(301, "ASSIGNED_TO", t1, f1, {}))
        graph_storage["edges"].append(EmulatedEdge(302, "SUPPORTS", f1, a1, {}))
        graph_storage["edges"].append(EmulatedEdge(303, "HANDOFF_TO", f1, t2, {"next_agent": "Historian"}))

    logger.info("%s successfully seeded.", graph_name)


def seed_all_graphs(manager: FalkorManager, session_id: str = "demo"):
    """Seeds all three multigraph namespaces."""
    seed_org_brain(manager)
    seed_procedural_memory(manager)
    seed_blackboard_demo(manager, session_id=session_id)
