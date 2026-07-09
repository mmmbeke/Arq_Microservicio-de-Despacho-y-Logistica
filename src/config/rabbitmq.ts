import amqp, { Channel, ChannelModel } from 'amqplib';

export type RabbitStatus = 'disabled' | 'connected' | 'error';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let status: RabbitStatus = 'disabled';

let autoQueueName: string | null = null;

export function isRabbitEnabled(): boolean {
  return Boolean(process.env.RABBITMQ_URL?.trim());
}

export function getRabbitStatus(): RabbitStatus {
  return isRabbitEnabled() ? status : 'disabled';
}

export function getRabbitExchange(): string {
  return process.env.RABBITMQ_EXCHANGE?.trim() || 'fishmarket.events';
}

export function getRabbitOrderQueue(): string {
  if (autoQueueName) return autoQueueName;
  return process.env.RABBITMQ_ORDER_QUEUE?.trim() || 'g8.dispatch.orders';
}

export function getRabbitOrderRoutingKeys(): string[] {
  const raw =
    process.env.RABBITMQ_ORDER_ROUTING_KEYS?.trim() ||
    'ReadyToShip,OrderReadyToShip,order.ready_to_ship';
  return raw.split(',').map((key) => key.trim()).filter(Boolean);
}

async function createChannel(): Promise<Channel> {
  const url = process.env.RABBITMQ_URL?.trim();
  if (!url) {
    throw new Error('RABBITMQ_URL no configurada');
  }

  connection = await amqp.connect(url);
  connection.on('error', (error) => {
    console.error('[rabbitmq] error de conexión:', error);
    status = 'error';
  });
  connection.on('close', () => {
    console.warn('[rabbitmq] conexión cerrada');
    connection = null;
    channel = null;
    status = 'error';
  });

  channel = await connection.createChannel();
  status = 'connected';
  return channel;
}

export async function getRabbitChannel(): Promise<Channel> {
  if (channel) return channel;
  return createChannel();
}

export async function initRabbitTopology(): Promise<void> {
  if (!isRabbitEnabled()) {
    console.log('[rabbitmq] Deshabilitado (sin RABBITMQ_URL)');
    return;
  }

  const ch = await getRabbitChannel();
  const exchange = getRabbitExchange();
  const routingKeys = getRabbitOrderRoutingKeys();

  await ch.assertExchange(exchange, 'topic', { durable: true });
  
  // Auto-generar queue exclusiva en lugar de un nombre fijo
  const q = await ch.assertQueue('', { exclusive: true });
  autoQueueName = q.queue;

  for (const routingKey of routingKeys) {
    await ch.bindQueue(autoQueueName, exchange, routingKey);
  }

  console.log(
    `[rabbitmq] OK — exchange=${exchange} queue=${autoQueueName} keys=[${routingKeys.join(', ')}]`
  );
}

export async function closeRabbit(): Promise<void> {
  try {
    await channel?.close();
    await connection?.close();
  } catch {
    // ignore shutdown errors
  } finally {
    channel = null;
    connection = null;
    status = 'disabled';
  }
}
