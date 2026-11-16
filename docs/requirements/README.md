# Requirements

This document states the problem the platform is being designed to solve. It does not select a technology, a service boundary, or a data model.

The numbers are hypothetical design targets for a system-design exercise. They are not production measurements.

## Problem statement

Enterprise shippers and the operators who serve them need one place to manage shipments, receive carrier progress, reconstruct what happened, and notify the people who are allowed to know. Today that picture is split across carrier portals and internal tools. The split hides missing events, duplicate events, and access that crosses an organization boundary.

## Functional requirements

The first system-design session made the original problem areas specific. These are exercise requirements, not an implementation backlog.

- **Shipments.** Create and manage the shipment that moves from origin to destination. The creation workflow is [business behavior only](shipment-creation.md).
- **Carriers.** Integrate with FedEx, UPS, and DHL. Accept progress from those carriers without making the core record identical to any one carrier's payload.
- **Tracking and event history.** Expose the current state of a shipment and retain the sequence of observations that explain it.
- **Operational exceptions.** Manage exceptions that need investigation, including delays and failed or ambiguous carrier communication.
- **Reports and notifications.** Answer questions over past shipments, and tell people and downstream processes when something relevant changes.
- **Tenant isolation and role permissions.** Separate tenants. Constrain what each user profile can do. The permission matrix is not defined yet.

Anything outside this list is out of scope until a later interview adds it.

## Actors

| Actor | Interest |
|---|---|
| Enterprise tenant | Owns shipments and decides who inside the organization may see or act on them |
| Operator | Investigates delays, missing scans, and exceptions |
| End user | Works inside one tenant with a limited set of permissions |
| Carrier | Reports movement. The carrier is an external system, not a tenant |
| Platform operator | Runs the service against the availability target |

The session named four user profiles. They specialize the human actors above. The carrier stays an external system, not a profile. Permission names and authentication methods are not defined yet.

| Profile | Place in the model |
|---|---|
| Enterprise Customer | A person acting for an enterprise tenant |
| Operations Agent | Specializes the operator actor |
| Customer Support | A distinct profile. Its boundary with Operations Agent is not defined |
| Platform Administrator | Specializes the platform operator actor |

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

## Service level targets

The first session set the following targets for the exercise. They are hypothetical. They are not measurements from a running system, and they do not choose a database, cache, or delivery mechanism.

p95 latency is how fast the operation returns. The consistency column is how far that answer may trail the latest accepted observation, or which guarantee the write must provide. A fast response can still be stale within the bound in its row.

| Operation | p95 latency | Consistency |
|---|---|---|
| Create shipment | 500 ms | Strong, internal creation |
| Update ownership/permissions | 300 ms | Strong |
| Shipment status | 300 ms | Eventual, up to 10 s |
| Shipment search | 1 s | Eventual, up to 30 s |
| Dashboard analytics | 2 s | Eventual, up to 60 s |
| Standard reports | Within 5 minutes | Asynchronous |

"Strong, internal creation" applies to the shipment record inside the platform. It does not require the carrier to confirm inside 500 ms. That split is part of the [shipment creation behavior](shipment-creation.md).

## Quality attributes called out so far

- **Availability.** 99.95% for the service as a whole. Which user journeys sit inside that target is still open.
- **Isolation.** A tenant must not read or change another tenant's shipments, users, or history.
- **Traceability.** A current delivery state should be explainable from retained events.
- **Responsiveness.** The six operations above have exercise targets for latency and consistency.
- **Change safety.** Decisions that affect these attributes are recorded as ADRs before code depends on them.

Retention periods and recovery-point objectives have not been set.

## Open questions

These are input for later interviews. None of them is decided here.

- What is a shipment, and which fields are required at creation?
- Which profiles are allowed to create a shipment or change ownership?
- How is carrier identity represented, and what happens when two carriers disagree?
- Are tracking events immutable observations, or can a later event correct an earlier one?
- What ordering guarantee does a shipment timeline need?
- How long are events and shipments retained?
- How do the staleness bounds behave while the carrier or the platform is failing?
- How is a user bound to an organization, and can one user belong to more than one?
- Which journeys must meet 99.95%, and which may degrade first?
- What does Europe expansion require for residency, latency, and failover?
- What is an acceptable peak relative to the flat daily averages above?

## Out of scope for this document

- Frameworks, languages, databases, queues, and hosting.
- API shape, schema, and deployment topology.
- Estimates presented as capacity plans. The averages above are arithmetic checks on the brief, not a forecast.
