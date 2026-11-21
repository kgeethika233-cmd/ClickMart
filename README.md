# Inventory Hub — Retail E-Commerce Platform

> **Hackathon Solution for Retail Chains in India**  
> An event-driven, high-concurrency e-commerce order and inventory management platform that eliminates overselling during flash sales, powers typo-tolerant multilingual search, and maintains real-time stock synchronization across distributed cloud infrastructure.

---

## 🏆 1-Page Pitch Outline for the Judges

### 1. The Problem
During peak festive shopping and flash sales in India (e.g., Diwali, Big Billion Days), thousands of concurrent shoppers attempt to buy the last remaining inventory units. Traditional e-commerce architectures suffer from:
- **Overselling & Race Conditions**: Inconcurrent read-then-write stock checks lead to negative inventory and cancelled customer orders.
- **Stale Product Search**: Sold-out products remain visible in search, while search engines fail when users make typos or search in regional transliterated terms (e.g., "bluetoth", "speeker", "doodh", "chappal").
- **Tightly Coupled Architectures**: If notification or indexing services stall, the entire checkout pipeline freezes.

### 2. What We Built
We engineered **Inventory Hub** — a cloud-native, dual-tier platform:
- **Device B (Frontend)**: Next.js 16 (React 19, Tailwind CSS 4, TanStack Query) running on `http://localhost:3000` with instant autocomplete, faceted search, cart validation, live order tracking, voice assistant, and AI chat.
- **Device A (Backend)**: Node.js 24 + TypeScript Express service on `http://localhost:4000` backed by 4 asynchronous background workers (Transactional Outbox Publisher, Idempotent Inventory Worker, Notification Worker, Search Indexer).

### 3. How Each Aiven Service is Used
| Aiven Service | Architectural Role & Implementation |
| :--- | :--- |
| **Aiven PostgreSQL** | **Source of Truth (ACID)**: Authoritative catalog, customer accounts, orders, ledger audit trails, and the transactional outbox table. Prevents overselling using row-level locking (`SELECT ... FOR UPDATE OF i ORDER BY p.id ASC`). Stores dead letters in `dead_letter_events` table to stay within Aiven Free-Tier limits. |
| **Aiven Apache Kafka** | **Distributed Event Bus**: 4 core domain topics (`order.placed`, `inventory.updated`, `notification.requested`, `product.changed`) running with 1 partition. Decoupled consumers process orders, trigger customer emails, and broadcast live stock updates with strict idempotency guards (`processed_events`). |
| **Aiven OpenSearch** | **Real-Time Product Discovery**: OpenSearch index (`products_v1`, alias `products`) with typo-tolerant fuzzy matching (`fuzziness: 'AUTO'`), synonym expansion, multi-field boosting, and faceted aggregations. Automatically excludes sold-out products in real time. |

---

## 🚀 Quick Start Guide (Windows PowerShell)

### Prerequisites
- Node.js 20+ (Node 24 recommended)
- `pnpm` (installed globally: `npm install -g pnpm`)
- Git

---

### Step 1: Environment Setup
1. Copy the example environment file into `backend/.env`:
   ```powershell
   Copy-Item .env.example backend/.env
   ```
2. Open `backend/.env` and paste your Aiven credentials for PostgreSQL, Apache Kafka, and OpenSearch.
3. Verify `ca.pem` certificate is present at `backend/certs/ca.pem` (or repository root `ca.pem`).
4. Ensure `frontend/.env.local` contains:
   ```env
   NEXT_PUBLIC_USE_MOCK=false
   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
   ```

---

### Step 2: Database Migration & Seeding
From the repository root, run the setup commands:

```powershell
# 1. Apply database migrations
npm --prefix backend run db:migrate

# 2. Seed realistic catalog (47 products across 5 cities and categories, with expiry dates)
npm --prefix backend run db:seed

# 3. Create Kafka topics (<= 5 topics limit respected)
npm --prefix backend run kafka:topics

# 4. Create OpenSearch index and bulk index all products
npm --prefix backend run os:index
npm --prefix backend run os:reindex
```

---

### Step 3: Run the Application (One Command per Tier)

#### Terminal 1 — Backend (API + All 4 Background Workers):
```powershell
npm run dev:backend
```
*API runs on `http://localhost:4000`. Starts Express API, Outbox Publisher, Inventory Worker, Notification Worker, and Search Indexer concurrently.*

#### Terminal 2 — Frontend (Next.js Storefront):
```powershell
npm run dev:frontend
```
*Storefront UI runs on `http://localhost:3000`.*

---

## 🧪 Verification & Evidence Suite

Run the automated test scripts to generate proof for judges:

### 1. Contract Compliance Check (17 Endpoints)
Validates all endpoints, status codes, and JSON response shapes against the shared contract:
```powershell
npm run contract:check
```

### 2. High-Concurrency Proof (50 Simultaneous Requests on 1 Unit)
Simulates 50 concurrent buyers competing for the final item (`LAST-ITEM-TEST`):
```powershell
npm run test:concurrency
```
*Result: Exactly 1 order succeeds with `201 Created`; 49 orders receive `409 Conflict`. Stock ends at exactly 0, never negative.*

### 3. Kafka Idempotency Replay Test
Proves that replaying the identical Kafka event twice results in zero double-deductions:
```powershell
npm --prefix backend run test:kafka:idempotency
```

### 4. End-to-End Live Evidence for Judges
Executes a complete lifecycle demonstration across all three Aiven services:
```powershell
npm run demo:evidence
```

### 5. Automated Headless Browser Walkthrough
Runs an automated Puppeteer browser walkthrough covering homepage browsing, typo search ("bluetoth", "speeker"), product detail, cart addition, checkout, live order confirmation stepper, sold-out verification, demo login, and chat assistant:
```powershell
npm --prefix backend run test:walkthrough
```
*Generates timestamped screenshot evidence in `backend/screenshots/`.*

---

## 📂 Project Architecture

```
my-store/
├── backend/                  # Device A (Backend Service)
│   ├── certs/                # Aiven CA certificates (git-ignored)
│   ├── db/
│   │   ├── migrations/       # Incremental SQL migrations (001, 002)
│   │   └── seed.sql          # 47 realistic catalog products & demo user
│   ├── src/
│   │   ├── api/server.ts     # Express REST API & SSE stock stream
│   │   ├── workers/          # Outbox, Inventory, Notification, Indexer workers
│   │   ├── utils/            # Expiry calculator, synonyms, stock event emitter
│   │   └── scripts/          # Migration, seed, concurrency, and walkthrough scripts
│   ├── .env.example          # Safe placeholder config
│   └── package.json
├── frontend/                 # Device B (Next.js 16 Storefront - Final)
│   ├── app/                  # Next.js App Router pages (/search, /checkout, etc.)
│   ├── components/           # UI components, badges, facets, chat, voice
│   ├── public/               # Static assets & product images (IH-001.webp - IH-008.webp)
│   ├── types/contract.ts     # Source of truth API contract types
│   └── .env.local            # NEXT_PUBLIC_USE_MOCK=false
├── contract/                 # Shared API contract specifications
├── ARCHITECTURE.md           # System architecture, schemas, and sequence flows
└── README.md                 # Project documentation & pitch
```
