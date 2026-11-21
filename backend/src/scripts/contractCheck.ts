import { randomUUID } from 'crypto';

const BASE_URL = process.argv[2] || 'http://localhost:4000';

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const results: CheckResult[] = [];

async function runCheck(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, status: 'PASS' });
  } catch (err: any) {
    results.push({ name, status: 'FAIL', details: err.message });
  }
}

async function main() {
  console.log(`\n🔍 Running contract verification checks against: ${BASE_URL}\n`);

  // 1. Health check
  await runCheck('GET /api/health returns 200 and contractVersion 1.0.0', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (data.contractVersion !== '1.0.0') throw new Error(`contractVersion was ${data.contractVersion}`);
    if (!data.services || !data.services.postgres) throw new Error('Missing services block');
  });

  // 2. CORS check
  await runCheck('OPTIONS preflight returns 204 with CORS headers', async () => {
    const res = await fetch(`${BASE_URL}/api/search`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
      },
    });
    if (res.status !== 204) throw new Error(`Status was ${res.status}`);
    const acao = res.headers.get('access-control-allow-origin');
    if (!acao) throw new Error('Missing Access-Control-Allow-Origin header');
  });

  // 3. Search without params
  let sampleProductId = 1;
  await runCheck('GET /api/search returns products list and facets', async () => {
    const res = await fetch(`${BASE_URL}/api/search`);
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.products)) throw new Error('products is not an array');
    if (!data.facets || !Array.isArray(data.facets.priceRanges)) throw new Error('Missing facets');
    if (data.products.length > 0) sampleProductId = data.products[0].id;
  });

  // 4. Typo-tolerant search
  await runCheck('GET /api/search?q=bluetoth returns fuzzy matches', async () => {
    const res = await fetch(`${BASE_URL}/api/search?q=bluetoth`);
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (!data.products.some((p: any) => /bluetooth/i.test(p.name))) {
      throw new Error('No Bluetooth products found for typo "bluetoth"');
    }
  });

  // 5. Product Detail
  await runCheck('GET /api/products/:productId returns product shape', async () => {
    const res = await fetch(`${BASE_URL}/api/products/${sampleProductId}`);
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const p = await res.json();
    if (typeof p.priceCents !== 'number' || typeof p.availableCount !== 'number') {
      throw new Error('Product shape missing priceCents or availableCount');
    }
  });

  // 6. Missing product 404 shape
  await runCheck('GET /api/products/999999 returns 404 in contract shape', async () => {
    const res = await fetch(`${BASE_URL}/api/products/999999`);
    if (res.status !== 404) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (data.error?.code !== 'NOT_FOUND') throw new Error(`Error code was ${data.error?.code}`);
  });

  // 7. Create Order & Idempotent Replay
  const idemKey = randomUUID();
  let createdOrderId = '';

  await runCheck('POST /api/orders creates order with 201', async () => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail: 'contract-test@example.com',
        customerName: 'Contract Tester',
        idempotencyKey: idemKey,
        items: [{ productId: sampleProductId, quantity: 1 }],
      }),
    });
    if (res.status !== 201) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (!data.id || data.status !== 'PLACED') throw new Error('Invalid order response');
    createdOrderId = data.id;
  });

  await runCheck('POST /api/orders returns 200 on same idempotencyKey', async () => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail: 'contract-test@example.com',
        customerName: 'Contract Tester',
        idempotencyKey: idemKey,
        items: [{ productId: sampleProductId, quantity: 1 }],
      }),
    });
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (data.id !== createdOrderId) throw new Error('Did not return original order');
  });

  // 8. Order Detail
  await runCheck('GET /api/orders/:orderId returns full order details', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${createdOrderId}`);
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (data.id !== createdOrderId || !Array.isArray(data.items)) throw new Error('Invalid order details');
  });

  // 9. Validation error on invalid body
  await runCheck('POST /api/orders returns 400 VALIDATION_ERROR on bad input', async () => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail: 'not-an-email',
      }),
    });
    if (res.status !== 400) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (data.error?.code !== 'VALIDATION_ERROR') throw new Error(`Error code was ${data.error?.code}`);
  });

  // Print Table
  console.table(results.map((r) => ({ Test: r.name, Status: r.status, Details: r.details || '' })));

  const hasFailures = results.some((r) => r.status === 'FAIL');
  if (hasFailures) {
    console.error('\n❌ Contract checks failed.');
    process.exit(1);
  } else {
    console.log('\n✅ All contract checks passed successfully.');
  }
}

main();
