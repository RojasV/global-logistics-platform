import { dispatchShipmentStatus } from "./dispatcher.ts";
import { InMemoryRedisPubSub } from "./pubsub.ts";
import { applyStatusUpdate, toStatusView } from "./revision.ts";
import { SseReplica } from "./sse-replica.ts";
import type { ShipmentNotification } from "./contracts.ts";

const pubsub = new InMemoryRedisPubSub();
const replicas = ["A", "B", "C"].map((id) => {
  const replica = new SseReplica(pubsub, id);
  replica.start();
  return replica;
});

const delivered = new Map<string, ShipmentNotification[]>();

function attach(
  replica: SseReplica,
  connectionId: string,
  tenantId: string,
  shipments: string[],
): void {
  delivered.set(connectionId, []);
  replica.connect(
    {
      connectionId,
      tenantId,
      userId: connectionId,
      authorizedShipmentIds: shipments,
      connectedAt: new Date().toISOString(),
    },
    (notification) => {
      delivered.get(connectionId)?.push(notification);
    },
  );
}

attach(replicas[0], "alice", "tenant-acme", ["shp-1"]);
attach(replicas[1], "bob", "tenant-acme", ["shp-1"]);
attach(replicas[2], "cara", "tenant-other", ["shp-1"]);
attach(replicas[2], "dan", "tenant-acme", ["shp-9"]);

const first = dispatchShipmentStatus(pubsub, {
  eventId: "evt-1",
  shipmentId: "shp-1",
  tenantId: "tenant-acme",
  revision: 4,
  status: "in_transit",
  occurredAt: "2026-11-15T18:00:00.000Z",
});

console.log(`Published revision 4 to ${first.subscribers} Redis subscribers (the three replicas).`);
console.log(`alice on A received ${delivered.get("alice")?.length}, bob on B received ${delivered.get("bob")?.length}.`);
console.log(`cara (other tenant) received ${delivered.get("cara")?.length}, dan (other shipment) received ${delivered.get("dan")?.length}.`);

replicas[0].disconnect("alice");
dispatchShipmentStatus(pubsub, {
  eventId: "evt-2",
  shipmentId: "shp-1",
  tenantId: "tenant-acme",
  revision: 5,
  status: "out_for_delivery",
  occurredAt: "2026-11-15T18:04:00.000Z",
});
console.log(`After alice disconnects, her deliveries stay at ${delivered.get("alice")?.length}. bob received revision ${delivered.get("bob")?.at(-1)?.revision}.`);

const late = new SseReplica(pubsub, "late");
const missed: ShipmentNotification[] = [];
late.connect(
  {
    connectionId: "erin",
    tenantId: "tenant-acme",
    userId: "erin",
    authorizedShipmentIds: ["shp-1"],
    connectedAt: new Date().toISOString(),
  },
  (notification) => missed.push(notification),
);
late.start();
console.log(`Erin subscribed after the publishes and received ${missed.length} notification(s). Redis kept nothing for her.`);

let view = toStatusView(delivered.get("bob")!.at(-1)!);
const staleHttp = toStatusView(delivered.get("bob")![0]);
view = applyStatusUpdate(view, staleHttp);
console.log(`Bob's view stays at revision ${view.revision} (${view.status}) after the older HTTP body arrives.`);

const unauthorized = (delivered.get("cara")?.length ?? 0) + (delivered.get("dan")?.length ?? 0);
if (
  delivered.get("alice")?.length !== 1 ||
  delivered.get("bob")?.length !== 2 ||
  unauthorized !== 0 ||
  missed.length !== 0 ||
  view.revision !== 5
) {
  throw new Error("demo scenario did not match the expected deliveries");
}
