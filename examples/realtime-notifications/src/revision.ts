import type { ShipmentNotification } from "./contracts.ts";

/** What the browser is currently showing for one shipment. */
export interface ShipmentStatusView {
  shipmentId: string;
  tenantId: string;
  revision: number;
  status: string;
  occurredAt: string;
}

export function toStatusView(notification: ShipmentNotification): ShipmentStatusView {
  return {
    shipmentId: notification.shipmentId,
    tenantId: notification.tenantId,
    revision: notification.revision,
    status: notification.status,
    occurredAt: notification.occurredAt,
  };
}

/**
 * Keep the current view when the incoming revision is not newer for the same
 * shipment and tenant. Used for SSE events, duplicate events, and a late HTTP body.
 */
export function applyStatusUpdate(
  current: ShipmentStatusView | null,
  incoming: ShipmentStatusView,
): ShipmentStatusView {
  if (
    current &&
    current.shipmentId === incoming.shipmentId &&
    current.tenantId === incoming.tenantId &&
    incoming.revision <= current.revision
  ) {
    return current;
  }
  return incoming;
}
