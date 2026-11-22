/**
 * High-Concurrency Test (Pure Node.js)
 * Fires 50 simultaneous requests to purchase the last unit of product #2.
 * Validates that row locking (SELECT ... FOR UPDATE) allows exactly ONE order
 * to succeed (201) and blocks the other 49 (409 Conflict).
 */

const TARGET_URL = 'http://localhost:3000/orders';
const CONCURRENT_REQUESTS = 50;
const PRODUCT_ID = 2; // Bluetooth Speaker with 1 unit remaining

async function runConcurrencyTest() {
  console.log(`\n======================================================`);
  console.log(`Firing ${CONCURRENT_REQUESTS} simultaneous order requests for Product #${PRODUCT_ID}...`);
  console.log(`======================================================\n`);

  const requests = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => {
    return fetch(TARGET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `buyer_${i + 1}@example.com`,
        productId: PRODUCT_ID,
        quantity: 1,
      }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        return { status: res.status, body };
      })
      .catch((err) => ({ status: 'ERROR', error: err.message }));
  });

  const results = await Promise.all(requests);

  let successCount = 0;
  let conflictCount = 0;
  let otherCount = 0;

  for (const r of results) {
    if (r.status === 201) successCount++;
    else if (r.status === 409) conflictCount++;
    else otherCount++;
  }

  console.log(`Test Results:`);
  console.log(`  - 201 Created (Success):       ${successCount}`);
  console.log(`  - 409 Conflict (Stock Blocked): ${conflictCount}`);
  if (otherCount > 0) {
    console.log(`  - Other Status / Errors:        ${otherCount}`);
  }

  console.log(`\nEvaluation:`);
  if (successCount === 1 && conflictCount === CONCURRENT_REQUESTS - 1) {
    console.log(`✅ PASSED: Exactly 1 order succeeded. Database row locking prevented overselling!`);
  } else if (successCount > 1) {
    console.log(`❌ FAILED: Overselling detected! ${successCount} orders succeeded.`);
  } else {
    console.log(`⚠️ Note: Success count was ${successCount}. Make sure product #${PRODUCT_ID} has stock = 1 before testing (run 'node restock.js').`);
  }
}

runConcurrencyTest();

