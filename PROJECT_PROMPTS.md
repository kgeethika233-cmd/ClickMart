# PROJECT_PROMPTS.md: Two-Device Build Guide (Backend on Device A, Frontend on Device B)

**Project:** Real-time inventory, search and order pipeline (Aiven PostgreSQL + Kafka + OpenSearch, Next.js storefront)
**Built in:** Google Antigravity, on two separate computers

You will use three documents:

| File | Purpose |
|---|---|
| `contract/API_CONTRACT.md` | The exact API both devices must obey. **Wins over everything else.** |
| `contract/types.ts` | TypeScript types for the contract (copied into both projects by a script) |
| `ARCHITECTURE.md` | Backend internals (schema, Kafka, OpenSearch). Needed on Device A. Device B can ignore it. |

---

## PART 0: How the two devices fit together

```
 DEVICE A (Backend)                              DEVICE B (Frontend)
 ┌───────────────────────────────┐              ┌──────────────────────────────┐
 │ backend/  (Node + TypeScript) │              │ storefront/  (Next.js)       │
 │  - Express API  :4000         │ ◄──HTTP/JSON─┤  - calls {API_BASE}/api/...  │
 │  - 4 workers                  │              │  - MOCK mode until backend   │
 │  - has Aiven secrets + certs  │              │  - NO Aiven secrets at all   │
 └──────────────┬────────────────┘              └──────────────────────────────┘
                │
        Aiven PostgreSQL · Kafka · OpenSearch (cloud)
```

### The 8 golden rules (these prevent every merge problem)

1. **Folder ownership.** Device A edits **only** `backend/`. Device B edits **only** `storefront/`. Nobody edits the other folder. Git can then never produce a merge conflict.
2. **`contract/` is read-only for both devices.** It changes only through Section 7 of `API_CONTRACT.md`.
3. **Device B never needs Aiven credentials.** Secrets live only on Device A.
4. **Same Node version on both:** Node.js 24 LTS (`node -v` must show `v24.x`).
5. **Never paste secrets into Antigravity prompts.** Use `.env` files (git-ignored).
6. **Device B builds against a mock** first, then flips one environment variable to use the real backend.
7. **Test the network connection early** (Sync Point 1), not at the end.
8. **Commit and push at the end of every phase.** Small commits are easy to recover.

### Build timeline and sync points

| Step | Device A (backend) | Device B (frontend) |
|---|---|---|
| Part 1 | Create repo, commit contract | Clone repo |
| Phase B0 | Skeleton + health + CORS | Phase F0 Skeleton + API layer + mock |
| **SYNC POINT 1** | **Connection test (Part 5)** | **Connection test (Part 5)** |
| B1 → B7 | Database, orders, Kafka, workers, search | F1 → F6 pages, all using the mock |
| B8 → B9 | Hardening + contract check | F7 polish |
| **SYNC POINT 2** | **Backend running + contract check passing** | **Phase F8: switch mock OFF** |
| **SYNC POINT 3** | Merge branches, final test | Merge branches, final test |

---

## PART 1: One-time setup (do in this order)

### 1.1 Prerequisites

**Device A (backend):** Node.js 24 LTS · Git · Antigravity · Chrome · `psql` (optional) · your Aiven account with PostgreSQL, Kafka, OpenSearch services created and the three certificate files downloaded (see `ARCHITECTURE.md` Section 5).

**Device B (frontend):** Node.js 24 LTS · Git · Antigravity · Chrome. Nothing else.

**Both devices:** a GitHub account and access to the same repository.

### 1.2 Create the repository (Device A, once)

```bash
mkdir inventory-hub
cd inventory-hub
git init -b main
mkdir contract
```

Copy these files into place, **exactly** at these paths:

```
inventory-hub/
├── ARCHITECTURE.md
├── PROJECT_PROMPTS.md
└── contract/
    ├── API_CONTRACT.md
    └── types.ts
```

Create `.gitignore` in the repo root with **exactly** this content (covers both devices):

```
node_modules/
.env
.env.local
.env.*.local
certs/
dist/
build/
.next/
*.log
.DS_Store
coverage/
```

Create a root `README.md` containing just a title (`# Inventory Hub`). Then:

```bash
git add .
git commit -m "chore: repo skeleton and contract v1.0.0"
```

On github.com create a new **empty** repository (no README, no .gitignore), then:

```bash
git remote add origin https://github.com/<you>/inventory-hub.git
git push -u origin main
```

Make the working branch for Device A:

```bash
git checkout -b backend
git push -u origin backend
```

### 1.3 Clone on Device B

```bash
git clone https://github.com/<you>/inventory-hub.git
cd inventory-hub
git checkout -b frontend
git push -u origin frontend
```

> Do **not** create `backend/` on Device B or `storefront/` on Device A. Do **not** create a root `package.json` on either device.

### 1.4 Global prompt for each device's Antigravity workspace

Paste this once at the start of each Antigravity agent session (change the device line).

**Device A:**

````text
You are building the BACKEND of "Inventory Hub" inside the folder backend/.
Read these files fully before writing any code, and follow them exactly:
  1. contract/API_CONTRACT.md  (highest authority: URLs, JSON shapes, error format, status codes)
  2. contract/types.ts          (exact TypeScript types)
  3. ARCHITECTURE.md            (database schema, Kafka topics, OpenSearch design)
Rules:
  - Only create or edit files inside backend/. Never touch contract/, storefront/, or root files.
  - If ARCHITECTURE.md and API_CONTRACT.md disagree, API_CONTRACT.md wins (see its Section 8).
  - Use Node 24, TypeScript, Express, pg with raw SQL, kafkajs, @opensearch-project/opensearch, zod, pino, dotenv, vitest.
  - Never hard-code credentials. Read everything from .env. Keep .env.example complete.
  - Never invent or rename fields, endpoints, topics, tables, or event types. If something is missing from the docs, stop and ask me.
  - Work on ONE phase at a time. When a phase is done, show me the commands to verify it and wait for my "next".
````

**Device B:**

````text
You are building the FRONTEND of "Inventory Hub" inside the folder storefront/ (Next.js, TypeScript, Tailwind).
Read these files fully before writing any code, and follow them exactly:
  1. contract/API_CONTRACT.md  (the ONLY description of the backend; URLs, JSON shapes, error format)
  2. contract/types.ts          (exact TypeScript types)
Rules:
  - Only create or edit files inside storefront/. Never touch contract/, backend/, or root files.
  - The backend is on a different computer and may not be running. Build against the mock first (see Phase F0), using the exact same function signatures as the real API layer.
  - ALL network calls go through storefront/src/lib/api.ts. No component may call fetch() directly.
  - Never invent or rename fields or endpoints. Use only the types in storefront/src/types/contract.ts (a copy of contract/types.ts made by the sync script).
  - Money from the API is integer paise (priceCents). Format only at display time.
  - There are no Aiven or backend secrets on this device. The only configuration is NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_USE_MOCK.
  - Work on ONE phase at a time. When a phase is done, show me how to verify it and wait for my "next".
````

---

## PART 2: DEVICE A (BACKEND) PHASES

Run on Device A, on branch `backend`. After each phase: run the check, then `git add . && git commit -m "<message>" && git push`.

### Phase B0: Skeleton, health, CORS, contract sync

````text
Phase B0. Create the backend project in backend/ per ARCHITECTURE.md Section 3 (use a single package; the workers are separate entry files).

1. backend/package.json with TypeScript + tsx for running, and these npm scripts:
   api, worker:outbox, worker:inventory, worker:notify, worker:index, dev:all (runs all 5 processes together using the "concurrently" package), db:migrate, db:seed, kafka:topics, os:index, os:reindex, test:concurrency, contract:check, sync:contract, test.
   Scripts that do not exist yet may be placeholders that print "not implemented yet".
2. sync:contract script, cross-platform (works on Windows), exactly:
   node -e "require('fs').copyFileSync('../contract/types.ts','src/types/contract.ts')"
   Create src/types/ and run it once. Put a comment at the top of the copied file: AUTO-COPIED, DO NOT EDIT.
3. src/config.ts: read and validate env vars with zod (names from ARCHITECTURE.md Section 5.5, but replace CORS_ORIGIN with CORS_ORIGINS = comma-separated list, and add API_HOST default 0.0.0.0). Fail fast with a clear message listing missing variables.
4. src/logger.ts (pino), src/db.ts (pg Pool, max 10, TLS with the CA file; see ARCHITECTURE.md 10.1), src/kafka.ts (SSL certs), src/opensearch.ts.
5. src/api/server.ts (Express):
   - listen on API_HOST (0.0.0.0) and API_PORT
   - JSON body parser with 100kb limit
   - CORS exactly as API_CONTRACT.md Section 5 (allowed origins from CORS_ORIGINS, methods GET/POST/OPTIONS, headers Content-Type, Authorization, x-admin-key, ngrok-skip-browser-warning, no credentials, OPTIONS returns 204)
   - a central error handler that ALWAYS returns the contract error shape (API_CONTRACT.md Section 2) with CORS headers, and a catch-all 404 handler returning NOT_FOUND in the same shape
   - GET /api/health exactly per API_CONTRACT.md Section 3.1 (checks PostgreSQL with SELECT 1, Kafka by connecting an admin client and listing topics, OpenSearch with a cluster health call; each check has a 3-second timeout; returns 200 if all up, 503 otherwise; contractVersion comes from CONTRACT_VERSION in src/types/contract.ts)
   - request logging that includes method, path, status, and duration
6. .env.example with every variable and empty values. Do not create or print a real .env.
7. Graceful shutdown on SIGINT/SIGTERM.

Do not implement any other endpoint yet.
````

**Done when:** you create `backend/.env` yourself (from `.env.example`, using your real Aiven values and the `certs/` folder inside `backend/` or a path you set), run `npm run api`, and open `http://localhost:4000/api/health` to see `"status":"ok"` with all three services `"up"`.

> **Certs location:** the repo `.gitignore` ignores `certs/` anywhere, so put them in `backend/certs/` and set `PG_CA_PATH=./certs/ca.pem` etc. in `backend/.env`.

**Then do SYNC POINT 1 (Part 5) before continuing.**

### Phase B1: Database

````text
Phase B1. Implement the database layer.
1. db/migrations/001_init.sql: copy the schema from ARCHITECTURE.md Section 6 exactly (put the db/ folder INSIDE backend/, so backend/db/migrations/001_init.sql).
2. A small migration runner script (src/scripts/migrate.ts) that applies .sql files in order and records applied files in a schema_migrations table, so re-running is safe. Wire it to npm run db:migrate.
3. backend/db/seed.sql and npm run db:seed (idempotent: use ON CONFLICT (sku) DO NOTHING or truncate-and-reload; document which). Requirements:
   - at least 30 products; categories exactly: Electronics, Fashion, Home, Books, Sports; cities exactly: Bengaluru, Mumbai, Delhi, Chennai, Hyderabad
   - prices between 19900 and 4999900 paise, spread so every price range bucket in API_CONTRACT.md 3.2 has products
   - imageUrl = https://picsum.photos/seed/<sku>/400/300
   - include: "Bluetooth Speaker", "Bluetooth Headphones", "Wireless Earbuds", at least one more Electronics item with "Headphones" in its name
   - one product with sku LAST-ITEM-TEST named "Last Item Test Gadget" with stock_count 1; one product with stock_count 0 named "Sold Out Sample"
   - 2 test customers
   - stock_count for normal items between 5 and 100, reserved_count 0
````

**Done when:** `npm run db:migrate` then `npm run db:seed` succeed, and `SELECT count(*) FROM products;` is 30 or more.

### Phase B2: Checkout, orders API (the locking core)

````text
Phase B2. Implement POST /api/orders and GET /api/orders/:orderId and GET /api/products/:productId, exactly per API_CONTRACT.md Sections 3.3-3.5 and ARCHITECTURE.md Section 8.1.
Requirements:
- Validate with zod using the limits in LIMITS from src/types/contract.ts. Validation failures return the VALIDATION_ERROR shape with details.fields. Reject duplicate productIds in one order.
- Upsert the customer by email (INSERT ... ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id).
- ONE transaction on ONE client. Lock inventory rows with SELECT ... FOR UPDATE OF i in ASCENDING productId order. Reserve via reserved_count (do NOT touch stock_count here). Take prices from the database.
- Insert orders, order_items, ledger_entries (SALE) and one outbox_events row (topic order.placed, key = orderId, envelope per ARCHITECTURE.md 7.1/7.3, eventId = the outbox row id) in the SAME transaction.
- Idempotency: same idempotencyKey returns HTTP 200 with the original Order; also handle unique-violation 23505 races by re-reading and returning the existing order with 200.
- Unknown product -> 404 NOT_FOUND. Not enough stock -> roll back everything, 409 OUT_OF_STOCK with details { productId, available }.
- Responses use the Order shape from contract/types.ts (items include product name, camelCase fields, ISO timestamps).
- GET /api/products/:productId reads from PostgreSQL and returns a Product (availableCount = stock_count - reserved_count, inStock = availableCount > 0, priceCents integer, description and imageUrl never undefined (use null where missing)).
- Write vitest integration tests: successful order, insufficient stock rolls back fully, idempotent replay, duplicate productIds rejected.
````

**Done when:** a `curl -X POST` order creates rows in `orders`, `order_items`, `ledger_entries`, `outbox_events`; `reserved_count` goes up and `stock_count` does not change.

### Phase B3: Kafka topics + outbox publisher

````text
Phase B3. Implement ARCHITECTURE.md Sections 7.2 and 8.2.
1. src/scripts/createTopics.ts (npm run kafka:topics): create all 7 topics with the listed partitions. Safe to re-run (skip existing).
2. src/events.ts: zod schemas and TypeScript types for the event envelope and the 4 event payloads (ARCHITECTURE.md 7.3). A helper buildEnvelope(eventType, data, eventId).
3. src/workers/outboxPublisher.ts: poll outbox_events every 500ms (back off to 2s when empty), SELECT ... FOR UPDATE SKIP LOCKED LIMIT 50, send to Kafka (producer acks -1, idempotent true), set published_at, COMMIT. On send failure ROLLBACK, log, wait, retry. Graceful shutdown.
````

**Done when:** after `npm run kafka:topics` and running `npm run worker:outbox`, an order's outbox row gets `published_at` filled and the message is visible in the Aiven Kafka topic viewer.

### Phase B4: Inventory worker

````text
Phase B4. Implement ARCHITECTURE.md Section 8.3 as src/workers/inventoryWorker.ts.
- Consumer group inventory-worker on topic order.placed.
- One transaction per message: processed_events guard (consumer_name 'inventory-worker') -> for each item in ascending productId order, UPDATE inventory decrementing BOTH stock_count and reserved_count by quantity, RETURNING the new values -> set orders.status = 'CONFIRMED' -> insert outbox rows for inventory.updated (one per product, ABSOLUTE numbers: stockCount, reservedCount, availableCount, reason ORDER_CONFIRMED, orderId, key = productId) and for notification.requested (key = orderId, recipient = the customer's email).
- Retry 3 times with backoff 1s/2s/4s, then publish the original message to order.placed.dlq and move on.
- Add a vitest test that processes the same event twice and asserts stock decreased once.
````

**Done when:** the order flips to `CONFIRMED`, stock drops once, and re-delivering the same event changes nothing.

### Phase B5: Notification worker

````text
Phase B5. Implement ARCHITECTURE.md Section 8.4 as src/workers/notificationWorker.ts.
- Consumer group notification-worker on topic notification.requested, idempotent through processed_events.
- EMAIL_PROVIDER=console prints a clear, formatted order-confirmation email to the log; EMAIL_PROVIDER=resend sends through the Resend HTTP API.
- Record every attempt in the notifications table (SENT or FAILED). 3 retries then notification.requested.dlq.
````

### Phase B6: OpenSearch index + indexer

````text
Phase B6. Implement ARCHITECTURE.md Sections 8.5, 9.1 and 9.2.
1. src/scripts/createIndex.ts (npm run os:index): create products_v1 with the exact mapping and the alias products. Safe to re-run.
2. src/scripts/reindexAll.ts (npm run os:reindex): bulk-load all active products joined with inventory in batches of 500. Document _id = productId. Fields: product_id, sku, name, description, category, city, price (= price_cents / 100), currency, image_url, stock_count (= AVAILABLE count: stock_count - reserved_count), in_stock, is_active, updated_at.
3. src/workers/searchIndexer.ts: consumer group search-indexer on inventory.updated and product.changed. For inventory.updated update stock_count = availableCount and in_stock = availableCount > 0 (retry_on_conflict 3; if 404, load the product from PostgreSQL and index it fully). For product.changed upsert or delete.
````

**Done when:** `GET products/_count` in OpenSearch Dashboards equals the product count, and buying the last unit of `LAST-ITEM-TEST` flips its `in_stock` to `false` within a few seconds.

### Phase B7: Search API

````text
Phase B7. Implement GET /api/search EXACTLY per API_CONTRACT.md Section 3.2 and ARCHITECTURE.md Section 9.3.
- Normalise repeated query params (category, city) to arrays whether the client sent one value or many. Validate every param with zod (page >= 1, pageSize 1-50, minPrice <= maxPrice, q max 100 chars); invalid input gives VALIDATION_ERROR.
- Always filter is_active = true AND in_stock = true.
- Fuzzy multi_match on name^3, description, category with fuzziness AUTO and prefix_length 1 when q is present; match_all otherwise.
- Sorting: relevance (score desc, then product_id asc), price_asc and price_desc (then product_id asc).
- Aggregations: categories, cities (sorted by count desc then value asc), and priceRanges with EXACTLY the four buckets and keys from PRICE_RANGE_KEYS, in order, zero counts included, with labels and minPrice/maxPrice as in the contract example.
- Map each OpenSearch hit to the Product shape: priceCents = Math.round(price * 100), availableCount = stock_count, inStock, imageUrl null if missing. Compute totalPages = ceil(total / pageSize).
- Add vitest tests for the typo queries: "bluetoth", "blutooth speker", "wireles earbuds", "headfones".
````

**Done when:** `http://localhost:4000/api/search?q=bluetoth` returns Bluetooth products with the full `facets` object.

### Phase B8: Hardening

````text
Phase B8. Security and robustness.
- express-rate-limit: 120 requests/minute per IP on /api/search and GET endpoints, 20 requests/minute on POST /api/orders. Exempt OPTIONS preflight. The 429 response must use the contract error shape and include CORS headers.
- Admin endpoint POST /api/admin/products guarded by x-admin-key (401 UNAUTHORIZED in contract shape); it upserts a product and writes a product.changed outbox event in the same transaction.
- Confirm every error path (400, 401, 404, 409, 429, 500) returns the contract error shape. Unexpected errors must log details but return a generic INTERNAL_ERROR message.
- Make sure every query is parameterised (no string concatenation in SQL).
- Add helmet.
````

### Phase B9: Contract check + concurrency proof + run-all

````text
Phase B9.
1. src/scripts/contractCheck.ts (npm run contract:check [-- <baseUrl>], default http://localhost:4000): define zod schemas that mirror contract/types.ts EXACTLY (strict: unknown extra fields fail) and call every storefront endpoint: health; search with no params; search with q=bluetoth; search with each filter; search with a page beyond the end; product detail for a real product and a missing one (404 shape); create order (201), repeat with same key (200), out-of-stock (409 shape), invalid body (400 shape); get order. Print a PASS/FAIL table and exit with code 1 on any failure. Also verify CORS: send an OPTIONS preflight with Origin set to the first value of CORS_ORIGINS and assert the response headers.
2. src/scripts/concurrencyTest.ts (npm run test:concurrency) per ARCHITECTURE.md Section 13.1: reset LAST-ITEM-TEST to stock 1, fire 20 simultaneous POST /api/orders with different idempotency keys, assert exactly one 201 and nineteen 409, then wait for the worker and assert stock_count 0 and reserved_count 0.
3. Make npm run dev:all start api + all four workers with labelled, colour-coded logs.
4. backend/README.md: setup steps, every npm script, env vars table, how to run everything.
````

**Done when:** `npm run contract:check` prints all PASS and `npm run test:concurrency` shows exactly 1 success.

Commit and push the `backend` branch. **You are ready for SYNC POINT 2.**

---

## PART 3: DEVICE B (FRONTEND) PHASES

Run on Device B, on branch `frontend`. Commit and push after each phase.

### Phase F0: Skeleton, API layer, mock mode

Create the app first (the folder `storefront` must not exist yet; run from the repo root):

```bash
npx create-next-app@latest storefront --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd storefront
npm install @tanstack/react-query
```

Then give the agent this prompt:

````text
Phase F0. Work inside storefront/ (already created with create-next-app: TypeScript, Tailwind, App Router, src/ dir). Use whatever Next.js version is installed; do not upgrade or downgrade it.

1. Add this package.json script (cross-platform):
   "sync:contract": "node -e \"require('fs').mkdirSync('src/types',{recursive:true});require('fs').copyFileSync('../contract/types.ts','src/types/contract.ts')\""
   Run it once. Put a comment at the top of the copied file: AUTO-COPIED, DO NOT EDIT.
2. Create .env.example (committed) and .env.local (NOT committed, already git-ignored) containing:
   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
   NEXT_PUBLIC_USE_MOCK=true
3. src/lib/config.ts exporting API_BASE (from process.env.NEXT_PUBLIC_API_BASE_URL, with any trailing slash and any trailing "/api" removed) and USE_MOCK (process.env.NEXT_PUBLIC_USE_MOCK === 'true'). IMPORTANT: always write the full literal process.env.NEXT_PUBLIC_... in code, because Next.js only inlines literal references.
4. src/lib/api.ts: the ONLY place that does network calls. Export these functions with exactly these signatures, using types from src/types/contract.ts:
     searchProducts(params: SearchParams): Promise<SearchResponse>
     getProduct(productId: number): Promise<Product>
     createOrder(body: CreateOrderRequest): Promise<{ order: Order; created: boolean }>   // created = HTTP 201, false = HTTP 200 (idempotent replay)
     getOrder(orderId: string): Promise<Order>
     getHealth(): Promise<HealthResponse>
   When USE_MOCK is true they delegate to src/lib/mockApi.ts; otherwise they call fetch against API_BASE + "/api/...".
   Details for the real path:
   - Build the search query string with repeated keys for category and city (category=A&category=B), omit undefined/empty params, and never send an empty q.
   - Send header Content-Type: application/json on POST only. Also send header ngrok-skip-browser-warning: true on every request.
   - Non-2xx: parse the contract error body and throw ApiError (class with fields status, code, message, details). code is the contract ErrorCode.
   - fetch failure / timeout (use AbortController, 15 s timeout): throw ApiError with status 0 and code 'NETWORK_ERROR' (a client-only code; define a type ClientErrorCode = ErrorCode | 'NETWORK_ERROR').
   - If the response is not valid JSON, throw ApiError with code 'INTERNAL_ERROR'.
   - Once on app load, call getHealth() in development and console.warn if contractVersion differs from CONTRACT_VERSION.
5. src/lib/mockApi.ts: an in-memory fake backend with the SAME return shapes, simulated latency of 200-500 ms, and:
   - 40 sample products across categories Electronics, Fashion, Home, Books, Sports and cities Bengaluru, Mumbai, Delhi, Chennai, Hyderabad, prices 19900-4999900 paise, imageUrl https://picsum.photos/seed/<sku>/400/300 (a few with null), including "Bluetooth Speaker", "Bluetooth Headphones", "Wireless Earbuds", a sku LAST-ITEM-TEST with 1 unit and a "Sold Out Sample" with 0 units.
   - searchProducts: implements q with simple typo tolerance (Levenshtein distance up to 2 for words of 6+ letters, 1 for 3-5), filters, sort, paging, and the facets exactly as in API_CONTRACT.md 3.2 (the four fixed price buckets). Never returns out-of-stock items.
   - createOrder: validates like the contract; 409 OUT_OF_STOCK as an ApiError with details { productId, available }; same idempotencyKey returns the original order with created=false; otherwise reserves stock.
   - getOrder: status PLACED, then CONFIRMED after 3 seconds. Out-of-stock items vanish from search after confirmation.
6. src/lib/format.ts: formatINR(cents: number, currency = 'INR') using Intl.NumberFormat('en-IN', { style:'currency', currency }) on cents / 100.
7. src/lib/id.ts: generateId() that uses crypto.randomUUID() when available and otherwise falls back to a crypto.getRandomValues-based UUID v4 (randomUUID is missing on non-secure origins such as http://192.168.x.x).
8. src/lib/cartStorage.ts helpers that use the localStorage key "cart:v1:" + (USE_MOCK ? "mock" : "live") so a mock-mode cart can never leak into live mode. Wrap all localStorage access in try/catch.
9. A QueryClientProvider in src/app/providers.tsx wired into layout.tsx.
10. A temporary page at / showing: current mode (MOCK or LIVE), API_BASE, and the result of getHealth() (in mock mode, getHealth returns status ok with all services up and the current CONTRACT_VERSION).
````

**Done when:** `npm run dev` opens `http://localhost:3000` showing "MOCK mode" and a healthy status.

**Then do SYNC POINT 1 (Part 5) before continuing.**

### Phase F1: Layout, header, home page

````text
Phase F1. Build the shell and home page (use the mock; no direct fetch in components).
- Responsive layout with a sticky header: logo "Inventory Hub", search box (see below), cart link with item-count badge. Mobile-first Tailwind. Footer with a small "Mode: MOCK/LIVE" indicator visible only in development.
- Header search box: debounced (300 ms) input. Typing navigates to /search?q=<text> (replace history while typing, push on Enter). Pre-fills from the current URL q param.
- Home page: hero section + "Featured products" grid showing the first 8 results from searchProducts({ pageSize: 8 }) with skeleton loading placeholders and an error state with a Retry button.
- A reusable ProductCard (image with <img> and a gray placeholder when imageUrl is null or fails to load; name; city; category badge; price via formatINR; "Add to cart" button; link to /product/<id>). Use a plain <img> element (not next/image) so no remote-image configuration is needed.
- A global cart context (src/context/CartContext.tsx) backed by cartStorage: items as { productId, name, priceCents, currency, imageUrl, quantity, maxQuantity }, functions add, setQuantity, remove, clear, plus derived itemCount and subtotalCents. Quantity is clamped 1 to 10 and to availableCount.
````

### Phase F2: Search page with fuzzy search, filters, facets

````text
Phase F2. Build /search.
- ALL state lives in the URL query string: q, category (repeatable), city (repeatable), minPrice, maxPrice, sort, page. Changing a filter updates the URL (shareable links, back button works) and resets page to 1.
- Use React Query with a query key containing the whole params object; keepPreviousData behaviour so the grid does not flash empty between searches.
- Left sidebar (collapsible drawer on mobile): checkboxes for category and city built from facets with counts; price section with the four contract price-range buckets as radio options (selecting one sets minPrice/maxPrice from the bucket) plus a "Clear" action; "Clear all filters" button; sort dropdown (Relevance, Price low to high, Price high to low).
- Results header: "<total> results" and, when q exists, the text it searched for.
- Grid of ProductCard, pagination controls (previous/next and page numbers) based on totalPages, loading skeletons, empty state ("No products found. Try fewer filters or a different spelling."), and error state with Retry. A typo such as "bluetoth" must show Bluetooth products (the backend/mock does the fuzzy matching; the UI must not filter again).
- Never show the filters' counts as stale: always use facets from the latest response.
````

### Phase F3: Product page

````text
Phase F3. Build /product/[id].
- Validate the id is a positive integer, otherwise show a Not Found state.
- Load with getProduct. Show large image (placeholder fallback), name, sku, category, city, description, price, and availability: "In stock" with the count when availableCount <= 5 ("Only N left!"), or a clear "Out of stock" badge.
- Quantity selector (1 to min(10, availableCount)) and "Add to cart" (disabled when out of stock). After adding show a toast "Added to cart" with a "View cart" link.
- 404 (ApiError code NOT_FOUND) -> friendly not-found page. Other errors -> error state with Retry.
- Re-fetch the product when the window regains focus so availability stays fresh.
````

### Phase F4: Cart page

````text
Phase F4. Build /cart.
- List line items with image, name, unit price, quantity stepper (1-10, clamped to maxQuantity), line total, remove button. Show subtotal. "Continue shopping" and "Proceed to checkout" buttons. Empty-cart state.
- On page load, refresh each item's availability with getProduct and show a warning badge on any item that is now out of stock or has fewer units than the cart quantity (and clamp the quantity). Items that are out of stock block checkout until removed.
- Persist through the cart context only (no direct localStorage in components).
````

### Phase F5: Checkout

````text
Phase F5. Build /checkout (client page).
- If the cart is empty, redirect to /cart.
- Form: full name (1-100 chars), email (valid format, max 254). Validate on blur and on submit, with inline messages. Show an order summary (items, quantities, line totals, total). Display a clear note "Payment is simulated in this demo" and a "Place order" button.
- IDEMPOTENCY: generate idempotencyKey with generateId() ONCE when the page mounts and store it in sessionStorage under "checkout:idemKey". Reuse it for every retry of the same cart. Create a new key only after a successful order or when the cart contents change.
- Submit: disable the button and show a spinner while the request is in flight (prevents double submits). Call createOrder with { customerEmail, customerName, idempotencyKey, items } (items = productId and quantity only; the server decides prices).
- Success (201 or 200): clear the cart, clear the stored idempotency key, router.push("/orders/<orderId>").
- 409 OUT_OF_STOCK: show "Sorry, <product name> only has N left (or is sold out)", refresh the cart quantities from details.available (details.productId identifies the item), and keep the user on the page.
- 400 VALIDATION_ERROR: map details.fields to inline form errors when possible, otherwise show the message.
- NETWORK_ERROR (status 0): show "Can't reach the server. Check your connection and try again." and keep the same idempotency key.
- 429: show "Too many attempts. Please wait a few seconds."
- Any other error: show the message and a Retry button.
````

### Phase F6: Order status page

````text
Phase F6. Build /orders/[orderId].
- Validate that orderId looks like a UUID; otherwise show Not Found.
- Poll getOrder every 2 seconds until status is CONFIRMED (stop polling then), with a visual stepper: "Order placed" -> "Confirmed". While PLACED show a "Processing..." animation. After 60 seconds without confirmation, stop polling and show "Still processing. We'll email you once it's confirmed." with a manual "Refresh" button.
- Show order id, status badge, items with names/quantities/unit prices, total (formatINR), created time (local format), and a "Continue shopping" link.
- On CONFIRMED show a success message including the email address the confirmation was sent to.
- 404 -> not-found state. Network errors during polling must NOT reset the page; show a small "reconnecting..." note and keep trying.
````

### Phase F7: Polish

````text
Phase F7. Quality pass; do not change any API usage.
- Accessibility: labels on all inputs, alt text on images, focus rings, buttons have accessible names, keyboard-operable filters.
- Loading skeletons and error states on every data-driven page; a global error boundary page; a custom 404 page.
- Responsive check at 360px, 768px and 1280px widths.
- Meta titles per page (home, search, product name, cart, checkout, order).
- Remove console.log noise; keep the contractVersion console.warn.
- Write storefront/README.md: how to install (npm install), the two env variables and what they do, how to switch mock/live, how to run, how to run the sync:contract script, and a section "Pointing at the backend on another device".
- Run npm run build and fix every TypeScript or ESLint error so the production build passes.
````

**Done when:** the entire shopping journey works in MOCK mode and `npm run build` passes. Commit and push the `frontend` branch. **You are ready for SYNC POINT 2.**

---

## PART 4: SYNC POINT 1: Connection test (do this right after B0 and F0)

This proves the two computers can talk **before** you build anything else on top.

### 4.1 Choose how Device B reaches Device A

| Option | Best for | Effort |
|---|---|---|
| **A. Same Wi-Fi/LAN** (recommended) | Both devices in the same room/home | Easiest |
| **B. Tunnel** (Cloudflare Tunnel or ngrok) | Different networks | Medium |
| **C. Deploy the backend** (Render, Railway, VM) | Final demo, always on | Most work |

### 4.2 Option A: Same network (step by step)

**On Device A (backend):**

1. Find the local IP address of Device A:
   - Windows: `ipconfig` → "IPv4 Address" (e.g. `192.168.1.25`)
   - macOS: `ipconfig getifaddr en0` (Wi-Fi)
   - Linux: `ip a` or `hostname -I`
2. Get Device B's IP the same way (e.g. `192.168.1.30`; used only if you ever open the storefront from a different machine than where it runs).
3. Edit `backend/.env`:
   ```
   API_HOST=0.0.0.0
   API_PORT=4000
   CORS_ORIGINS=http://localhost:3000,http://192.168.1.30:3000
   ```
   (`http://localhost:3000` is the frontend running on Device B itself. The `192.168.1.30` entry is for opening the site by IP; include both.)
4. Allow the port through the firewall:
   - Windows (run as Administrator): `netsh advfirewall firewall add rule name="InventoryHub API" dir=in action=allow protocol=TCP localport=4000`
   - macOS: allow incoming connections for Node when prompted
   - Linux (ufw): `sudo ufw allow 4000/tcp`
5. Start the API: `npm run api`. It must show it is listening on `0.0.0.0:4000`.
6. In Aiven, your allow-list needs **Device A's public IP** (not Device B's). Device B never talks to Aiven.

**On Device B (frontend):**

1. In a browser open `http://192.168.1.25:4000/api/health` (use Device A's IP). You should see JSON with `"status":"ok"`.
   - If it hangs or refuses: see the troubleshooting table (Part 7).
2. Edit `storefront/.env.local`:
   ```
   NEXT_PUBLIC_API_BASE_URL=http://192.168.1.25:4000
   NEXT_PUBLIC_USE_MOCK=true
   ```
   (Keep mock `true` for now.)
3. **Restart** `npm run dev`. (Next.js reads `NEXT_PUBLIC_*` values at start-up; changing `.env.local` without restarting does nothing.)
4. Quick CORS test: open the browser console on `http://localhost:3000` and run:
   ```js
   fetch('http://192.168.1.25:4000/api/health').then(r => r.json()).then(console.log)
   ```
   You should see the health object with no red CORS error. If you see a CORS error, the `CORS_ORIGINS` value on Device A does not exactly match the origin shown in Device B's browser address bar (scheme + host + port, no trailing slash).

**Make Device A's IP stable:** home routers often change IPs. Reserve a fixed IP for Device A in your router's DHCP settings, or recheck the IP every day you work.

### 4.3 Option B: Tunnel (different networks)

On Device A, with the API running on port 4000:

- **Cloudflare quick tunnel** (no account): `cloudflared tunnel --url http://localhost:4000` → prints `https://<random>.trycloudflare.com`
- **ngrok** (free account): `ngrok http 4000` → prints `https://<random>.ngrok-free.app`

Then:
- Device A: add the frontend origin to `CORS_ORIGINS` (still `http://localhost:3000` if the frontend runs on Device B's localhost).
- Device B: `NEXT_PUBLIC_API_BASE_URL=https://<random>.trycloudflare.com` (no trailing slash, no `/api`), restart `npm run dev`.
- The tunnel URL **changes every time** you restart the tunnel; update Device B's `.env.local` each time.
- The API layer already sends `ngrok-skip-browser-warning: true`, and the backend CORS allows that header, so ngrok's warning page won't break API calls.

### 4.4 Option C: Deploy the backend

Deploy `backend/` (API + 4 workers as separate processes) to a host such as Render or Railway, put the secrets and certificate contents in the host's environment, add the host's outbound IP to the Aiven allow-list, and set Device B's `NEXT_PUBLIC_API_BASE_URL` to the deployed HTTPS URL. If the **frontend** is later deployed over HTTPS (for example Vercel), the backend **must** also be HTTPS, otherwise browsers block the calls ("mixed content").

### 4.5 Sync Point 1 checklist

- [ ] Device B's browser shows `/api/health` JSON from Device A
- [ ] The `fetch` from Device B's console works with no CORS error
- [ ] `contractVersion` is `1.0.0` on both sides
- [ ] Both devices run Node 24

Only continue when every box is ticked.

---

## PART 5: SYNC POINT 2: Switch the frontend to the real backend

**Device A:**
1. `git pull` is not needed (nothing changed on `main`). Make sure all 5 processes are running: `npm run dev:all`.
2. Run `npm run db:migrate && npm run db:seed && npm run kafka:topics && npm run os:index && npm run os:reindex` (only the first time or after a reset).
3. Run `npm run contract:check`. **Every line must be PASS.** If not, fix the backend, never the contract.
4. Send Device B the base URL (Option A/B/C).

**Device B:**
1. In `storefront/.env.local` set:
   ```
   NEXT_PUBLIC_API_BASE_URL=http://<device-A-ip>:4000
   NEXT_PUBLIC_USE_MOCK=false
   ```
2. Stop and restart `npm run dev`. Hard-refresh the browser (Ctrl/Cmd+Shift+R).
3. Run the Phase F8 prompt:

### Phase F8: Live integration

````text
Phase F8. The backend is now live. NEXT_PUBLIC_USE_MOCK=false.
1. Do NOT change any component. Only fix things inside src/lib/api.ts if the real backend differs from the contract, and report each difference to me instead of silently working around it.
2. Add a small development-only banner at the top of the site that shows "LIVE API: <API_BASE>" and a red "Backend unreachable" state when getHealth() fails.
3. Verify these flows against the live API and tell me the result of each:
   a. Home page loads 8 products.
   b. Search "bluetoth" returns Bluetooth products; each filter works; facet counts change; pagination works.
   c. Product page shows the right availability; the sold-out sample cannot be added.
   d. Full checkout creates an order; the status page goes PLACED -> CONFIRMED within a few seconds.
   e. Buying "Last Item Test Gadget" then searching for it: it must disappear within about 5 seconds (reload search to check).
   f. Trying to buy the sold-out/last item again shows the out-of-stock message correctly (409 handling).
   g. Double-clicking "Place order" creates only ONE order.
   h. The browser console shows no CORS errors and no contractVersion warning.
4. Run npm run build and make sure it still passes.
````

---

## PART 6: SYNC POINT 3: Merge everything

Both devices have pushed their branches. On **either** device (Device A is fine):

```bash
git fetch origin
git checkout main
git pull origin main
git merge origin/backend
git merge origin/frontend
git push origin main
```

Because `backend/` and `storefront/` are separate folders, **there should be no conflicts**. If Git reports a conflict, it will be in a root file someone edited (such as `README.md`). Keep both versions' content, save, then `git add . && git commit` and push.

On the other device:

```bash
git checkout main
git pull origin main
```

**Update the root `README.md`** (one person only) with:
- Project description and architecture diagram (from `ARCHITECTURE.md` Section 4)
- Folder structure
- "Run it on one machine" steps: Terminal 1 `cd backend && npm install && npm run dev:all`; Terminal 2 `cd storefront && npm install && npm run dev`; `.env` setup for both; `NEXT_PUBLIC_USE_MOCK=false`; `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`; and `CORS_ORIGINS=http://localhost:3000`
- Link to `contract/API_CONTRACT.md`

### Final acceptance tests (run on the merged `main`)

| # | Test | Expected |
|---|---|---|
| 1 | `npm run contract:check` (backend) | All PASS |
| 2 | `npm run test:concurrency` (backend) | Exactly 1 order succeeds, 19 get 409; stock ends at 0 |
| 3 | Search `bluetoth`, `wireles earbuds`, `headfones` | Correct products appear |
| 4 | Filter by category + city + price range | Results and facet counts update |
| 5 | Add to cart → checkout → order page | PLACED → CONFIRMED in a few seconds |
| 6 | Notification worker log | Order confirmation email printed/sent |
| 7 | Buy the last unit of Last Item Test Gadget, then search | Item disappears within ~5 seconds |
| 8 | Two browsers/devices try to buy that last unit at the same moment | Exactly one succeeds |
| 9 | Stop the inventory worker, place 3 orders, restart it | All 3 become CONFIRMED, stock correct |
| 10 | Double-click "Place order" | One order only |
| 11 | `npm run build` in `storefront/` | Passes |
| 12 | Browser console | No CORS or contract warnings |

---

## PART 7: Troubleshooting two-device problems

| Symptom | Likely cause | Fix |
|---|---|---|
| Browser console: "blocked by CORS policy" | `CORS_ORIGINS` on Device A doesn't exactly equal the browser's origin (`http://localhost:3000` vs `http://127.0.0.1:3000` are different!) | Add the exact origin, restart the API |
| CORS error only on errors (400/404/500) | Error handler runs without CORS headers | Fix backend error handler (contract Section 5) |
| `ERR_CONNECTION_REFUSED` | API not running, wrong IP/port, or listening only on localhost | Check `API_HOST=0.0.0.0`; verify with the Device A IP |
| `ERR_CONNECTION_TIMED_OUT` or hangs | Firewall, different Wi-Fi network, or router "client isolation" / guest network | Open port 4000, join the same non-guest network, or use a tunnel |
| Worked yesterday, fails today | Device A's IP changed | Re-run `ipconfig`/`ifconfig`; update `.env.local`; restart Next.js |
| `.env.local` change has no effect | Next.js reads env at start | Stop and rerun `npm run dev`; hard-refresh |
| 404 on every call | Base URL includes `/api` or has a trailing slash | `NEXT_PUBLIC_API_BASE_URL` must be the origin only |
| Frontend shows items that won't add to cart / wrong product IDs after switching | Old mock cart | Cart keys are namespaced; clear site data in the browser if needed |
| Mixed-content error | Frontend is on HTTPS, backend on HTTP | Put the backend behind HTTPS (tunnel/deploy) |
| ngrok HTML page returned instead of JSON | ngrok interstitial | API layer sends `ngrok-skip-browser-warning`; ensure backend CORS allows that header |
| `crypto.randomUUID is not a function` | Opened the site over `http://<ip>:3000` (not a secure context) | `generateId()` fallback in `src/lib/id.ts` |
| Contract warning in console | `contractVersion` mismatch | Both devices: merge `origin/main`, run `npm run sync:contract`, restart |
| TypeScript errors after the contract changed | Stale copy of types | Run `npm run sync:contract` in both projects |
| Search shows 0 results on live backend | Index empty | Device A: `npm run os:index && npm run os:reindex` |
| Item still searchable after sale | Indexer not running / lag | Start `npm run worker:index`; check consumer lag |
| Aiven connection timeout on Device A | Device A's public IP changed and is not on the Aiven allow-list | Add current public IP in the Aiven console |

---

## PART 8: Rules for changing the contract later (so you never break the merge)

1. Decide the change on paper first (example: add `rating` to `Product`).
2. On `main`, edit `contract/API_CONTRACT.md` and `contract/types.ts`, bump the version, commit **only** those files, and push.
3. Device A: `git fetch origin && git merge origin/main`, `npm run sync:contract`, update the backend, run `npm run contract:check` (update its schemas first), commit.
4. Device B: `git fetch origin && git merge origin/main`, `npm run sync:contract`, update `mockApi.ts` and the UI, commit.
5. Test with Sync Point 2 steps again.

If you skip step 2 and just change one side, you get exactly the kind of mismatch bugs this setup exists to prevent.

---

## Quick reference: commands per device

**Device A (backend, branch `backend`)**
```bash
cd backend
npm install
npm run sync:contract
npm run db:migrate && npm run db:seed
npm run kafka:topics
npm run os:index && npm run os:reindex
npm run dev:all
npm run contract:check
npm run test:concurrency
```

**Device B (frontend, branch `frontend`)**
```bash
cd storefront
npm install
npm run sync:contract
npm run dev        # http://localhost:3000
npm run build
```
