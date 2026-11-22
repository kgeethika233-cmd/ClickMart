import { pool } from '../src/db.js';

async function main() {
  const duplicateNames = [
    'Ceramic Coffee Mug Set',
    'Bluetooth Headphones',
    'Bluetooth Speaker',
    'Clean Code Handbook',
    'Wireless Earbuds',
    'Stainless Steel Water Bottle',
    'Classic Cotton T-Shirt'
  ];

  for (const name of duplicateNames) {
    const res = await pool.query(`SELECT id, sku, name, city FROM products WHERE name = $1 ORDER BY id`, [name]);
    console.log(`\nProduct: ${name}`);
    for (const row of res.rows) {
      const orderItems = await pool.query(`SELECT count(*) FROM order_items WHERE product_id = $1`, [row.id]);
      const ledger = await pool.query(`SELECT count(*) FROM ledger_entries WHERE product_id = $1`, [row.id]);
      console.log(`  id=${row.id}, sku=${row.sku}, order_items=${orderItems.rows[0].count}, ledger=${ledger.rows[0].count}`);
    }
  }

  await pool.end();
}

main().catch(console.error);

