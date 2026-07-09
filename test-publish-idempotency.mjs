import amqp from 'amqplib';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL not set');
  const conn = await amqp.connect(url);
  const ch = await conn.createChannel();
  const exchange = 'fishmarket.events';
  const routingKey = 'ReadyToShip';

  const payload = {
    eventId: 'test-evt-fixed-12345',
    eventType: 'ReadyToShip',
    correlationId: 'corr-test-fixed-12345',
    payload: {
      orderId: 'ORD-TEST-FIXED'
    }
  };

  ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
    contentType: 'application/json',
    persistent: true
  });

  console.log('Event published:', payload);
  setTimeout(() => {
    conn.close();
    process.exit(0);
  }, 1000);
}

run().catch(console.error);
