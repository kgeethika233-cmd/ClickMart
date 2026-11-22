require('dotenv').config();
const fs = require('fs');
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'store-reader',
  brokers: [process.env.KAFKA_BROKER],
  ssl: { ca: [fs.readFileSync(process.env.PG_CA_CERT, 'utf-8')] },
  sasl: {
    mechanism: process.env.KAFKA_SASL_MECHANISM.toLowerCase(),
    username: process.env.KAFKA_USER,
    password: process.env.KAFKA_PASSWORD,
  },
});

async function main() {
  const consumer = kafka.consumer({ groupId: 'store-reader-' + Date.now() });
  await consumer.connect();
  await consumer.subscribe({ topic: 'order.placed', fromBeginning: true });
  console.log('Waiting for messages... (press Ctrl+C to stop)');

  await consumer.run({
    eachMessage: async ({ message }) => {
      console.log('Got message:', message.value.toString());
    },
  });
}

main().catch((err) => console.error('Failed:', err.message));