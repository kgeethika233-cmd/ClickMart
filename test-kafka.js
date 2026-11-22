require('dotenv').config();
const fs = require('fs');
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'store-test',
  brokers: [process.env.KAFKA_BROKER],
  ssl: { ca: [fs.readFileSync(process.env.PG_CA_CERT, 'utf-8')] },
  sasl: {
    mechanism: process.env.KAFKA_SASL_MECHANISM.toLowerCase(),
    username: process.env.KAFKA_USER,
    password: process.env.KAFKA_PASSWORD,
  },
});

async function main() {
  const admin = kafka.admin();
  await admin.connect();
  console.log('Connected to Kafka!');

  const created = await admin.createTopics({
    topics: [{ topic: 'order.placed' }],
  });
  console.log('Topic created now?', created);

  const topics = await admin.listTopics();
  console.log('Topics:', topics);

  await admin.disconnect();
}

main().catch((err) => console.error('Failed:', err.message));