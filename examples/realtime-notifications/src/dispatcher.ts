import type { ShipmentNotification, ShipmentStatusChangedEvent } from "./contracts.ts";
import { SHIPMENT_STATUS_CHANNEL, type RedisPubSub } from "./pubsub.ts";

/**
 * In the candidate design this is the body of a Kafka consumer in the single
 * group `notification-dispatcher`. The example calls it directly. Kafka is
 * not running, and this function does not commit an offset.
 *
 * A Redis publish failure in production would leave the offset uncommitted.
 * This stand-in returns the subscriber count instead of a broker acknowledgement.
 */
export function dispatchShipmentStatus(
  pubsub: RedisPubSub,
  event: ShipmentStatusChangedEvent,
  channel: string = SHIPMENT_STATUS_CHANNEL,
): { notification: ShipmentNotification; subscribers: number } {
  const notification: ShipmentNotification = {
    eventId: event.eventId,
    shipmentId: event.shipmentId,
    tenantId: event.tenantId,
    revision: event.revision,
    status: event.status,
    occurredAt: event.occurredAt,
  };
  const subscribers = pubsub.publish(channel, JSON.stringify(notification));
  return { notification, subscribers };
}
