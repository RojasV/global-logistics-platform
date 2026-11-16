import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { ShipmentNotification, ShipmentStatusChangedEvent } from "../src/contracts.ts";
import { createNotificationApp } from "../src/app.ts";
import { dispatchShipmentStatus } from "../src/dispatcher.ts";
import { InMemoryRedisPubSub } from "../src/pubsub.ts";
import { applyStatusUpdate, toStatusView } from "../src/revision.ts";
import { SseReplica } from "../src/sse-replica.ts";

function event(overrides: Partial<ShipmentStatusChangedEvent> = {}): ShipmentStatusChangedEvent {
  return {
    eventId: "evt-1",
    shipmentId: "shp-1",
    tenantId: "tenant-acme",
    revision: 4,
    status: "in_transit",
    occurredAt: "2026-11-15T18:00:00.000Z",
    ...overrides,
  };
}

function attach(
  replica: SseReplica,
  connectionId: string,
  tenantId: string,
  shipments: string[],
): ShipmentNotification[] {
  const received: ShipmentNotification[] = [];
  replica.connect(
    {
      connectionId,
      tenantId,
      userId: connectionId,
      authorizedShipmentIds: shipments,
      connectedAt: "2026-11-15T18:00:00.000Z",
    },
    (notification) => received.push(notification),
  );
  return received;
}

test("routes a notification only to the matching tenant", () => {
  const pubsub = new InMemoryRedisPubSub();
  const replica = new SseReplica(pubsub, "A");
  replica.start();
  const acme = attach(replica, "alice", "tenant-acme", ["shp-1"]);
  const other = attach(replica, "cara", "tenant-other", ["shp-1"]);

  dispatchShipmentStatus(pubsub, event());

  assert.equal(acme.length, 1);
  assert.equal(acme[0].tenantId, "tenant-acme");
  assert.equal(other.length, 0);
});

test("drops a same-tenant shipment the connection is not allowed to see", () => {
  const pubsub = new InMemoryRedisPubSub();
  const replica = new SseReplica(pubsub, "A");
  replica.start();
  const allowed = attach(replica, "alice", "tenant-acme", ["shp-1"]);
  const denied = attach(replica, "bob", "tenant-acme", ["shp-9"]);

  dispatchShipmentStatus(pubsub, event());

  assert.deepEqual(allowed.map((item) => item.shipmentId), ["shp-1"]);
  assert.equal(denied.length, 0);
});

test("delivers one publish to authorized clients on every subscribed replica", () => {
  const pubsub = new InMemoryRedisPubSub();
  const replicas = ["A", "B", "C"].map((id) => {
    const replica = new SseReplica(pubsub, id);
    replica.start();
    return replica;
  });
  const received = replicas.map((replica, index) =>
    attach(replica, `watcher-${index}`, "tenant-acme", ["shp-1"]),
  );

  const result = dispatchShipmentStatus(pubsub, event({ eventId: "evt-shared" }));

  assert.equal(result.subscribers, 3);
  for (const inbox of received) {
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].eventId, "evt-shared");
    assert.equal(inbox[0].revision, 4);
  }
});

test("does not deliver a publish to a replica that subscribes afterwards", () => {
  const pubsub = new InMemoryRedisPubSub();
  dispatchShipmentStatus(pubsub, event({ eventId: "evt-before" }));

  const late = new SseReplica(pubsub, "late");
  const inbox = attach(late, "erin", "tenant-acme", ["shp-1"]);
  late.start();

  assert.equal(inbox.length, 0);
  assert.equal(pubsub.subscriberCount("shipment-status"), 1);
});

test("ignores a duplicate revision and an older one", () => {
  let view = toStatusView({
    eventId: "evt-5",
    shipmentId: "shp-1",
    tenantId: "tenant-acme",
    revision: 5,
    status: "out_for_delivery",
    occurredAt: "2026-11-15T18:05:00.000Z",
  });
  view = applyStatusUpdate(
    view,
    toStatusView({
      eventId: "evt-5",
      shipmentId: "shp-1",
      tenantId: "tenant-acme",
      revision: 5,
      status: "should-not-replace",
      occurredAt: "2026-11-15T18:05:00.000Z",
    }),
  );
  view = applyStatusUpdate(
    view,
    toStatusView({
      eventId: "evt-4",
      shipmentId: "shp-1",
      tenantId: "tenant-acme",
      revision: 4,
      status: "in_transit",
      occurredAt: "2026-11-15T18:00:00.000Z",
    }),
  );

  assert.equal(view.revision, 5);
  assert.equal(view.status, "out_for_delivery");
});

test("keeps a newer SSE revision when an older HTTP body arrives later", () => {
  const sse = toStatusView({
    eventId: "evt-7",
    shipmentId: "shp-1",
    tenantId: "tenant-acme",
    revision: 7,
    status: "delivered",
    occurredAt: "2026-11-15T18:10:00.000Z",
  });
  const lateHttp = toStatusView({
    eventId: "evt-4",
    shipmentId: "shp-1",
    tenantId: "tenant-acme",
    revision: 4,
    status: "in_transit",
    occurredAt: "2026-11-15T18:00:00.000Z",
  });

  const view = applyStatusUpdate(applyStatusUpdate(null, sse), lateHttp);

  assert.equal(view.revision, 7);
  assert.equal(view.status, "delivered");
});

test("stops delivery after the SSE client disconnects", () => {
  const pubsub = new InMemoryRedisPubSub();
  const replica = new SseReplica(pubsub, "A");
  replica.start();
  const inbox = attach(replica, "alice", "tenant-acme", ["shp-1"]);

  dispatchShipmentStatus(pubsub, event({ eventId: "evt-while-connected", revision: 1 }));
  assert.equal(replica.disconnect("alice"), true);
  dispatchShipmentStatus(pubsub, event({ eventId: "evt-after-close", revision: 2, status: "delivered" }));

  assert.equal(replica.connectionCount(), 0);
  assert.deepEqual(inbox.map((item) => item.eventId), ["evt-while-connected"]);
});

test("a browser SSE stream receives a publish, and a disconnect receives nothing further", async () => {
  const app = createNotificationApp();
  await listen(app.server);
  const port = (app.server.address() as AddressInfo).port;
  const onB: ShipmentNotification[] = [];
  app.replicas[1].connect(
    {
      connectionId: "bob",
      tenantId: "tenant-acme",
      userId: "bob",
      authorizedShipmentIds: ["shp-1"],
      connectedAt: "2026-11-15T18:00:00.000Z",
    },
    (notification) => onB.push(notification),
  );

  const stream = openSse(port, "/events?tenantId=tenant-acme&userId=alice&shipments=shp-1");
  await stream.ready;
  await postStatus(port, event({ eventId: "evt-live", revision: 3, status: "picked_up" }));
  const live = await stream.next();
  stream.close();
  await waitFor(() => app.edge.connectionCount() === 0);

  await postStatus(port, event({ eventId: "evt-missed", revision: 4, status: "in_transit" }));
  const afterClose = await stream.rest(30);

  assert.equal(live.eventId, "evt-live");
  assert.equal(afterClose.length, 0);
  assert.deepEqual(onB.map((item) => item.eventId), ["evt-live", "evt-missed"]);
  assert.equal(app.latest("tenant-acme", "shp-1")?.revision, 4);
  app.server.close();
});

test("an older snapshot body does not replace a newer SSE notification", async () => {
  const app = createNotificationApp();
  await listen(app.server);
  const port = (app.server.address() as AddressInfo).port;
  const stream = openSse(port, "/events?tenantId=tenant-acme&userId=alice&shipments=shp-1");
  await stream.ready;

  await postStatus(port, event({ eventId: "evt-4", revision: 4, status: "in_transit" }));
  const first = await stream.next();
  const delayed = readJsonAfterCapture(
    port,
    "/shipments/shp-1/snapshot?tenantId=tenant-acme&delayMs=80",
  );
  await delayed.captured;
  await postStatus(port, event({ eventId: "evt-7", revision: 7, status: "delivered" }));
  const newer = await stream.next();
  const staleBody = await delayed.body;

  let view = applyStatusUpdate(null, toStatusView(first));
  view = applyStatusUpdate(view, toStatusView(newer));
  view = applyStatusUpdate(view, toStatusView(staleBody));

  assert.equal(staleBody.revision, 4);
  assert.equal(newer.revision, 7);
  assert.equal(view.revision, 7);
  assert.equal(view.status, "delivered");
  stream.close();
  app.server.close();
});

function listen(server: ReturnType<typeof createNotificationApp>["server"]): Promise<void> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
}

function postStatus(port: number, body: ShipmentStatusChangedEvent): Promise<void> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/shipments/status",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          if ((res.statusCode ?? 500) >= 400) reject(new Error(`status ${res.statusCode}`));
          else resolve();
        });
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}

function readJsonAfterCapture(
  port: number,
  path: string,
): { captured: Promise<number>; body: Promise<ShipmentNotification> } {
  let markCaptured: (revision: number) => void = () => {};
  const captured = new Promise<number>((resolve) => {
    markCaptured = resolve;
  });
  const body = new Promise<ShipmentNotification>((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port, path, method: "GET" }, (res) => {
      markCaptured(Number(res.headers["x-captured-revision"]));
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        if ((res.statusCode ?? 500) >= 400) {
          reject(new Error(`status ${res.statusCode}`));
          return;
        }
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as ShipmentNotification);
      });
    });
    req.on("error", reject);
    req.end();
  });
  return { captured, body };
}

function openSse(port: number, path: string): {
  ready: Promise<void>;
  next: () => Promise<ShipmentNotification>;
  rest: (ms: number) => Promise<ShipmentNotification[]>;
  close: () => void;
} {
  const pending: ShipmentNotification[] = [];
  let waiters: Array<(notification: ShipmentNotification) => void> = [];
  let buffer = "";
  let opened = false;
  let markReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  const req = request({ hostname: "127.0.0.1", port, path, method: "GET" }, (res) => {
    res.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      if (!opened && buffer.includes(": connected")) {
        opened = true;
        markReady();
      }
      let split = buffer.indexOf("\n\n");
      while (split !== -1) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
        if (dataLine) {
          const notification = JSON.parse(dataLine.slice("data: ".length)) as ShipmentNotification;
          const waiter = waiters.shift();
          if (waiter) waiter(notification);
          else pending.push(notification);
        }
        split = buffer.indexOf("\n\n");
      }
    });
  });
  req.on("error", () => {});
  req.end();

  return {
    ready,
    next() {
      const queued = pending.shift();
      if (queued) return Promise.resolve(queued);
      return new Promise((resolve) => waiters.push(resolve));
    },
    rest(ms) {
      return new Promise((resolve) => {
        setTimeout(() => resolve(pending.splice(0)), ms);
      });
    },
    close() {
      req.destroy();
    },
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for condition");
}
