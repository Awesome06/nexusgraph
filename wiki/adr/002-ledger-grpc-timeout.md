---
title: "ADR 002: Ledger Strict Latency and Protocol Standards"
summary: Enforces strict gRPC with mTLS and maximum 200ms timeouts for all inter-service communication targeting ledger-db.
type: adr
status: active
tags: [adr, ledger, grpc, mtls, timeout, governance]
aliases: [002-ledger-grpc-timeout, adr-002, ledger-timeout-policy]
---

# ADR 002: Ledger Strict Latency and Protocol Standards

## Context & Problem Statement
The `ledger-db` service is a Tier-0 core accounting ledger (written in C++). Upstream services such as `payment-engine` invoke `ledger-db` synchronously during transaction execution. If upstream clients misconfigure timeouts or use unpooled blocking connections, slow queries or transient lock contention on the ledger can exhaust worker threads in upstream services and cascade into HTTP 504 gateway timeouts at `api-gateway`.

## Decision
We enforce the following architectural rules for all clients communicating with `ledger-db`:
1. **Transport Protocol**: All RPCs must use **gRPC over mTLS** with HTTP/2 multiplexing.
2. **Hard Timeout Ceiling**: Call timeouts must be configured to **<= 200ms** at the client transport layer.
3. **Connection Pool Management**: Client connection pools must implement fail-fast circuit breaking rather than queueing unboundedly.
4. **Enforcement & Audit**: Any commit modifying client configuration files (e.g. `ledger_client.go`, `config/env.production`) is audited against this policy. Commit `8f92a1c` raising the timeout to `5000ms` violates this decision.

## Consequences & Governance
- **Positive**: Prevents cascading thread exhaustion across Tier-1 microservices.
- **Negative**: Long-running accounting queries must be converted to asynchronous batch endpoints rather than synchronous RPCs.
- **Remediation**: Violating configurations must be immediately rolled back and client connection pools flushed.

## References
- Architectural Context: [[wiki/architecture]] (governed_by)
- Swarm Remediation Runbook: [[wiki/runbooks/cascading-timeout-remediation]] (mitigates)
- Synthetic Topology: [[wiki/specs/synthetic-topology]] (governs)
- Entry Index: [[wiki/index]] (relates_to)
