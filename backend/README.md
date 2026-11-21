# Inventory Hub - Backend Service (Device A)

High-concurrency order pipeline and inventory management service built with Node.js 24, TypeScript, Express, PostgreSQL, Apache Kafka, and OpenSearch.

## Environment Variables
Create `.env` using `.env.example`:
```
API_HOST=0.0.0.0
API_PORT=4000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
ADMIN_KEY=dev-secret-admin-key-123
PG_HOST=your-pg-host.aivencloud.com
PG_PORT=5432
PG_USER=avnadmin
PG_PASSWORD=your-pg-password
PG_DATABASE=defaultdb
PG_CA_PATH=./certs/ca.pem
KAFKA_BROKER=your-kafka-host.aivencloud.com:port
KAFKA_USER=avnadmin
KAFKA_PASSWORD=your-kafka-password
KAFKA_SASL_MECHANISM=plain
OS_HOST=your-opensearch-host.aivencloud.com
OS_PORT=port
OS_USER=avnadmin
OS_PASSWORD=your-opensearch-password
```

## Available Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `sync:contract` | `npm run sync:contract` | Copies `contract/types.ts` to `src/types/contract.ts` |
| `db:migrate` | `npm run db:migrate` | Applies SQL migrations in `db/migrations/` |
| `db:seed` | `npm run db:seed` | Seeds 30+ catalog products, inventory, and test customers |
| `kafka:topics` | `npm run kafka:topics` | Provisions all 7 Kafka topics |
| `os:index` | `npm run os:index` | Creates OpenSearch `products_v1` index and alias `products` |
| `os:reindex` | `npm run os:reindex` | Bulk loads all active products into OpenSearch |
| `api` | `npm run api` | Starts Express API on port 4000 |
| `worker:outbox` | `npm run worker:outbox` | Runs Outbox Kafka publisher |
| `worker:inventory` | `npm run worker:inventory` | Runs transactional inventory consumer |
| `worker:notify` | `npm run worker:notify` | Runs email notification consumer |
| `worker:index` | `npm run worker:index` | Runs OpenSearch dynamic search indexer |
| `dev:all` | `npm run dev:all` | Runs API server and all 4 workers concurrently with colored logs |
| `contract:check` | `npm run contract:check` | Runs automated verification of contract compliance |
| `test:concurrency` | `npm run test:concurrency` | Simulates 20 concurrent orders competing for 1 unit of stock |

