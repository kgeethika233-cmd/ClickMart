import { logger } from '../logger.js';

interface TestCase {
  phrase: string;
  expectedIntent: 'search' | 'add_to_cart' | 'place_order';
  expectedQty: number;
  expectedCity?: string | null;
  verify: (data: any) => void;
}

const testCases: TestCase[] = [
  {
    phrase: 'Coffee mug',
    expectedIntent: 'search',
    expectedQty: 1,
    verify: (data) => {
      if (!Array.isArray(data.results) || data.results.length === 0) {
        throw new Error('Expected results array with products for Coffee mug');
      }
      const match = data.results.some((p: any) => p.name.toLowerCase().includes('coffee mug') || p.name.toLowerCase().includes('mug'));
      if (!match) throw new Error(`Expected matching mug product in results, got: ${data.results[0]?.name}`);
    },
  },
  {
    phrase: 'Search bluetooth earphones',
    expectedIntent: 'search',
    expectedQty: 1,
    verify: (data) => {
      if (!Array.isArray(data.results) || data.results.length === 0) {
        throw new Error('Expected results array with products for Search bluetooth earphones');
      }
      const match = data.results.some((p: any) => p.name.toLowerCase().includes('earphone') || p.name.toLowerCase().includes('bluetooth'));
      if (!match) throw new Error(`Expected bluetooth earphones in results, got: ${data.results[0]?.name}`);
    },
  },
  {
    phrase: 'Add 2 organic milk',
    expectedIntent: 'add_to_cart',
    expectedQty: 2,
    verify: (data) => {
      if (!Array.isArray(data.results) || data.results.length === 0) {
        throw new Error('Expected results array with products for Add 2 organic milk');
      }
      const match = data.results.some((p: any) => p.name.toLowerCase().includes('milk'));
      if (!match) throw new Error(`Expected organic milk in results, got: ${data.results[0]?.name}`);
    },
  },
  {
    phrase: 'Order boAt Airdopes in Coimbatore',
    expectedIntent: 'place_order',
    expectedQty: 1,
    expectedCity: 'Coimbatore',
    verify: (data) => {
      if (!data.order || !data.order.orderId) {
        throw new Error('Expected created order with orderId for Order boAt Airdopes in Coimbatore');
      }
      if (data.order.status !== 'CONFIRMED') {
        throw new Error(`Expected order status CONFIRMED, got: ${data.order.status}`);
      }
      if (!data.popup || data.popup.status !== 'CONFIRMED') {
        throw new Error('Expected confirmation popup in response');
      }
    },
  },
];

async function runVoiceTests() {
  logger.info('Starting voice assistant speed and contract test suite (npm run test:voice)...');
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const start = Date.now();
    const idempotencyKey = `voice-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const res = await fetch('http://localhost:4000/api/voice-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ transcript: tc.phrase }),
      });

      const duration = Date.now() - start;
      const data = await res.json() as any;

      if (res.status !== 200) {
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(data.error || data)}`);
      }

      if (duration >= 1500) {
        throw new Error(`Latency SLA breached: response took ${duration}ms (must be < 1500ms)`);
      }

      if (data.parsedIntent.intent !== tc.expectedIntent) {
        throw new Error(`Expected intent ${tc.expectedIntent}, got ${data.parsedIntent.intent}`);
      }

      if (data.parsedIntent.qty !== tc.expectedQty) {
        throw new Error(`Expected qty ${tc.expectedQty}, got ${data.parsedIntent.qty}`);
      }

      if (tc.expectedCity && data.parsedIntent.city !== tc.expectedCity) {
        throw new Error(`Expected city ${tc.expectedCity}, got ${data.parsedIntent.city}`);
      }

      tc.verify(data);

      logger.info(`✅ [PASS] "${tc.phrase}" answered in ${duration}ms (intent: ${data.parsedIntent.intent})`);
      passed++;
    } catch (err: any) {
      const duration = Date.now() - start;
      logger.error(`❌ [FAIL] "${tc.phrase}" failed after ${duration}ms: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Voice Assistant Test Results: ${passed}/${testCases.length} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runVoiceTests().catch((err) => {
  logger.error({ err }, 'Test execution crashed');
  process.exit(1);
});

