import { randomUUID } from 'crypto';
import { pool } from '../db.js';

const BASE_URL = process.argv[2] || 'http://localhost:4000';
const CONCURRENCY = 50;

async function run() {
  console.log('\n======================================================');
  console.log(`⚡ Concurrency Proof: ${CONCURRENCY} simultaneous requests on 1 unit`);
  console.log('======================================================\n');

  // 1. Reset LAST-ITEM-TEST to stock 1
  const client = await pool.connect();
  let productId = 0;
  try {
    const { rows } = await client.query("SELECT id FROM products WHERE sku = 'LAST-ITEM-TEST'");
    if (rows.length === 0) {
      console.error('LAST-ITEM-TEST product not found. Run db:seed first.');
      process.exit(1);
    }
    productId = rows[0].id;

    await client.query(
      'UPDATE inventory SET stock_count = 1, reserved_count = 0 WHERE product_id = $1',
      [productId]
    );
    console.log(`Reset product #${productId} (LAST-ITEM-TEST) to stock_count = 1, reserved_count = 0.`);
  } finally {
    client.release();
  }

  // 2. Fire 50 simultaneous POST requests
  const requests = Array.from({ length: CONCURRENCY }, (_, i) => {
    return fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail: `buyer_${i + 1}@example.com`,
        customerName: `Buyer ${i + 1}`,
        idempotencyKey: `idem-${randomUUID()}`,
        items: [{ productId, quantity: 1 }],
      }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        return { status: res.status, body };
      })
      .catch((err) => ({ status: 'ERROR', error: err.message }));
  });

  const results = await Promise.all(requests);

  const count201 = results.filter((r) => r.status === 201).length;
  const count409 = results.filter((r) => r.status === 409).length;
  const countOther = results.length - count201 - count409;

  console.log('\nResults:');
  console.log(`  - 201 Created (Success):       ${count201}`);
  console.log(`  - 409 Conflict (Out of stock): ${count409}`);
  if (countOther > 0) {
    console.log(`  - Other responses:             ${countOther}`);
    results.filter(r => r.status !== 201 && r.status !== 409).slice(0, 5).forEach(r => console.log('Sample unexpected:', r));
  }

  if (count201 === 1 && count409 === 49) {
    console.log(`\n✅ PASSED: Exactly 1 order succeeded and 49 were safely rejected with 409 Conflict!`);
  } else {
    console.error(`\n❌ FAILED: Concurrency invariant violated (201s: ${count201}, 409s: ${count409})`);
    process.exit(1);
  }

  // Check inventory after worker processing
  await new Promise((r) => setTimeout(r, 2000));
  const finalCheck = await pool.query(
    'SELECT stock_count, reserved_count FROM inventory WHERE product_id = $1',
    [productId]
  );
  console.log('Final inventory state in DB:', finalCheck.rows[0]);

  await pool.end();
}

run().catch((err) => {
  console.error('Concurrency test error:', err);
  process.exit(1);
});
