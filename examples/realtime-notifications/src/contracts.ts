/**
 * Field meanings are defined in docs/architecture/realtime-shipment-notifications.md.
 * These shapes are the example's contracts, not an accepted platform schema.
 */

/** Fact the shipment backend would append to Kafka. The example builds this directly. */
export interface ShipmentStatusChangedEvent {
  eventId: string;
  shipmentId: string;
  tenantId: string;
  revision: number;
  status: string;
  occurredAt: string;
}

/** Copy of a status event published for browsers. Revision is not minted again here. */
export interface ShipmentNotification {
  eventId: string;
  shipmentId: string;
  tenantId: string;
  revision: number;
  status: string;
  occurredAt: string;
}

/**
 * One browser socket in one replica's memory.
 * Authorization is the allow-list captured at connect, not a live permission lookup.
 */
export interface SseConnection {
  connectionId: string;
  tenantId: string;
  userId: string;
  authorizedShipmentIds: readonly string[];
  connectedAt: string;
}

export function parseStatusChangedEvent(value: unknown): ShipmentStatusChangedEvent | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (!nonEmpty(body.eventId) || !nonEmpty(body.shipmentId) || !nonEmpty(body.tenantId)) {
    return null;
  }
  if (!nonEmpty(body.status) || !nonEmpty(body.occurredAt)) return null;
  if (typeof body.revision !== "number" || !Number.isInteger(body.revision) || body.revision < 0) {
    return null;
  }
  return {
    eventId: body.eventId,
    shipmentId: body.shipmentId,
    tenantId: body.tenantId,
    revision: body.revision,
    status: body.status,
    occurredAt: body.occurredAt,
  };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
