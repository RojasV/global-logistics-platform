import type { ShipmentNotification, SseConnection } from "./contracts.ts";
import { SHIPMENT_STATUS_CHANNEL, type MessageHandler, type RedisPubSub } from "./pubsub.ts";

export interface LiveConnection extends SseConnection {
  send(notification: ShipmentNotification): void;
}

export function mayReceive(connection: SseConnection, notification: ShipmentNotification): boolean {
  if (connection.tenantId !== notification.tenantId) return false;
  return connection.authorizedShipmentIds.includes(notification.shipmentId);
}

export class SseReplica {
  readonly id: string;
  private readonly registry = new Map<string, LiveConnection>();
  private readonly onMessage: MessageHandler;
  private readonly pubsub: RedisPubSub;
  private readonly channel: string;
  private subscribed = false;

  constructor(pubsub: RedisPubSub, id: string, channel: string = SHIPMENT_STATUS_CHANNEL) {
    this.pubsub = pubsub;
    this.id = id;
    this.channel = channel;
    this.onMessage = (_channel, message) => {
      this.deliver(message);
    };
  }

  start(): void {
    if (this.subscribed) return;
    this.pubsub.subscribe(this.channel, this.onMessage);
    this.subscribed = true;
  }

  stop(): void {
    if (!this.subscribed) return;
    this.pubsub.unsubscribe(this.channel, this.onMessage);
    this.subscribed = false;
  }

  connect(connection: SseConnection, send: (notification: ShipmentNotification) => void): void {
    this.registry.set(connection.connectionId, {
      connectionId: connection.connectionId,
      tenantId: connection.tenantId,
      userId: connection.userId,
      authorizedShipmentIds: [...connection.authorizedShipmentIds],
      connectedAt: connection.connectedAt,
      send,
    });
  }

  disconnect(connectionId: string): boolean {
    return this.registry.delete(connectionId);
  }

  connectionCount(): number {
    return this.registry.size;
  }

  private deliver(message: string): void {
    let notification: ShipmentNotification;
    try {
      notification = JSON.parse(message) as ShipmentNotification;
    } catch {
      return;
    }
    const connections = [...this.registry.values()];
    for (const connection of connections) {
      if (!mayReceive(connection, notification)) continue;
      connection.send(notification);
    }
  }
}
