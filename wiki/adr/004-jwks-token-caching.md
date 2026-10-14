---
title: "ADR 004: Microservice Authentication via Local JWKS Token Caching"
summary: Enforces local JWKS public key caching with 5-minute TTL on api-gateway and microservices to prevent auth-service bottlenecking.
type: adr
status: active
tags: [adr, auth, jwks, security, gateway]
aliases: [004-jwks-token-caching, adr-001-jwks, auth-token-caching]
---

# ADR 004: Microservice Authentication via Local JWKS Token Caching

## Context & Problem Statement
With `api-gateway` handling thousands of requests per second across all client ingress traffic, performing an out-of-band synchronous RPC to `auth-service` for every single JWT token signature validation turns `auth-service` into a critical throughput bottleneck and single point of failure.

## Decision
1. **JWKS Protocol**: `auth-service` exposes an RFC 7517 compliant JSON Web Key Set (JWKS) endpoint (`/.well-known/jwks.json`).
2. **Local In-Memory Cache**: `api-gateway` and downstream microservices cache JWKS signing keys locally in memory with a maximum TTL of **5 minutes**.
3. **Cryptographic Validation**: JWTs are verified locally via public RSA/ECDSA keys without contacting `auth-service` on each request, unless a key ID rotation is encountered.

## Consequences
- **Positive**: Sub-millisecond auth verification at the gateway perimeter; zero synchronous load on `auth-service` for standard API calls.
- **Negative**: Key revocation has an up to 5-minute propagation delay across active nodes.

## References
- System Topology: [[wiki/specs/synthetic-topology]] (governs)
- System Architecture: [[wiki/architecture]] (relates_to)
- Entry Index: [[wiki/index]] (relates_to)
