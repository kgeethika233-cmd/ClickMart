import { pool } from '../src/db.js';

async function main() {
  const res = await pool.query('SELECT id, sku, name, city FROM products ORDER BY id');
  console.log('Existing DB products count:', res.rows.length);
  for (const r of res.rows) {
    console.log(`${r.id}: sku="${r.sku}", name="${r.name}", city="${r.city}"`);
  }
  await pool.end();
}

main().catch(console.error);
