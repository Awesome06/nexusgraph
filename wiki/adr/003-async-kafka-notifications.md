---
title: "ADR 003: Asynchronous Notification Bus Architecture"
summary: Mandates asynchronous event-driven message delivery over Kafka for all downstream notifications and non-blocking worker queues.
type: adr
status: active
tags: [adr, kafka, event-driven, notifications]
aliases: [003-async-kafka-notifications, adr-003, kafka-notifications]
---

# ADR 003: Asynchronous Notification Bus Architecture

## Context & Problem Statement
Synchronous HTTP/gRPC notifications from critical transaction pathways (such as `payment-engine`) introduce failure coupling with third-party SMS, email, and push providers. Transient provider delays directly degrade critical payment processing SLAs.

## Decision
All downstream notifications and alert delivery must be decoupled via **Apache Kafka**:
1. **Producer Side**: `payment-engine` emits payment completion events to a partitioned Kafka topic (`events.payment.completed`) without waiting for notification delivery.
2. **Consumer Side**: The `notification-worker` service (Go, Tier-3) consumes messages asynchronously with at-least-once semantics and exponential backoff retry.
3. **Criticality Classification**: The dependency edge from `payment-engine` to `notification-worker` is classified as `LOW` criticality.

## Consequences
- **Positive**: Complete isolation of the primary payment loop from notification latency spikes.
- **Negative**: Requires handling idempotent notification delivery and eventual consistency on client interfaces.

## References
- System Topology: [[wiki/specs/synthetic-topology]] (governs)
- System Architecture: [[wiki/architecture]] (relates_to)
- Entry Index: [[wiki/index]] (relates_to)
