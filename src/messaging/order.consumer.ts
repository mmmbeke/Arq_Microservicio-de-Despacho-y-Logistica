import { ConsumeMessage } from 'amqplib';
import { getRabbitChannel, getRabbitOrderQueue, isRabbitEnabled } from '../config/rabbitmq';
import * as shipmentService from '../services/shipment.service';
import { AppError } from '../utils/errors';

const READY_EVENT_TYPES = new Set([
  'ReadyToShip',
  'OrderReadyToShip',
  'order.ready_to_ship',
  'ORDER_READY_TO_SHIP',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function extractOrderId(body: unknown): string | null {
  const root = asRecord(body);
  if (!root) return null;

  if (typeof root.orderId === 'string' && root.orderId.trim()) {
    return root.orderId.trim();
  }

  const payload = asRecord(root.payload);
  if (payload && typeof payload.orderId === 'string' && payload.orderId.trim()) {
    return payload.orderId.trim();
  }

  const data = asRecord(root.data);
  if (data && typeof data.orderId === 'string' && data.orderId.trim()) {
    return data.orderId.trim();
  }

  return null;
}

function extractEventType(body: unknown, routingKey: string): string {
  const root = asRecord(body);
  if (root && typeof root.eventType === 'string') return root.eventType;
  if (root && typeof root.event_type === 'string') return root.event_type;
  return routingKey;
}

function extractCorrelationId(body: unknown): string {
  const root = asRecord(body);
  if (root && typeof root.correlationId === 'string') return root.correlationId;
  if (root && typeof root.correlation_id === 'string') return root.correlation_id;
  return crypto.randomUUID();
}

function extractEventId(body: unknown, message: ConsumeMessage): string {
  const root = asRecord(body);
  if (root && typeof root.eventId === 'string') return root.eventId;
  if (root && typeof root.event_id === 'string') return root.event_id;
  return message.properties.messageId || message.fields.deliveryTag.toString();
}

function isReadyToShipEvent(eventType: string): boolean {
  return READY_EVENT_TYPES.has(eventType) || eventType.toLowerCase().includes('readytoship');
}

async function handleOrderMessage(message: ConsumeMessage): Promise<void> {
  const raw = message.content.toString('utf8');
  const body = JSON.parse(raw) as unknown;
  const routingKey = message.fields.routingKey;
  const eventType = extractEventType(body, routingKey);

  if (!isReadyToShipEvent(eventType)) {
    console.log(`[rabbitmq] mensaje ignorado eventType=${eventType}`);
    return;
  }

  const orderId = extractOrderId(body);
  if (!orderId) {
    throw new AppError(400, 'INVALID_EVENT', 'Evento ReadyToShip sin orderId.', extractCorrelationId(body));
  }

  const correlationId = extractCorrelationId(body);
  const eventId = extractEventId(body, message);
  const idempotencyKey = `rabbit-${eventId}`;

  console.log(
    `[rabbitmq] consumiendo ${eventType} orderId=${orderId} correlationId=${correlationId}`
  );

  await shipmentService.createShipment({ orderId }, idempotencyKey, correlationId);
}

function isBusinessError(error: unknown): boolean {
  return error instanceof AppError && error.status >= 400 && error.status < 500;
}

export async function startOrderConsumer(): Promise<void> {
  if (!isRabbitEnabled()) return;

  const channel = await getRabbitChannel();
  const queue = getRabbitOrderQueue();

  await channel.consume(
    queue,
    async (message) => {
      if (!message) return;

      try {
        await handleOrderMessage(message);
        channel.ack(message);
      } catch (error) {
        const correlationId =
          error instanceof AppError ? error.correlationId : 'sin-correlation-id';

        if (isBusinessError(error)) {
          console.warn(
            `[rabbitmq] evento rechazado (${error instanceof AppError ? error.code : 'ERROR'}) correlationId=${correlationId}`
          );
          channel.ack(message);
          return;
        }

        console.error('[rabbitmq] error procesando mensaje, requeue:', error);
        channel.nack(message, false, true);
      }
    },
    { noAck: false }
  );

  console.log(`[rabbitmq] consumer activo en cola ${queue}`);
}
