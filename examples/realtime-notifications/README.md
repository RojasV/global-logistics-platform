# Real-time notification study

Educational proof of concept for a **Proposed / Under Evaluation** design. It is not an approved production architecture, and it is not the logistics platform.

The candidate is [Kafka, one dispatcher group, Redis Pub/Sub, and SSE](../../docs/architecture/realtime-shipment-notifications.md). [ADR-0002](../../docs/adr/0002-realtime-shipment-notifications.md) records that proposal. Nothing here accepts it.

## What this process does

```text
simulated shipment status event
        |
        v
Notification Dispatcher
        |
        v
in-process Redis Pub/Sub stand-in
        |
        +------------+------------+
        v            v            v
  SSE replica A  B            C
        |
        v
  browser on replica A
```

The shipment backend is a POST, or a direct function call in the demo. In the candidate, that call is the body of a Kafka consumer. The in-memory commands do not start a broker. The local section below starts one.

The pub/sub class copies Redis Pub/Sub's fan-out: every current subscriber receives the message, and the message is not stored. **Redis Pub/Sub does not guarantee durable notification delivery.** A subscriber that is down, not yet subscribed, or already disconnected misses the message. There is no backlog. The client has to reconcile. In this study, reconciliation is a snapshot read merged by `revision`. In the candidate, that read is the shipment record, which this process does not have.

Replica A, B, and C are three objects in one process. Each has its own connection map. A browser socket is registered only on the replica that accepted it. The other replicas still receive the publish and deliver it only to their own authorized connections.

## Setup

Requires Node.js 22 or newer. `npm test`, `npm run demo`, and `npm run serve` install nothing. The local broker section uses Docker and the Kafka and Redis clients.

```bash
cd examples/realtime-notifications
npm test
npm run demo
npm run serve
```

`npm run serve` listens on `http://127.0.0.1:4317` and keeps Kafka and Redis inside one process. Override the port with `PORT`.

## Local Kafka, Redis, and three replica processes

This is still a study. ADR-0002 stays Proposed.

```bash
docker compose up -d
npm install
npm run live
```

Open `http://127.0.0.1:4317`. Replica A is that port, B is `4318`, and C is `4319`.

- **Publish only on A, B, or C** writes into that process's own connection list. A browser connected to B receives the B button and does not receive the A or C buttons.
- **Publish through Kafka** appends the event to the local broker. The dispatcher, in consumer group `notification-dispatcher`, publishes it on Redis. Every replica is subscribed, so the browser receives it on A, B, or C, whichever socket it opened.

The dispatcher creates the topic `shipment-status` and then subscribes. That keeps this one-command study from failing when the broker has no application topics yet. The standard order is different: the topic is declared on the broker first, with its partitions and retention, and only then do producers and consumers connect. A consumer group is not part of that declaration. It appears when a consumer subscribes with a `groupId`. One topic can have several groups. One consumer can subscribe to several topics.

Redis still does not store the message. A replica that subscribes late misses it.

## Simulate a shipment update

In the browser:

1. Open `http://127.0.0.1:4317`.
2. Choose Connect SSE. The query string is a stand-in for a session. It is not authentication.
3. Choose Publish status. The page sends a `ShipmentStatusChangedEvent`. The dispatcher publishes a notification. Replica A writes an SSE frame if the connection's tenant and shipment allow-list match.
4. Choose Run stale HTTP demo. The server captures the current snapshot, holds the response, and a newer status is published while it waits. When the older body arrives, the page keeps the newer revision.

`npm run demo` runs the same rules without a browser: two authorized watchers on replicas A and B, a different tenant, a different shipment, a disconnect, and a subscriber that joins after the publish.

## Tests

```bash
npm test
```

The tests drive the dispatcher, the pub/sub stand-in, the replicas, and the HTTP server. They do not replace those objects with mocks. Coverage is tenant routing, shipment allow-lists, fan-out to three replicas, duplicate and older revisions, a late HTTP snapshot after a newer SSE event, disconnect, and a publish that nobody receives because they subscribed too late.

## Known limitations

- Redis Pub/Sub, including this stand-in, is not durable. Missed events are gone. Reconciliation is required. The in-memory snapshot used for that read disappears when the process exits.
- The example does not commit a Kafka offset, retry a failed publish, or preserve order across a crash.
- One shared channel delivers every tenant's events to every replica. The candidate's tenant channels are not what this process subscribes to. The tenant check in the replica is what the tests prove.
- The allow-list is whatever the caller sent at connect. A later permission change does not update an open socket.
- The status words used here (`in_transit`, `delivered`) are sample strings. The platform has not chosen a status vocabulary.
- Three replica objects in one process are not three servers behind a load balancer. A stuck HTTP write is not isolated from the others.
- Query-string `tenantId`, `userId`, and `shipments` would be unsafe on a real edge.

## Difference from the production candidate

| Candidate under evaluation | This example |
|---|---|
| Durable event log in Kafka, one dispatcher consumer group | In-memory path: the caller invokes the dispatcher. Live path: a local broker and one consumer group |
| Redis server, Pub/Sub, no retention | In-process publish to current subscribers, then the message is dropped |
| Channel per tenant | One channel, filter locally |
| Shipment database as the source reconciled on reconnect | Process-local map of the latest notification, plus a delayed snapshot |
| Authenticated session and a real allow-list | Query string |
| SSE replicas as separate processes | In-memory path: objects A, B, and C in one process. Live path: three processes |

Losing a message in Redis is still losing a message if the stand-in is replaced with a real Redis server. Durable delivery would require a different product than Redis Pub/Sub, or the shipment read this study already treats as mandatory.
