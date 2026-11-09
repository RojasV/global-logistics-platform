# Global Logistics Platform

Enterprise-grade logistics and shipment tracking platform built through incremental system design, architectural decisions, and practical engineering challenges.

This is a public engineering portfolio. The system is designed and implemented in the open, one reviewed decision at a time. No application stack has been selected.

## Overview

Logistics operators need a durable record of where a shipment is, who is allowed to see it, and what happened to it. This repository will grow into that platform: shipment management, carrier integration, delivery tracking, event history, organizations and permissions, historical queries and reports, and operational notifications.

The work is sequenced as simulated senior-engineer interviews. Each interview may produce an architectural decision, a small approved task, and a verifiable change. Until a decision is written down, the corresponding part of the system stays undesigned.

## Educational and professional objectives

- Practice system design against explicit scale and availability targets.
- Record architectural decisions, the alternatives that were rejected, and the trade-offs that remain.
- Implement real behavior only after a task is approved.
- Show reasoning across product boundaries, data, failure, and operations as those concerns are actually reached.
- Keep a Git history of small, cohesive commits that a reviewer can audit.

The history is meant to reflect the work. Placeholder code, empty commits, and unused scaffolding are out of scope.

## Business problem

A shipper, a carrier, and an enterprise customer rarely share one system of record. Status is copied between portals, spreadsheets, and carrier messages. When something is late, operators cannot tell whether the last event is missing, duplicated, or simply not yet visible to the right organization.

The platform exists to answer four operational questions:

1. Which shipments belong to this organization, and who may act on them?
2. What is the current delivery state, and which carrier reported it?
3. What sequence of events produced that state?
4. What should be notified, reported, or investigated when the state changes?

Those questions have to remain answerable as volume, history, and the number of tenants grow, and as the footprint expands beyond the first region.

## Requirements and expected scale

The figures below are hypothetical design targets for this exercise. They are not measurements from a running system.

| Indicator | Reference |
|---|---|
| Enterprise tenants | 5,000 |
| Active users | 100,000 |
| Daily shipments | 200,000 |
| Daily tracking events | 5,000,000 |
| Historical shipments | 100,000,000 |
| Availability target | 99.95% |
| Initial region | US East |
| Future expansion | Europe |

Derived pressure on the design, not additional requirements:

- Tracking events are the dominant write stream. Five million events per day is about 58 events per second on a flat average. Peaks are not specified yet.
- New shipments arrive at about 2.3 per second on a flat average. The historical corpus is about 500 times one day of new shipments.
- An availability target of 99.95% corresponds to roughly 4.4 hours of downtime per year. How that budget is spent is still an open design question.
- Tenant isolation is part of the problem from the start: 5,000 enterprises share the platform, and their shipments, users, and history must not leak across organizations.
- Europe is a future expansion, not a second live region. Residency, latency, and failover across regions are undecided.

Detailed scope and open questions live in [docs/requirements](docs/requirements/README.md).

## Incremental development methodology

Work moves in this cycle:

**Technical interview → Architectural decision → Microtask → Implementation → Validation → Commit.**

Rules for every change:

- Do not implement a feature without an approved task.
- Do not decide architecture before the interview that requires the decision.
- Do not add code whose only purpose is to manufacture contribution activity.
- Do not create empty or artificial commits.
- Keep commits small, cohesive, and verifiable.
- Use [Conventional Commits](https://www.conventionalcommits.org/).
- When code exists, prefer clear boundaries, security, testability, scalability, and observability where they apply.
- Document limitations and the decisions that created them.
- Never commit credentials or secrets.
- Follow the conventions already recorded in this repository. Do not replace a recorded decision silently.

## Documentation index

| Path | Purpose |
|---|---|
| [docs/requirements](docs/requirements/README.md) | Problem scope, actors, scale targets, and open questions |
| [docs/architecture](docs/architecture/README.md) | Living map of the system, updated only after decisions exist |
| [docs/adr](docs/adr/README.md) | Architecture Decision Records and the required ADR format |
| [docs/interviews](docs/interviews/README.md) | Interview log and the tasks that follow from each session |

Architecture Decision Records are the source of truth for technical choices. Narrative documents summarize those records. They do not override them.

## Current status

**Stage:** repository bootstrap.

| Item | State |
|---|---|
| Visibility | Public |
| Default branch | `main` |
| Application code | Not started |
| Data stores | Not selected |
| Runtime and infrastructure | Not selected |
| Architecture decisions | None recorded |

The next step is the first system-design interview. Implementation waits for a microtask that names the decision it depends on.

## Initial roadmap

This list is an ordered set of concerns. It is not a technology selection. Each item stays open until an ADR accepts a decision.

1. **Domain boundaries.** Shipments, carriers, tracking events, organizations, users, and permissions.
2. **System context.** Actors, external carrier systems, and the operational workflows between them.
3. **Identity, tenancy, and authorization.** How 5,000 enterprises share one platform.
4. **Shipment and event history.** How current state and about 100 million historical shipments are stored and queried.
5. **Tracking ingestion.** How about 5 million daily events are accepted, ordered, and retained.
6. **Reads, reports, and notifications.** What operators and customers can ask, and what the platform pushes outward.
7. **Availability and recovery.** What 99.95% requires of deploys, dependencies, and failure handling.
8. **Regional expansion.** What must be true before a US East deployment can grow toward Europe.
9. **Implementation.** Application code starts only when the decisions it depends on are written down.

## License

No license has been chosen. Until one is added, all rights remain with the repository owner.
