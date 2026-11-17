# Real-time shipment notifications

**Status: Proposed / Under Evaluation.**

Kafka, the Notification Dispatcher, Redis Pub/Sub, and SSE are a candidate for pushing shipment status to browsers. This document does not accept that candidate. No production service may depend on it while [ADR-0002](../adr/0002-realtime-shipment-notifications.md) stays Proposed.

The isolated study lives in [examples/realtime-notifications](../../examples/realtime-notifications). That example is not the logistics platform. `npm test` and `npm run serve` use an in-process stand-in for Redis Pub/Sub and do not start a broker. `npm run live` starts a local Kafka and Redis so the same candidate can be watched process by process. Neither path accepts the candidate.

This write-up follows the frontend session on [2026-11-15](../interviews/2026-11-15-system-design-frontend.md). That session left the live-update mechanism open. Shipment status is an exercise target of 300 ms p95 and eventual consistency with a lag of up to 10 seconds. See the [service level targets](../requirements/README.md). This path is one way to chase that lag. It does not guarantee it.

```text
Shipment Backend
       |
       v
     Kafka
       |
       v
Notification Dispatcher
       |
       v
   Redis Pub/Sub
       |
       +------------+------------+
       |            |            |
       v            v            v
 SSE Replica A  SSE Replica B  SSE Replica C
       |            |            |
       v            v            v
   Browsers      Browsers      Browsers
```

## Event contracts

These are the field meanings for the candidate. The TypeScript shapes used by the example are in `examples/realtime-notifications/src/contracts.ts`. The status vocabulary is not decided.

| Field | Where it appears | Purpose |
|---|---|---|
| `eventId` | Status event and notification | Identifies one status change. A Kafka retry and a second Redis publish of the same change reuse it. |
| `shipmentId` | Status event and notification | The shipment whose status changed. A connection does not carry one shipment id. It carries the set it is allowed to see. |
| `tenantId` | Status event, notification, and SSE connection | Isolation key. A connection may receive a notification only when the tenant ids are equal. |
| `revision` | Status event and notification | Integer that increases once per accepted status change of that shipment. The browser keeps the incoming status only when the revision is greater than the one it already shows. An equal revision is a duplicate. A lower revision is stale. |
| `status` | Status event and notification | The status value that belongs to that revision. |
| `occurredAt` | Status event and notification | When the shipment record took that status, as ISO-8601 UTC. It is not the Redis publish time and not the time the browser applied the event. |
| `connectionId` | SSE connection | Identifies one browser socket inside one replica. It is not a shipment event. |
| `userId` | SSE connection | The person the allow-list was built for. How that person was authenticated is not decided. |
| `authorizedShipmentIds` | SSE connection | Shipments that connection may receive. Captured when the socket opens. A later permission change does not update it until the connection is replaced. |
| `connectedAt` | SSE connection | When this replica accepted the socket. It marks the start of the gap a reconnect must reconcile. It is not an event timestamp. |

`ShipmentStatusChangedEvent` is the fact the shipment backend would append to Kafka. `ShipmentNotification` is what the dispatcher publishes for connected browsers. In this candidate the notification copies the event fields. It does not create a second revision. `SseConnection` is registry state on one replica. It has no event id, revision, or status.

## Components

### Shipment Backend

| | |
|---|---|
| Responsibility | Keep the shipment record. Assign the next revision when status changes. Emit one `ShipmentStatusChangedEvent` for that change. |
| Input | A status change that the shipment record has already accepted. Carrier confirmation and internal edits both end here only after the record changes. Creation itself is described in [shipment creation](../requirements/shipment-creation.md) and is not this flow. |
| Output | A `ShipmentStatusChangedEvent` handed to the Kafka producer. |
| Failure | If the event never becomes durable on Kafka, the notification path does not see it. The record can still be read through the request path. Clients that missed the push stay on their previous revision until that read, or until a later event. How the backend commits its own store and the Kafka produce in one step is not decided. |

### Kafka

| | |
|---|---|
| Responsibility | Durable, ordered log of status events between the backend and the dispatcher. Kafka is the buffer that survives a dispatcher restart. |
| Input | Produced `ShipmentStatusChangedEvent` records. |
| Output | Records read by the Notification Dispatcher consumer group. |
| Failure | A broker outage blocks new produces and consumes. Events that were acknowledged remain on the log and are read again after recovery. A consumer that crashes before committing an offset reads that record again. The result is at-least-once delivery into the dispatcher, so `eventId` and `revision` must make a repeat harmless. |

`npm test` and `npm run serve` call the dispatcher with an event object. They do not poll a broker. In the candidate, and in `npm run live`, that call is the body of the Kafka consumer after a record is polled.

#### Topic lifecycle

The broker process starts without application topics. `shipment-status` is declared on the cluster before any producer or consumer connects. The declaration chooses partitions, replication, and retention. The platform usually owns that declaration. The service that emits the event may also ensure its own output topic when it starts. The consumer does not own the topic. It subscribes to a name that already exists, and it waits or fails when the name is missing.

A consumer group is not declared beside the topic. The group appears when a process connects with a `groupId` and subscribes. One topic can have several groups. Each group stores its own offsets and receives its own copy of each record. Members of a single group share the partitions.

This local study runs a short-lived process that declares `shipment-status` and exits. The dispatcher starts after that and only subscribes. The stand-in backend only connects a producer and sends to the topic name. The declaration still lives in the study, not in a platform pipeline. The partition count and retention are fixed so the local broker can run. They are not an accepted production setting.

#### Consumer groups

A consumer group is a set of consumers that share one subscription. The group coordinator assigns each partition to one member. The group stores one offset per partition. Members are competing consumers: they split the work so the group can keep up and so a dead member's partitions move to a live one.

Illustration, not a chosen partition count. A topic with three partitions and a group `notification-dispatcher` of three members assigns one partition to each member. A record on partition 1 is delivered to the member that owns partition 1. The other two members do not see it.

#### Why one group does not broadcast

Broadcasting would give every member a copy of every record. The group protocol does the opposite. It promises that one partition has one owner inside the group, so the offset has one reader and three dispatcher instances do not publish the same event three times.

Adding an SSE replica as another member of `notification-dispatcher` would steal a partition from a dispatcher. It would not give that replica a copy of the other partitions. The replica would also be a poor owner of a partition: it only holds the browsers that a load balancer happened to place on it, while the partition holds events for every tenant.

A broadcast made only of Kafka would be a different design: one consumer group per SSE replica, each group the sole reader of every partition. Every replica would then read the full log. That couples socket servers to Kafka retention, makes replica startup a replay, and still leaves a gap between the last offset the replica read and the browsers that connect to it later. It is an alternative, not this candidate. This candidate keeps a single dispatcher group and uses Redis for the fan-out.

### Notification Dispatcher

| | |
|---|---|
| Responsibility | The only member role in the `notification-dispatcher` group. Turn a status event into a `ShipmentNotification` and publish it to Redis. Do not hold browser sockets. Do not decide which user is connected. |
| Input | One `ShipmentStatusChangedEvent` at a time, from the Kafka poll loop. The example passes that object in directly. |
| Output | One Redis publish of the notification. A successful publish is the point at which the candidate would commit the Kafka offset. |
| Failure | If Redis rejects the publish, the offset stays uncommitted and the record is retried. A crash after Redis accepts the publish and before the offset commit produces a duplicate notification. Subscribers that were down during the publish do not get a second chance from Redis. They depend on reconciliation. The dispatcher does not filter by user. Authorization is applied where the socket is known. |

Several dispatcher processes may run, as members of one group, to share partitions. They must not be given separate groups or each event is published once per group.

### Redis Pub/Sub

| | |
|---|---|
| Responsibility | Fan-out from the dispatcher to every SSE replica that is currently subscribed. |
| Input | A published notification on a shipment-status channel. |
| Output | A copy of that message to each current subscriber. Redis Pub/Sub has no consumer group. It does not split messages among subscribers. |
| Failure | Redis Pub/Sub does not store the message. A replica that is restarting, not yet subscribed, or disconnected for the publish misses it. There is no backlog to catch up. A Redis outage fails the publish; the dispatcher keeps the Kafka offset uncommitted and retries. Messages already handed to Redis and not yet written to a socket are gone. Failover of Redis does not reconstruct them. |

That is the central delivery limit of this candidate. Push is best-effort after the dispatcher. Durable history stays in the shipment record and in Kafka, not in Redis. A client must reconcile after connect, reconnect, and any gap. The example's pub/sub stand-in has this same limit on purpose: publish reaches only the subscribers registered at that moment, and a later subscriber sees nothing of the earlier publish.

The candidate uses a channel per tenant, `tenant.{tenantId}.shipment-status`, so a replica can subscribe only for tenants that have a local socket. The example uses one shared channel and filters in the replica. The shared channel makes the tests show fan-out and the tenant check separately. It is a study simplification, not a quieter decision. A shared channel delivers every tenant's events to every replica.

### SSE replica

| | |
|---|---|
| Responsibility | Hold the browser connections that the load balancer placed here. Subscribe to Redis. Keep a local registry. Write an SSE frame only to a connection that passes tenant and shipment checks. |
| Input | Redis messages on the shipment-status channel, and HTTP requests that open or close an SSE stream. |
| Output | SSE frames (`id`, `event: shipment-status`, `data`) to the matching sockets. `id` is the revision, so a reconnecting browser can send `Last-Event-ID`. |
| Failure | The registry is memory on this process. It is not shared with replica B or C. If the process dies, its sockets die and those browsers reconnect elsewhere. Events published during the gap are not in Redis. The new replica cannot replay them from its registry. The browser must read the shipment and merge by revision before it trusts the live stream again. A slow or blocked socket must not stop delivery to the other connections on this replica. The example writes frames one by one and does not solve a stuck client. |

Three replicas are drawn because one browser is pinned to one process. The other processes still need the Redis message: each might own the socket for a different user who is allowed to see the same shipment. Fan-out to every replica, then a local filter, is what makes that possible. It is also why a replica with no matching socket still receives the Redis message and drops it.

#### Local connection registry

Each replica owns a map from `connectionId` to `SseConnection` plus the write function for that socket. Connecting adds an entry. Disconnecting, including a browser abort, removes it. A removed entry receives nothing further. Another replica's map is untouched.

The allow-list is copied at connect. The replica does not re-read permissions on each event in this candidate study. A permission change that the shipment API would treat as strongly consistent can be invisible to an already open socket. Closing the socket, or a later design that checks authorization on each event, is still open.

### Browser

| | |
|---|---|
| Responsibility | Show the newest shipment status it is allowed to see. Treat SSE as a hint and the shipment read as the reconciliation source. |
| Input | SSE notifications, and HTTP responses from the shipment read. |
| Output | The status view for one shipment: revision, status, and `occurredAt`. |
| Failure | A missed SSE event leaves the view stale until the next successful read or a newer event. A reconnect without a read repeats that risk. An HTTP response that was in flight before a newer SSE event must not replace the newer revision when it finally arrives. |

## Tenant isolation and shipment authorization

Both checks run on the replica, for every notification, against the local registry:

1. `connection.tenantId` must equal `notification.tenantId`. The same shipment id in another tenant is a different shipment.
2. `notification.shipmentId` must be in `connection.authorizedShipmentIds`.

Failing either check drops the notification for that connection only. The dispatcher still publishes it. Other connections on the same replica, and the other replicas, apply their own checks.

The example takes tenant, user, and the allow-list from the SSE query string. That is a stand-in for a session. It is not authentication. Production would resolve the person and the allow-list from the session before inserting the registry entry, and would not trust those values from the query string.

Platform Administrator and the other profiles are not given an implicit "see everything" rule here. The permission matrix is still undefined. Whoever is connected receives only the allow-list attached to that socket.

## Eventual consistency and delivery limits

Shipment status is allowed to lag by up to 10 seconds. This candidate tries to deliver a change sooner than a poll, then fails open into that lag when the push path drops a message.

What the candidate does guarantee, if the rest of the design holds:

- A revision is monotonic per shipment in the shipment record.
- A newer revision replaces an older one in the browser.
- A duplicate `eventId` with the same revision does not move the view backwards.

What it does not guarantee:

- Delivery of any particular notification to a particular browser. Redis Pub/Sub is not durable.
- The 10-second bound. A missed publish, a dead replica, or a client that has not reconciled can sit past 10 seconds until something else refreshes the view.
- Ordering across Redis failures. Kafka orders the log. The socket sees only the subset that fan-out happened to deliver.
- That the allow-list is still true at the moment of delivery.

Search, dashboard analytics, and standard reports keep the looser targets already recorded. This path is only about shipment status.

## Reconnection and missed events

`EventSource` reconnects on its own and will send `Last-Event-ID` when the server set `id`. The candidate sets `id` to the revision. That header tells the new replica what the browser last applied. It does not create a backlog.

Redis cannot answer "revisions after N". The shipment read can. On connect and on reconnect the browser should:

1. Read the current shipment.
2. Merge that body with the view it already has, by revision.
3. Then apply live SSE events with the same merge.

Events published while the socket was down are covered only if step 1 sees them in the shipment record. If the backend emitted the event to Kafka and the record is updated, the read sees it even though Redis already forgot the message.

The example stores the latest notification in process memory so the study can show this merge. That map is not a database and dies with the process. The page has a reconcile action that reads it. The delayed snapshot endpoint holds an older body on purpose so a late HTTP response can be observed.

## Stale responses in the browser

SSE and the shipment read are two networks. They do not arrive in revision order.

1. The browser requests the shipment. The server takes the body at revision 4 and is slow to write it.
2. An SSE event arrives with revision 7. The view moves to 7.
3. The HTTP body from step 1 arrives, still at revision 4.

If the browser applies responses in arrival order without looking at `revision`, the view goes back to 4. The rule is the same for a repeated SSE event, an older SSE event, and that late HTTP body: if the shipment and tenant match and `incoming.revision <= current.revision`, keep the current view.

A different shipment must not be merged into this view. Revisions are not a global clock.

## Comparison

| | Polling | WebSockets | SSE plus this fan-out |
|---|---|---|---|
| Direction | Client pulls | Either side sends | Server pushes over HTTP. The browser does not send shipment commands on this stream. |
| Freshness | Bounded by the interval. An interval under 10 seconds can meet the status lag without a push path. | Similar to SSE if the server pushes on each change. | Best-effort push, with the same 10-second read as the safety net. |
| Fan-out | No shared socket. Each poll hits the read API. Cost grows with clients times poll rate. | The socket still lives on one process. Something still has to copy each event to every process that holds a watcher. | Kafka shares work across dispatchers. Redis copies each publish to every subscribed replica. |
| Durability of the push | The read sees the record. There is no separate push to lose. | A message dropped by the fan-out is gone unless the client reads again. | Same limit. Redis Pub/Sub adds no durability. |
| Reconnect | The next poll is the reconnect. | Custom. Proxies and idle timeouts need a heartbeat and a resume protocol. | `EventSource` reconnects. Resume still needs the shipment read, because Redis has no backlog. |
| Fit for status | Enough for the written lag target. Simple failure mode. Heavy if every open shipment is polled by every watcher. | The browser does not need to send on the status stream. The extra direction is unused for this one flow, and the fan-out problem remains. | Matches one-way status. Adds a component that can lose messages, which polling does not have. |

`router.refresh()` refreshes a server-rendered route for one browser session. It does not take a Kafka record to every replica. It stays a separate, still-open option from the frontend session. It is not part of this candidate.

Polling remains a credible way to meet a 10-second lag, especially until the missed-event and authorization gaps above are accepted on purpose. That is why this candidate stays under evaluation.

## What the example changes on purpose

| Candidate | Example |
|---|---|
| Kafka topic, consumer group, offsets | The test or the HTTP handler calls the dispatcher with an event |
| Redis server | In-process pub/sub with the same fan-out and the same lack of storage |
| Channel per tenant | One shared channel, tenant check in the replica |
| Session and permission lookup | Query-string tenant, user, and allow-list |
| Shipment database as the reconciliation source | In-memory map of the latest notification, plus a delayed snapshot that returns an older body |
| Load balancer across replicas | One process, three replica objects, browser socket attached to replica A |

The tests exercise routing, authorization, fan-out, revisions, a late HTTP body, and disconnect against those objects. They are not a production certification.

`docker compose up` in the example directory starts a local Redis and a local Kafka. `npm run live` then starts one dispatcher and three replica processes. That exercises the same candidate with real brokers. It does not accept the candidate. A button that publishes only on one replica writes to that process's registry and does not enter Kafka or Redis. The Kafka button does. A browser pinned to replica B therefore sees a local publish on B, does not see a local publish on A or C, and does see a Kafka publish because Redis copies that publish to all three processes.
