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

async function restock() {
  console.log('Restocking products in database...');
  
  // Set Bluetooth Headphones: 10, Bluetooth Speaker: 1 (for testing concurrency), USB-C Cable: 10
  await pool.query(`
    UPDATE inventory 
    SET quantity = CASE 
      WHEN product_id = 2 THEN 1 
      ELSE 10 
    END;
  `);

  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.description, p.price, i.quantity
     FROM products p JOIN inventory i ON i.product_id = p.id
     ORDER BY p.id`
  );

  console.log('Updated Inventory in DB:');
  console.table(rows);

  console.log('Synchronizing OpenSearch index...');
  for (const p of rows) {
    if (p.quantity > 0) {
      await search.index({
        index: 'products',
        id: String(p.id),
        body: { name: p.name, description: p.description, price: Number(p.price) },
        refresh: true,
      });
      console.log(`Indexed in OpenSearch: ${p.name} (stock: ${p.quantity})`);
    } else {
      await search.delete({ index: 'products', id: String(p.id), refresh: true }).catch(() => {});
      console.log(`Removed from OpenSearch: ${p.name}`);
    }
  }

  console.log('Restock & search re-index complete!');
  await pool.end();
}

restock().catch((err) => {
  console.error('Restock failed:', err.message);
  process.exit(1);
});

