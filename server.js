process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';
require('dotenv').config();
const fs = require('fs');
const express = require('express');
const cors = require('cors');
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
  max: 10,
});

const search = new Client({
  node: `https://${process.env.OS_HOST}:${process.env.OS_PORT}`,
  auth: { username: process.env.OS_USER, password: process.env.OS_PASSWORD },
});

const kafka = new Kafka({
  clientId: 'store-api',
  brokers: [process.env.KAFKA_BROKER],
  ssl: { ca: [ca] },
  sasl: {
    mechanism: process.env.KAFKA_SASL_MECHANISM.toLowerCase(),
    username: process.env.KAFKA_USER,
    password: process.env.KAFKA_PASSWORD,
  },
});
const producer = kafka.producer();

const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Store API is running.' });
});

app.get('/products', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT p.id, p.name, p.description, p.price, i.quantity
       FROM products p JOIN inventory i ON i.product_id = p.id
       ORDER BY p.id`
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Typo-tolerant search. Only in-stock products are in the index.
app.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Add a search word, for example /search?q=bluetoth' });
  try {
    const result = await search.search({
      index: 'products',
      body: {
        query: {
          multi_match: {
            query: q,
            fields: ['name^2', 'description'],
            fuzziness: 'AUTO',
          },
        },
      },
    });
    const hits = (result.body || result).hits.hits;
    res.json(hits.map((h) => ({ id: Number(h._id), ...h._source })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/orders', async (req, res) => {
  const { email, productId, quantity } = req.body;
  if (!email || !productId || !Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: 'Send email, productId and quantity (a whole number, 1 or more)' });
  }

  const client = await pool.connect();
  let orderId;
  try {
    await client.query('BEGIN');

    const stock = await client.query(
      'SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE',
      [productId]
    );
    if (stock.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }
    if (stock.rows[0].quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Not enough stock' });
    }

    await client.query(
      'UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2',
      [quantity, productId]
    );
    const order = await client.query(
      'INSERT INTO orders (customer_email) VALUES ($1) RETURNING id',
      [email]
    );
    orderId = order.rows[0].id;
    await client.query(
      'INSERT INTO order_items (order_id, product_id, quantity) VALUES ($1, $2, $3)',
      [orderId, productId, quantity]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }

  try {
    await producer.send({
      topic: 'order.placed',
      messages: [{
        key: String(orderId),
        value: JSON.stringify({ orderId, email, productId, quantity }),
      }],
    });
    console.log('Kafka message sent for order', orderId);
  } catch (err) {
    console.error('Order saved but Kafka message failed:', err.message);
  }

  res.status(201).json({ orderId, message: 'Order placed' });
});

producer.connect()
  .then(() => {
    console.log('Kafka producer connected');
    app.listen(3000, () => console.log('API running at http://localhost:3000'));
  })
  .catch((err) => console.error('Could not start:', err.message));