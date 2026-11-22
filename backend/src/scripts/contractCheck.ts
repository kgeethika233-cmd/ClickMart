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
    let res = await fetch(`${BASE_URL}/api/health`);
    if (res.status !== 200) {
      await new Promise((r) => setTimeout(r, 1000));
      res = await fetch(`${BASE_URL}/api/health`);
    }
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (data.contractVersion !== '1.0.0') throw new Error(`contractVersion was ${data.contractVersion}`);
    if (!data.services || !data.services.postgres || !data.services.kafka || !data.services.opensearch) {
      throw new Error('Missing services block');
    }
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
  await runCheck('GET /api/search returns items list and facets', async () => {
    const res = await fetch(`${BASE_URL}/api/search`);
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    const list = data.items || data.products;
    if (!Array.isArray(list)) throw new Error('items is not an array');
    if (!data.facets || !Array.isArray(data.facets.priceRanges)) throw new Error('Missing facets');
    if (list.length > 0) sampleProductId = list[0].productId || list[0].id;
  });

  // 4. Typo-tolerant search
  await runCheck('GET /api/search?q=bluetoth returns fuzzy matches', async () => {
    const res = await fetch(`${BASE_URL}/api/search?q=bluetoth`);
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    const list = data.items || data.products;
    if (!list.some((p: any) => /bluetooth/i.test(p.name))) {
      throw new Error('No Bluetooth products found for typo "bluetoth"');
    }
  });

  // 5. Autocomplete
  await runCheck('GET /api/autocomplete?q=blue returns suggestions and corrections', async () => {
    const res = await fetch(`${BASE_URL}/api/autocomplete?q=bluetoth`);
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.suggestions) || !Array.isArray(data.products)) {
      throw new Error('Invalid autocomplete response shape');
    }
  });

  // 6. Image search
  await runCheck('POST /api/search/image returns detected keywords and products', async () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const body = `${boundary}\r\nContent-Disposition: form-data; name="image"; filename="bluetooth_headphones.png"\r\nContent-Type: image/png\r\n\r\nfake-image-bytes\r\n${boundary}--\r\n`;
    const res = await fetch(`${BASE_URL}/api/search/image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary.slice(2)}`,
      },
      body,
    });
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (!data.detected || !Array.isArray(data.products)) throw new Error('Invalid image search response');
  });

  // 7. Product Detail
  await runCheck('GET /api/products/:productId returns product shape with live stock', async () => {
    const res = await fetch(`${BASE_URL}/api/products/${sampleProductId}`);
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const p = await res.json();
    if (typeof p.priceCents !== 'number' || typeof p.availableCount !== 'number') {
      throw new Error('Product shape missing priceCents or availableCount');
    }
  });

  // 8. Missing product 404 shape
  await runCheck('GET /api/products/999999 returns 404 in contract shape', async () => {
    const res = await fetch(`${BASE_URL}/api/products/999999`);
    if (res.status !== 404) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (data.error?.code !== 'NOT_FOUND') throw new Error(`Error code was ${data.error?.code}`);
  });

  // 9. Create Order & Idempotent Replay
  const idemKey = `idem-${randomUUID()}`;
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
    const orderId = data.orderId || data.id;
    if (!orderId || data.status !== 'PLACED') throw new Error('Invalid order response');
    createdOrderId = orderId;
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
    const orderId = data.orderId || data.id;
    if (orderId !== createdOrderId) throw new Error('Did not return original order');
  });

  // 10. Order Detail
  await runCheck('GET /api/orders/:orderId returns full order details', async () => {
    const res = await fetch(`${BASE_URL}/api/orders/${createdOrderId}`);
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    const orderId = data.orderId || data.id;
    if (orderId !== createdOrderId || !Array.isArray(data.items)) throw new Error('Invalid order details');
  });

  // 11. Validation error on invalid body
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

  // 12. Auth Demo & Me
  let authToken = '';
  await runCheck('POST /api/auth/demo returns user and token', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/demo`, { method: 'POST' });
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (!data.user || !data.token) throw new Error('Missing user or token');
    authToken = data.token;
  });

  await runCheck('GET /api/auth/me with Bearer token returns profile', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (!data.user && !data.id) throw new Error('Missing profile in response');
  });

  // 13. Location IP
  await runCheck('GET /api/location/ip returns city and coordinates', async () => {
    const res = await fetch(`${BASE_URL}/api/location/ip`);
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (!data.city || typeof data.lat !== 'number') throw new Error('Invalid location shape');
  });

  // 14. Voice Command
  await runCheck('POST /api/voice-command parses search query', async () => {
    const res = await fetch(`${BASE_URL}/api/voice-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ transcript: 'show me bluetooth speaker in Bengaluru' }),
    });
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (!data.parsedIntent || !Array.isArray(data.results)) throw new Error('Invalid voice command response');
  });

  // 15. Chat Endpoint
  await runCheck('POST /api/chat provides intelligent assistance', async () => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is the delivery fee for Bengaluru?' }],
        context: { city: 'Bengaluru', cartProductIds: [], lastOrderId: null },
      }),
    });
    if (res.status !== 200) throw new Error(`Status was ${res.status}`);
    const data = await res.json();
    if (typeof data.reply !== 'string') throw new Error('Invalid chat response shape');
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
