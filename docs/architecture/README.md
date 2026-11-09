# Architecture

This folder is the narrative map of the system. It explains how the platform fits together after decisions exist. It is not a place to introduce a decision for the first time.

## Source of truth

Accepted choices live in [Architecture Decision Records](../adr/README.md). When this narrative and an ADR disagree, the ADR wins until it is superseded by a newer ADR.

Interview notes in [docs/interviews](../interviews/README.md) capture the discussion that led to a decision. They are background, not specification.

## Current state

No architectural decision has been accepted.

In particular, none of the following has been chosen:

- Language, framework, or runtime
- Modular monolith, services, or any other process topology
- Database, cache, search, or event log
- Synchronization or messaging style
- Hosting region topology beyond the requirement that the first region is US East
- Authentication product or authorization model

Those items will appear here only after an ADR records them.

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
- Diagrams that name products not yet accepted in an ADR.
- Silent revisions of an accepted decision. Supersede the ADR instead.

## Status

| Topic | Status |
|---|---|
| Context diagram | Not started |
| Service or module boundaries | Not started |
| Data architecture | Not started |
| Delivery and operations | Not started |
| Accepted ADRs | None |
