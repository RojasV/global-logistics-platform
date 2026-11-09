# Requirements

This document states the problem the platform is being designed to solve. It does not select a technology, a service boundary, or a data model.

The numbers are hypothetical design targets for a system-design exercise. They are not production measurements.

## Problem statement

Enterprise shippers and the operators who serve them need one place to manage shipments, receive carrier progress, reconstruct what happened, and notify the people who are allowed to know. Today that picture is split across carrier portals and internal tools. The split hides missing events, duplicate events, and access that crosses an organization boundary.

## Capabilities in scope

These are problem areas, not an implementation backlog.

- **Shipments.** Create and manage the unit of work that moves from origin to destination.
- **Carriers.** Accept progress from more than one carrier without making the core record identical to any one carrier's payload.
- **Delivery tracking.** Expose the current state of a shipment to the people allowed to see it.
- **Tracking events.** Retain the sequence of observations that explain the current state.
- **Organizations, users, and permissions.** Separate tenants and constrain what each user can do.
- **History and reports.** Answer questions over past shipments, not only over today's work.
- **Notifications and operations.** Tell people and downstream processes when something relevant changes.

Anything outside this list is out of scope until a later interview adds it.

## Actors

| Actor | Interest |
|---|---|
| Enterprise tenant | Owns shipments and decides who inside the organization may see or act on them |
| Operator | Investigates delays, missing scans, and exceptions |
| End user | Works inside one tenant with a limited set of permissions |
| Carrier | Reports movement. The carrier is an external system, not a tenant |
| Platform operator | Runs the service against the availability target |

Roles, permission names, and authentication methods are not defined yet.

## Scale targets

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

Reading the targets:

- Average arrival, if traffic were perfectly flat, would be about 2.3 new shipments per second and about 58 tracking events per second. Real traffic will bunch. The peak multiplier is unknown.
- History dominates storage and query design: the retained shipment set is about 500 times a single day of new shipments.
- 99.95% availability is about 4.4 hours of unavailability per year. The error budget has not been allocated to deploys, dependencies, or region failure.
- The first region is US East. Europe is a stated direction, not a commitment to a topology.

## Quality attributes called out so far

- **Availability.** 99.95% for the service as a whole. Which user journeys sit inside that target is still open.
- **Isolation.** A tenant must not read or change another tenant's shipments, users, or history.
- **Traceability.** A current delivery state should be explainable from retained events.
- **Change safety.** Decisions that affect these attributes are recorded as ADRs before code depends on them.

Latency targets, consistency guarantees, retention periods, and recovery-point objectives have not been set.

## Open questions

These are input for later interviews. None of them is decided here.

- What is a shipment, and which fields are required at creation?
- How is carrier identity represented, and what happens when two carriers disagree?
- Are tracking events immutable observations, or can a later event correct an earlier one?
- What ordering guarantee does a shipment timeline need?
- How long are events and shipments retained?
- Which actions require a stronger consistency guarantee than the timeline view?
- How is a user bound to an organization, and can one user belong to more than one?
- Which journeys must meet 99.95%, and which may degrade first?
- What does Europe expansion require for residency, latency, and failover?
- What is an acceptable peak relative to the flat daily averages above?

## Out of scope for this document

- Frameworks, languages, databases, queues, and hosting.
- API shape, schema, and deployment topology.
- Estimates presented as capacity plans. The averages above are arithmetic checks on the brief, not a forecast.
