# Inventory Hub

Real-time inventory, search, and order pipeline with Aiven PostgreSQL, Kafka, OpenSearch, and Next.js Storefront.

## Architecture & Contract
- [Architecture Documentation](ARCHITECTURE.md)
- [API & Event Contract](contract/API_CONTRACT.md)
- [Two-Device Build Guide](PROJECT_PROMPTS.md)

## Repository Structure
- `backend/`: Node.js, TypeScript, Express (Port 4000), 4 asynchronous Kafka workers, PostgreSQL & OpenSearch pipelines (Device A)
- `storefront/`: Next.js 14 App Router, TypeScript, Tailwind CSS, TanStack React Query (Device B)
- `contract/`: Typed API Contract and models shared between both devices

## Quick Start (Running locally)
1. **Backend**:
   ```bash
   cd backend
   npm install
   npm run sync:contract
   npm run db:migrate && npm run db:seed
   npm run kafka:topics
   npm run os:index && npm run os:reindex
   npm run dev:all
   ```
2. **Storefront**:
   ```bash
   cd storefront
   npm install
   npm run sync:contract
   npm run dev
   ```
   Open `http://localhost:3000`.
