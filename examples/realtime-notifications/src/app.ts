import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseStatusChangedEvent, type ShipmentNotification } from "./contracts.ts";
import { dispatchShipmentStatus } from "./dispatcher.ts";
import { InMemoryRedisPubSub } from "./pubsub.ts";
import { SseReplica } from "./sse-replica.ts";

const indexPath = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "index.html");

export interface NotificationApp {
  pubsub: InMemoryRedisPubSub;
  replicas: SseReplica[];
  edge: SseReplica;
  server: ReturnType<typeof createServer>;
  latest(tenantId: string, shipmentId: string): ShipmentNotification | undefined;
}

export function createNotificationApp(): NotificationApp {
  const pubsub = new InMemoryRedisPubSub();
  const replicas = ["A", "B", "C"].map((id) => {
    const replica = new SseReplica(pubsub, id);
    replica.start();
    return replica;
  });
  const edge = replicas[0];
  const latestByShipment = new Map<string, ShipmentNotification>();

  function remember(notification: ShipmentNotification): void {
    const key = shipmentKey(notification.tenantId, notification.shipmentId);
    const previous = latestByShipment.get(key);
    if (!previous || notification.revision >= previous.revision) {
      latestByShipment.set(key, notification);
    }
  }

  const server = createServer(async (req, res) => {
    try {
      await route(req, res, { pubsub, edge, remember, latestByShipment });
    } catch {
      if (!res.headersSent) {
        sendJson(res, 500, { error: "unexpected error" });
      }
    }
  });

  return {
    pubsub,
    replicas,
    edge,
    server,
    latest(tenantId, shipmentId) {
      return latestByShipment.get(shipmentKey(tenantId, shipmentId));
    },
  };
}

function shipmentKey(tenantId: string, shipmentId: string): string {
  return `${tenantId}:${shipmentId}`;
}

async function route(
  req: IncomingMessage,
  res: ServerResponse,
  app: {
    pubsub: InMemoryRedisPubSub;
    edge: SseReplica;
    remember: (notification: ShipmentNotification) => void;
    latestByShipment: Map<string, ShipmentNotification>;
  },
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(indexPath));
    return;
  }

  if (req.method === "GET" && url.pathname === "/events") {
    openSse(req, res, url, app.edge);
    return;
  }

  if (req.method === "POST" && url.pathname === "/shipments/status") {
    const event = parseStatusChangedEvent(JSON.parse(await readBody(req)));
    if (!event) {
      sendJson(res, 400, { error: "invalid status event" });
      return;
    }
    const { notification, subscribers } = dispatchShipmentStatus(app.pubsub, event);
    app.remember(notification);
    sendJson(res, 202, { notification, subscribers });
    return;
  }

  const snapshot = url.pathname.match(/^\/shipments\/([^/]+)\/snapshot$/);
  if (req.method === "GET" && snapshot) {
    const shipmentId = decodeURIComponent(snapshot[1]);
    const tenantId = url.searchParams.get("tenantId") ?? "";
    const captured = app.latestByShipment.get(shipmentKey(tenantId, shipmentId));
    if (!captured) {
      sendJson(res, 404, { error: "no status has been published for this shipment" });
      return;
    }
    const delayMs = Math.min(Math.max(Number(url.searchParams.get("delayMs") ?? "0"), 0), 2_000);
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "x-captured-revision": String(captured.revision),
    });
    if (delayMs > 0) await wait(delayMs);
    res.end(JSON.stringify(captured));
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

function openSse(req: IncomingMessage, res: ServerResponse, url: URL, edge: SseReplica): void {
  const tenantId = url.searchParams.get("tenantId") ?? "";
  const userId = url.searchParams.get("userId") ?? "";
  const shipments = (url.searchParams.get("shipments") ?? "").split(",").filter((id) => id.length > 0);
  if (!tenantId || !userId || shipments.length === 0) {
    sendJson(res, 400, { error: "tenantId, userId, and shipments are required" });
    return;
  }

  const connectionId = randomUUID();
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  res.write(`: connected ${connectionId}\n\n`);

  edge.connect(
    {
      connectionId,
      tenantId,
      userId,
      authorizedShipmentIds: shipments,
      connectedAt: new Date().toISOString(),
    },
    (notification) => {
      if (res.destroyed || res.writableEnded) {
        edge.disconnect(connectionId);
        return;
      }
      res.write(
        `id: ${notification.revision}\nevent: shipment-status\ndata: ${JSON.stringify(notification)}\n\n`,
      );
    },
  );

  const close = () => {
    edge.disconnect(connectionId);
  };
  req.on("close", close);
  res.on("close", close);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
