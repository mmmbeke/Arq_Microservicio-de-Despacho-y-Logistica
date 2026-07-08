import { Shipment } from '../types/shipment.types';
import { buildDomainEvent, eventTypeForShipmentStatus } from '../messaging/domain-events';
import { publishDomainEvent } from '../messaging/rabbit.publisher';

async function deliverEventRest(event: ReturnType<typeof buildDomainEvent>, correlationId: string): Promise<void> {
  const g9Url = process.env.G9_NOTIFICATION_SERVICE_URL;
  if (!g9Url) return;

  try {
    await fetch(`${g9Url}/notifications/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': crypto.randomUUID(),
        'X-Correlation-Id': correlationId,
        'X-Consumer': 'dispatch-service',
      },
      body: JSON.stringify(event),
    });
    console.log(`[g9-client] evento REST entregado: ${event.eventType}`);
  } catch (error) {
    console.warn('[g9-client] evento REST no entregado (consistencia eventual):', error);
  }
}

async function deliverEvent(event: ReturnType<typeof buildDomainEvent>, correlationId: string): Promise<void> {
  console.log(`[event] ${event.eventType}`, JSON.stringify(event));

  await publishDomainEvent(event);

  const restFallback = process.env.G9_NOTIFY_VIA_REST !== 'false';
  if (restFallback) {
    await deliverEventRest(event, correlationId);
  }
}

/**
 * Publica eventos de despacho hacia el ecosistema.
 * - RabbitMQ (principal): exchange topic configurado en RABBITMQ_EXCHANGE
 * - REST (opcional): POST /notifications/events en G9 si G9_NOTIFICATION_SERVICE_URL está definido
 */
export async function publishShipmentEvent(
  shipment: Shipment,
  correlationId: string,
  reason?: string
): Promise<void> {
  const eventType = eventTypeForShipmentStatus(shipment.status);
  if (!eventType) return;

  const event = buildDomainEvent(eventType, shipment, correlationId, { reason });
  await deliverEvent(event, correlationId);
}

export async function publishReshipRequested(
  originalShipment: Shipment,
  newShipment: Shipment,
  correlationId: string,
  reason?: string
): Promise<void> {
  const event = buildDomainEvent('ShipmentReshipRequested', newShipment, correlationId, {
    reason,
    originalOrderId: originalShipment.orderId,
    originalShipmentId: originalShipment.shipmentId,
  });
  await deliverEvent(event, correlationId);
}
