import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { parseStatusChangedEvent, type ShipmentNotification, type ShipmentStatusChangedEvent } from "./contracts.ts";
import { SHIPMENT_STATUS_CHANNEL } from "./pubsub.ts";
import { SseReplica } from "./sse-replica.ts";

const replicaId = process.env.REPLICA_ID ?? "A";
const port = Number(process.env.PORT ?? "4317");
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const latestByShipment = new Map<string, ShipmentNotification>();
const fanout = new SseReplica(
  { subscribe() {}, unsubscribe() {}, publish() { return 0; } },
  replicaId,
);

const subscriber = createClient({ url: redisUrl }) as RedisClientType;
subscriber.on("error", (error) => {
  console.error(`[replica ${replicaId}] redis`, error.message);
});

await subscriber.connect();
await subscriber.subscribe(SHIPMENT_STATUS_CHANNEL, (message) => {
  remember(JSON.parse(message) as ShipmentNotification);
  fanout.acceptMessage(message);
});

const server = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    console.error(`[replica ${replicaId}]`, error);
    if (!res.headersSent) sendJson(res, 500, { error: "unexpected error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SSE replica ${replicaId} on http://127.0.0.1:${port} (Redis fan-out + local registry)`);
});

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "OPTIONS") {
    writeCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { replicaId, connections: fanout.connectionCount() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/events") {
    openSse(req, res, url);
    return;
  }

  if (req.method === "POST" && url.pathname === "/local-status") {
    const event = parseStatusChangedEvent(JSON.parse(await readBody(req)));
    if (!event) {
      sendJson(res, 400, { error: "invalid status event" });
      return;
    }
    const notification = toNotification(event);
    remember(notification);
    fanout.acceptMessage(JSON.stringify(notification));
    sendJson(res, 202, { scope: "local", replicaId, notification });
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

function openSse(req: IncomingMessage, res: ServerResponse, url: URL): void {
  const tenantId = url.searchParams.get("tenantId") ?? "";
  const userId = url.searchParams.get("userId") ?? "";
  const shipments = (url.searchParams.get("shipments") ?? "").split(",").filter((id) => id.length > 0);
  if (!tenantId || !userId || shipments.length === 0) {
    sendJson(res, 400, { error: "tenantId, userId, and shipments are required" });
    return;
  }

  const connectionId = randomUUID();
  writeCors(res);
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  res.write(`: connected ${connectionId} replica ${replicaId}\n\n`);

  fanout.connect(
    {
      connectionId,
      tenantId,
      userId,
      authorizedShipmentIds: shipments,
      connectedAt: new Date().toISOString(),
    },
    (notification) => {
      if (res.destroyed || res.writableEnded) {
        fanout.disconnect(connectionId);
        return;
      }
      res.write(`id: ${notification.revision}\nevent: shipment-status\ndata: ${JSON.stringify(notification)}\n\n`);
    },
  );

  const close = () => fanout.disconnect(connectionId);
  req.on("close", close);
  res.on("close", close);
}

function toNotification(event: ShipmentStatusChangedEvent): ShipmentNotification {
  return {
    eventId: event.eventId,
    shipmentId: event.shipmentId,
    tenantId: event.tenantId,
    revision: event.revision,
    status: event.status,
    occurredAt: event.occurredAt,
  };
}

function remember(notification: ShipmentNotification): void {
  const key = `${notification.tenantId}:${notification.shipmentId}`;
  const previous = latestByShipment.get(key);
  if (!previous || notification.revision >= previous.revision) latestByShipment.set(key, notification);
}

function writeCors(res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  writeCors(res);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
