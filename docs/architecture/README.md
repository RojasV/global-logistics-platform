# Architecture

This folder is the narrative map of the system. It explains how the platform fits together after decisions exist. It is not a place to introduce a decision for the first time.

## Source of truth

Accepted choices live in [Architecture Decision Records](../adr/README.md). When this narrative and an accepted ADR disagree, the accepted ADR wins until it is superseded by a newer ADR. A Proposed ADR does not override this narrative.

Interview notes in [docs/interviews](../interviews/README.md) capture the discussion that led to a decision. They are background, not specification.

## Current state

No architectural decision has been accepted.

Business behavior for shipment creation is recorded in [requirements](../requirements/shipment-creation.md). This folder does not repeat it and does not describe an implementation.

A candidate for shipment-status fan-out is written in [realtime shipment notifications](realtime-shipment-notifications.md). It is **Proposed / Under Evaluation** in [ADR-0002](../adr/0002-realtime-shipment-notifications.md). It is not the platform architecture. The example under `examples/realtime-notifications` studies that candidate and does not promote it.

In particular, none of the following has been chosen:

- Language, framework, or runtime. Next.js is proposed in [ADR-0001](../adr/0001-web-client-framework.md) and is not in force.
- Modular monolith, services, or any other process topology
- Database, cache, search, or event log
- Synchronization or messaging style. Kafka, Redis Pub/Sub, and SSE are proposed in ADR-0002 and are not in force.
- Hosting region topology beyond the requirement that the first region is US East
- Authentication product or authorization model

Accepted choices are summarized here only after an ADR accepts them. A proposal may be written earlier and stays labeled Proposed.

## What this folder will hold later

After decisions exist, add short documents that a reviewer can read without opening every ADR:

- **Context.** Actors and external systems, including carriers.
- **Boundaries.** Which part of the platform owns shipments, events, identity, and notifications.
- **Data flow.** How a tracking update becomes current state, history, and a notification.
- **Failure.** What users experience when a dependency is unavailable, tied to the 99.95% target.
- **Regions.** How US East relates to a future European footprint.

Each of those documents should link to the ADRs it summarizes.

## What does not belong here

- Application code and configuration.
- Vendor tutorials or boilerplate.
- Diagrams that present an unaccepted product as the chosen design. A proposal may name products when the document and its ADR both say Proposed.
- Silent revisions of an accepted decision. Supersede the ADR instead.

## Status

| Topic | Status |
|---|---|
| Context diagram | Not started |
| Service or module boundaries | Not started |
| Data architecture | Not started |
| Delivery and operations | Not started |
| Real-time shipment notifications | Proposed / Under Evaluation. Not accepted |
| Accepted ADRs | None |
| Proposed ADRs | [ADR-0001](../adr/0001-web-client-framework.md), web client. [ADR-0002](../adr/0002-realtime-shipment-notifications.md), notification fan-out |
