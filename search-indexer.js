process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';
require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
const { Client } = require('@opensearch-project/opensearch');

const ca = fs.readFileSync(process.env.PG_CA_CERT).toString();

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: { ca },
});

const search = new Client({
  node: `https://${process.env.OS_HOST}:${process.env.OS_PORT}`,
  auth: { username: process.env.OS_USER, password: process.env.OS_PASSWORD },
});

const kafka = new Kafka({
  clientId: 'search-indexer',
  brokers: [process.env.KAFKA_BROKER],
  ssl: { ca: [ca] },
  sasl: {
    mechanism: process.env.KAFKA_SASL_MECHANISM.toLowerCase(),
    username: process.env.KAFKA_USER,
    password: process.env.KAFKA_PASSWORD,
  },
});

async function main() {
  const consumer = kafka.consumer({ groupId: 'search-indexer' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'order.placed', fromBeginning: false });
  console.log('Search indexer is waiting for orders...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const order = JSON.parse(message.value.toString());

      const { rows } = await pool.query(
        `SELECT p.id, p.name, p.description, p.price, i.quantity
         FROM products p JOIN inventory i ON i.product_id = p.id
         WHERE p.id = $1`,
        [order.productId]
      );
      if (rows.length === 0) return;
      const p = rows[0];

      if (p.quantity <= 0) {
        await search
          .delete({ index: 'products', id: String(p.id), refresh: true })
          .catch(() => {});
        console.log(`[SEARCH] Order #${order.orderId}: "${p.name}" is sold out, removed from search`);
      } else {
        await search.index({
          index: 'products',
          id: String(p.id),
          body: { name: p.name, description: p.description, price: Number(p.price) },
          refresh: true,
        });
        console.log(`[SEARCH] Order #${order.orderId}: "${p.name}" still in stock (${p.quantity} left), kept in search`);
      }
    },
  });
}

main().catch((err) => console.error('Failed:', err.message));