import { DispatchEventType, DomainEvent, Shipment, ShipmentStatus } from '../types/shipment.types';

export function buildDomainEvent(
  eventType: DispatchEventType,
  shipment: Shipment,
  correlationId: string,
  extras?: {
    reason?: string;
    originalOrderId?: string;
    originalShipmentId?: string;
  }
): DomainEvent {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    version: '1.0',
    occurredAt: new Date().toISOString(),
    producer: 'dispatch-service',
    correlationId,
    payload: {
      userId: shipment.userId,
      orderId: shipment.orderId,
      shipmentId: shipment.shipmentId,
      status: shipment.status,
      ...(extras?.reason ? { reason: extras.reason } : {}),
      ...(extras?.originalOrderId ? { originalOrderId: extras.originalOrderId } : {}),
      ...(extras?.originalShipmentId ? { originalShipmentId: extras.originalShipmentId } : {}),
      ...(shipment.driverId ? { driverId: shipment.driverId } : {}),
      ...(shipment.driverName ? { driverName: shipment.driverName } : {}),
    },
  };
}

export function eventTypeForShipmentStatus(status: ShipmentStatus): DispatchEventType | null {
  switch (status) {
    case 'CREATED':
      return 'ShipmentCreated';
    case 'PICKING':
      return 'ShipmentPicking';
    case 'ASSIGNED':
      return 'ShipmentAssigned';
    case 'OUT_FOR_DELIVERY':
      return 'ShipmentOutForDelivery';
    case 'DELIVERED':
      return 'ShipmentDelivered';
    case 'FAILED':
      return 'ShipmentFailed';
    default:
      return null;
  }
}
