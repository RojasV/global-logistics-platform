# 2026-11-16 — Local Kafka, Redis, and topic lifecycle

## Prompt

Walk the proposed shipment-status path on a local broker: produce a status event, see it on the topic, see one dispatcher publish it to Redis, and see three SSE replicas receive the same payload. Then state where a topic is created relative to producers and consumers.

## Constraints used

ADR-0002 remains Proposed. The exercise does not accept the candidate. The shipment-status target and the fan-out sketch in the architecture note bound the discussion. No production service is introduced.

## Discussion

The page can publish only inside one replica. That write never enters Kafka or Redis, so a browser pinned to another replica does not see it. A publish through Kafka is a POST to the stand-in backend. That process produces `shipment-status`. The payload has no replica id. The worker, group `notification-dispatcher`, reads the topic and publishes the same JSON on the Redis channel `shipment-status`. Redis delivers that publish to every current subscriber. Each replica keeps an in-memory map of the HTTP responses it left open. It writes an SSE frame only when the connection's tenant and shipment allow-list match. Several connections on one replica are filtered one by one.

`new Kafka` only constructs a client. The topic does not exist because the client was constructed. The standard order is: the cluster is up, the topic is declared on it, and then producers and consumers connect by name. A consumer may subscribe to more than one topic. A topic may have more than one consumer group. During the walkthrough the worker created the topic before subscribe so a single command could boot. That was not the ownership model.

## Outcome

- Decision: none. [ADR-0002](../adr/0002-realtime-shipment-notifications.md) stays Proposed.
- Follow-up task: applied in the example. A separate process declares `shipment-status` and exits. The dispatcher only subscribes.
- Explicitly left open: how the shipment record and the Kafka produce commit together, tenant-channel layout, and permission checks on an already open socket.
