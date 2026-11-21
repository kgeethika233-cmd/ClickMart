# Inventory Hub - API Contract (v1.0.0)

**Single Source of Truth** for Device A (Backend) and Device B (Frontend).

---

## 1. General Principles
- Base URL: `http://<host>:4000`
- All money amounts are transmitted as integer **paise** (`priceCents`, 1 INR = 100 paise).
- All timestamps are ISO 8601 strings (`2026-11-21T18:00:00.000Z`).
- Headers:
  - `Content-Type: application/json` on POST requests.
  - `ngrok-skip-browser-warning: true` supported on all requests.

---

## 2. Standard Error Response Shape
Every non-2xx response adheres strictly to this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | OUT_OF_STOCK | UNAUTHORIZED | RATE_LIMITED | INTERNAL_ERROR",
    "message": "Human-readable description of error",
    "details": {}
  }
}
```

---

## 3. Endpoints

### 3.1 Health Check: `GET /api/health`
- **Response (200 OK / 503 Service Unavailable)**:
```json
{
  "status": "ok",
  "services": {
    "postgres": "up",
    "kafka": "up",
    "opensearch": "up"
  },
  "contractVersion": "1.0.0"
}
```

### 3.2 Product Search: `GET /api/search`
- **Query Parameters**:
  - `q`: string (max 100 chars, typo tolerant)
  - `category`: string (can be repeated, e.g. `category=Electronics&category=Books`)
  - `city`: string (can be repeated, e.g. `city=Bengaluru`)
  - `minPrice`: integer paise
  - `maxPrice`: integer paise
  - `sort`: `relevance` | `price_asc` | `price_desc`
  - `page`: integer (>= 1, default 1)
  - `pageSize`: integer (1-50, default 12)
- **Response (200 OK)**:
```json
{
  "products": [
    {
      "id": 1,
      "sku": "ELEC-SPK-001",
      "name": "Bluetooth Speaker",
      "description": "Portable waterproof speaker",
      "category": "Electronics",
      "city": "Bengaluru",
      "priceCents": 149900,
      "currency": "INR",
      "imageUrl": "https://picsum.photos/seed/ELEC-SPK-001/400/300",
      "availableCount": 5,
      "inStock": true
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 12,
  "totalPages": 1,
  "facets": {
    "categories": [{ "value": "Electronics", "count": 1 }],
    "cities": [{ "value": "Bengaluru", "count": 1 }],
    "priceRanges": [
      { "key": "under-500", "label": "Under ₹500", "minPrice": 0, "maxPrice": 50000, "count": 0 },
      { "key": "500-1500", "label": "₹500 - ₹1,500", "minPrice": 50000, "maxPrice": 150000, "count": 1 },
      { "key": "1500-5000", "label": "₹1,500 - ₹5,000", "minPrice": 150000, "maxPrice": 500000, "count": 0 },
      { "key": "above-5000", "label": "Above ₹5,000", "minPrice": 500000, "maxPrice": null, "count": 0 }
    ]
  }
}
```

### 3.3 Get Product Detail: `GET /api/products/:productId`
- **Response (200 OK)**: Product object.
- **Response (404 NOT_FOUND)**: When ID does not exist.

### 3.4 Place Order: `POST /api/orders`
- **Request Body**:
```json
{
  "customerEmail": "shopper@test.com",
  "customerName": "Alice Johnson",
  "idempotencyKey": "e8c6b77c-7a91-4cf1-8fb8-c5d0124ad19e",
  "items": [
    { "productId": 1, "quantity": 1 }
  ]
}
```
- **Responses**:
  - `201 Created`: Order placed successfully.
  - `200 OK`: Idempotent replay of previously submitted order.
  - `409 OUT_OF_STOCK`: Insufficient available inventory. Details: `{ "productId": 1, "available": 0 }`.
  - `400 VALIDATION_ERROR`: Missing or invalid fields.

### 3.5 Get Order Detail: `GET /api/orders/:orderId`
- **Response (200 OK)**:
```json
{
  "id": "e8c6b77c-7a91-4cf1-8fb8-c5d0124ad19e",
  "customerEmail": "shopper@test.com",
  "customerName": "Alice Johnson",
  "status": "PLACED | CONFIRMED | CANCELLED",
  "totalCents": 149900,
  "currency": "INR",
  "items": [
    {
      "id": 1,
      "productId": 1,
      "productName": "Bluetooth Speaker",
      "quantity": 1,
      "priceCents": 149900
    }
  ],
  "createdAt": "2026-11-21T18:00:00.000Z",
  "updatedAt": "2026-11-21T18:00:00.000Z"
}
```

---

## 4. CORS Specification
- Allowed Methods: `GET, POST, OPTIONS`
- Allowed Headers: `Content-Type, Authorization, x-admin-key, ngrok-skip-browser-warning`
- Preflight: `OPTIONS` returns 204 No Content with CORS headers.
