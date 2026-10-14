---
title: "Specification: Synthetic Dataset Topology & Scenario Seed"
summary: Complete specification of microservices, teams, engineers, bus-factor vulnerabilities, and the breaking commit in the seed dataset.
type: spec
status: active
tags: [spec, seed, dataset, microservices, topology, scenario]
aliases: [synthetic-topology, dataset-spec, seed-spec]
---

# Specification: Synthetic Dataset Topology & Scenario Seed

NexusGraph initializes deterministically with a synthetic corporate topology designed to stress multi-hop dependency tracing, ADR policy enforcement, and organizational centrality calculations.

## Microservices Topology

| Service | Language | Tier | Initial Status | Upstream Inbound Dependencies | Outbound Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `api-gateway` | Go | TIER-1 | DEGRADED | Ingress | `auth-service` (gRPC), `payment-engine` (REST) |
| `auth-service` | Rust | TIER-1 | HEALTHY | `api-gateway` | None |
| `payment-engine` | Python | TIER-1 | DEGRADED | `api-gateway` | `fraud-scorer` (gRPC), `ledger-db` (gRPC), `notification-worker` (Kafka) |
| `fraud-scorer` | Python | TIER-2 | HEALTHY | `payment-engine` | None |
| `ledger-db` | C++ | TIER-0 | HEALTHY | `payment-engine` | None |
| `notification-worker`| Go | TIER-3 | HEALTHY | `payment-engine` | None |

## Organizational Ownership & Bus Factor
- **Core-Platform Team** (`#core-oncall`):
  - Services Owned: `api-gateway`, `auth-service`, `notification-worker`
  - Members: Elena Rostova (Principal Architect), Marcus Chen (DevOps Lead), Priya Sharma (Senior Platform Engineer)
- **FinTech-Squad** (`#fintech-oncall`):
  - Services Owned: `payment-engine`, `ledger-db`, `fraud-scorer`
  - Members: Arjun Mehta (Staff Backend Engineer), Lucas Silva (Data Engineer)
- **Bus Factor Vulnerability**:
  - `fraud-scorer` has only 1 contributor (`Lucas Silva`), triggering high-priority alerts in centrality audits.

## Breaking Commit & Root Cause
- **Commit SHA**: `8f92a1c`
- **Author**: Arjun Mehta (`@arjun`)
- **Message**: `fix(payment): increase ledger-db connection timeout to 5000ms to tolerate slow queries`
- **Violation**: Violates [[wiki/adr/002-ledger-grpc-timeout]] which caps `ledger-db` client timeout at `<= 200ms`.
- **Failure Mode**: Cascading thread exhaustion in `payment-engine` causing HTTP 504 gateway timeout surges at `api-gateway`.

## References
- System Architecture: [[wiki/architecture]] (relates_to)
- Ledger Timeout ADR: [[wiki/adr/002-ledger-grpc-timeout]] (governs)
- Multigraph Namespaces: [[wiki/specs/multigraph-namespaces]] (relates_to)
- Incident Runbook: [[wiki/runbooks/cascading-timeout-remediation]] (mitigates)
- Entry Index: [[wiki/index]] (relates_to)
