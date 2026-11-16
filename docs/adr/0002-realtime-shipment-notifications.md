# ADR-0002: Propose Kafka, Redis Pub/Sub, and SSE for shipment status

- Status: Proposed
- Date: 2026-11-15

## Context

Shipment status has an exercise target of 300 ms p95 and eventual consistency with up to 10 seconds of lag. The frontend session compared polling, SSE, WebSockets, and `router.refresh()`, and left the mechanism open. See the [interview note](../interviews/2026-11-15-system-design-frontend.md) and the [service level targets](../requirements/README.md).

A later pass sketched a concrete fan-out: the shipment backend appends a status event to Kafka, one dispatcher consumer group publishes it to Redis Pub/Sub, and every SSE replica delivers it to the browsers connected on that process. The component behavior, the contracts, and the failure cases are in [realtime shipment notifications](../architecture/realtime-shipment-notifications.md). This record does not repeat that catalog.

The sketch is not an approved production architecture. The example under `examples/realtime-notifications` studies it. The example does not run Kafka.

## Alternatives considered

### Poll inside the 10-second lag

The browser reads the shipment on an interval. There is no socket registry and no second delivery log to lose. The cost is read traffic that grows with watchers, and a freshness floor set by the interval. For a 10-second lag, polling is enough if the interval is inside that lag.

### WebSockets from the browser to an SSE-shaped server

The browser keeps a two-way socket. Status push does not need the browser to send on that socket. The servers that hold sockets still need a fan-out, so WebSockets replace the edge protocol and leave Kafka and Redis as an open question. Proxies and resume behavior are more work than `EventSource`.

### One Kafka consumer group per SSE replica

Each replica reads the full log, which does broadcast without Redis. The cost is that every socket server replays and retains Kafka, and a replica that was down still needs the shipment read for the gap after its last offset. It also mixes "share the work" with "copy to everyone" in the same product.

### Kafka, one dispatcher group, Redis Pub/Sub, SSE

Dispatchers share partitions and publish once. Redis copies each publish to the replicas that are subscribed at that moment. SSE is one-way and reconnects over HTTP. The cost is that Redis Pub/Sub is not durable. A missed publish is invisible until the browser reads the shipment and merges by revision. Tenant channels, authorization freshness, and the 10-second bound are not solved by the sketch.

## Decision

Propose the Kafka, Notification Dispatcher, Redis Pub/Sub, and SSE topology for shipment status notifications. The proposal is not accepted.

Polling, WebSockets, and a Kafka group per replica stay available. This record does not choose a web framework, a database, or an authentication product. Implementation of the platform must not depend on this ADR while its status is Proposed. The example may demonstrate the study.

## Rationale

The session had already named SSE as a candidate and had not picked one. Writing the fan-out down makes the hard part visible: a Kafka consumer group does not deliver a copy to every SSE process, and the Redis hop that does the copy does not keep the message. Those two facts are why the sketch can look complete and still miss the 10-second lag. A Proposed record keeps that sketch from being treated as the platform design.

## Consequences and trade-offs

- No production publisher, consumer, or browser may assume this topology until the ADR is accepted.
- The example's in-process pub/sub is allowed to copy Redis Pub/Sub's lack of storage. It is not a license to skip reconciliation in a later implementation.
- If the ADR is later accepted, clients still need a shipment read on connect and after every gap, and a revision check so a late HTTP body cannot overwrite a newer SSE event.
- If it is rejected, the example remains a record of the study. Deleting it is not required for the rejection to take effect.
- Accepting the topology would still leave tenant-channel layout, permission checks on an open socket, and Kafka transaction boundaries undecided. Those are separate choices.
