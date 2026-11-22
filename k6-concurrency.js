import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

// Custom metrics to count successful orders vs blocked requests
const successfulOrders = new Counter('successful_orders');
const blockedOrders = new Counter('blocked_orders');

export const options = {
  // 50 virtual users executing 1 request simultaneously
  scenarios: {
    flash_sale: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '10s',
    },
  },
};

export default function () {
  const url = 'http://localhost:3000/orders';
  const payload = JSON.stringify({
    email: `shopper_${__VU}@test.com`,
    productId: 2, // Bluetooth Speaker (quantity = 1)
    quantity: 1,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  if (res.status === 201) {
    successfulOrders.add(1);
  } else if (res.status === 409) {
    blockedOrders.add(1);
  }

  check(res, {
    'status is 201 (success) or 409 (out of stock)': (r) => r.status === 201 || r.status === 409,
  });
}

