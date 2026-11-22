import { pool } from '../db.js';
import { kafka } from '../kafka.js';
import { randomUUID } from 'crypto';

async function main() {
  console.log('\n======================================================');
  console.log('🧪 Kafka Idempotency Test: replay same event twice');
  console.log('======================================================\n');

  const client = await pool.connect();
  let productId = 0;
  try {
    const { rows } = await client.query("SELECT id FROM products WHERE sku = 'IH-001'");
    if (!rows.length) throw new Error('Product IH-001 not found');
    productId = rows[0].id;
    // Set stock to 20, reserved 0
    await client.query('UPDATE inventory SET stock_count = 20, reserved_count = 0 WHERE product_id = $1', [productId]);
  } finally {
    client.release();
  }

  // Generate fake order
  const orderId = randomUUID();
  const eventId = `test-idemp-${randomUUID()}`;
  const testPayload = {
    eventId,
    orderId,
    customerEmail: 'idemp-test@example.com',
    customerName: 'Idempotency Tester',
    totalCents: 29900,
    items: [{ productId, quantity: 2, priceCents: 29900 }],
  };

  // We set reserved_count = 2 to simulate what happens during order placement
  await pool.query('UPDATE inventory SET reserved_count = reserved_count + 2 WHERE product_id = $1', [productId]);
  await pool.query(
    "INSERT INTO orders (id, customer_email, customer_name, status, idempotency_key, total_cents, currency) VALUES ($1, $2, $3, 'PLACED', $4, $5, 'INR')",
    [orderId, testPayload.customerEmail, testPayload.customerName, `idem-${orderId}`, testPayload.totalCents]
  );

  console.log(`Initial stock for product #${productId}: stock_count = 20, reserved_count = 2`);

  const producer = kafka.producer();
  await producer.connect();

  console.log('Publishing event FIRST time...');
  await producer.send({
    topic: 'order.placed',
    messages: [{ key: orderId, value: JSON.stringify({ eventId, data: testPayload }) }],
  });

  // Wait 4s for inventoryWorker to process
  await new Promise((r) => setTimeout(r, 4000));

  const check1 = await pool.query('SELECT stock_count, reserved_count FROM inventory WHERE product_id = $1', [productId]);
  console.log('Stock after 1st processing:', check1.rows[0]);

  console.log('Replaying the EXACT same event a SECOND time...');
  await producer.send({
    topic: 'order.placed',
    messages: [{ key: orderId, value: JSON.stringify({ eventId, data: testPayload }) }],
  });

  // Wait 4s for inventoryWorker to receive and skip duplicate
  await new Promise((r) => setTimeout(r, 4000));

  const check2 = await pool.query('SELECT stock_count, reserved_count FROM inventory WHERE product_id = $1', [productId]);
  console.log('Stock after 2nd (duplicate) processing:', check2.rows[0]);

  await producer.disconnect();
  await pool.end();

  if (check1.rows[0].stock_count === check2.rows[0].stock_count && check1.rows[0].stock_count === 18) {
    console.log('\n✅ PASSED: Duplicate event was safely skipped. Inventory was deducted exactly ONCE!\n');
  } else {
    console.error('\n❌ FAILED: Inventory changed on duplicate event replay!\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

