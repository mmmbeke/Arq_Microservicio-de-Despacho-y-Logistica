import { DomainEvent } from '../types/shipment.types';
import { getRabbitChannel, getRabbitExchange, isRabbitEnabled } from '../config/rabbitmq';

function routingKeyForEvent(event: DomainEvent): string {
  const custom = process.env.RABBITMQ_PUBLISH_ROUTING_KEY?.trim();
  if (custom) return custom;

  // Convención topic: shipment.created, shipment.delivered, etc.
  const dotted = event.eventType
    .replace(/([a-z])([A-Z])/g, '$1.$2')
    .toLowerCase();

  return dotted;
}

export async function publishDomainEvent(event: DomainEvent): Promise<boolean> {
  if (!isRabbitEnabled()) return false;

  try {
    const channel = await getRabbitChannel();
    const exchange = getRabbitExchange();
    const routingKey = routingKeyForEvent(event);
    const body = Buffer.from(JSON.stringify(event));

    channel.publish(exchange, routingKey, body, {
      contentType: 'application/json',
      persistent: true,
      headers: {
        'X-Correlation-Id': event.correlationId,
        'X-Producer': event.producer,
        'X-Event-Type': event.eventType,
      },
    });

    // Compatibilidad: algunos grupos enlazan por eventType literal (ej. ShipmentCreated)
    if (routingKey !== event.eventType) {
      channel.publish(exchange, event.eventType, body, {
        contentType: 'application/json',
        persistent: true,
        headers: {
          'X-Correlation-Id': event.correlationId,
          'X-Producer': event.producer,
          'X-Event-Type': event.eventType,
        },
      });
    }

    console.log(`[rabbitmq] publicado ${event.eventType} → ${exchange}/${routingKey}`);
    return true;
  } catch (error) {
    console.warn('[rabbitmq] no se pudo publicar evento:', error);
    return false;
  }
}
