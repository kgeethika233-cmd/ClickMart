process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';
require('dotenv').config();
const fs = require('fs');
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'notification-worker',
  brokers: [process.env.KAFKA_BROKER],
  ssl: { ca: [fs.readFileSync(process.env.PG_CA_CERT, 'utf-8')] },
  sasl: {
    mechanism: process.env.KAFKA_SASL_MECHANISM.toLowerCase(),
    username: process.env.KAFKA_USER,
    password: process.env.KAFKA_PASSWORD,
  },
});

async function main() {
  const consumer = kafka.consumer({ groupId: 'notification-service' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'order.placed', fromBeginning: false });
  console.log('Notification worker is waiting for orders...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const order = JSON.parse(message.value.toString());
      console.log(
        `[EMAIL] To: ${order.email} | Subject: Order #${order.orderId} confirmed | ` +
        `Body: Thanks! We received your order for product ${order.productId} (qty ${order.quantity}).`
      );
    },
  });
}

main().catch((err) => console.error('Failed:', err.message));