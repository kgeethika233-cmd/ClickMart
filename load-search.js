require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');
const { Client } = require('@opensearch-project/opensearch');

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: { ca: fs.readFileSync(process.env.PG_CA_CERT).toString() },
});

const search = new Client({
  node: `https://${process.env.OS_HOST}:${process.env.OS_PORT}`,
  auth: { username: process.env.OS_USER, password: process.env.OS_PASSWORD },
});

async function main() {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.description, p.price, i.quantity
     FROM products p JOIN inventory i ON i.product_id = p.id`
  );

  for (const p of rows) {
    if (p.quantity > 0) {
      await search.index({
        index: 'products',
        id: String(p.id),
        body: { name: p.name, description: p.description, price: Number(p.price) },
        refresh: true,
      });
      console.log('Indexed:', p.name);
    } else {
      await search.delete({ index: 'products', id: String(p.id), refresh: true })
        .catch(() => {});
      console.log('Skipped (sold out):', p.name);
    }
  }

  await pool.end();
}

main().catch((err) => { console.error('Failed:', err.message); process.exit(1); });