# Frontend Changes Log

This document records all additions made to the `./frontend` repository to implement the requested **Under the Hood** panel. In accordance with the project rules, only new files and one small link were added; existing behavior, routes, styling, types, and checkout logic remain untouched.

---

### 1. Existing Files Modified

#### `frontend/app/layout.tsx`
- **Lines Added**:
  - Line 2: `import Link from 'next/link'` (Reason: Needed to link to `/under-the-hood`)
  - Line 11 (inside `<footer><div className="wrap">`): `<Link href="/under-the-hood" style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#64748b', textDecoration: 'none' }}>Under the Hood</Link>` (Reason: Requirement to add ONE small link to the Under the Hood panel in the header or footer)

---

### 2. New Files Created

1. **`frontend/lib/under-the-hood.ts`**
   - **Reason**: Implements the `getUnderTheHood()` function calling the backend `GET /api/under-the-hood` endpoint, with TypeScript types for health status, recent orders, Kafka events, consumer actions, and OpenSearch search telemetry. Includes mock fallback when `USE_MOCK=true`.

2. **`frontend/components/under-the-hood.tsx`**
   - **Reason**: Implements the Under the Hood UI component displaying:
     1. Live service health for Aiven PostgreSQL, Apache Kafka, and OpenSearch.
     2. Live OpenSearch execution proof (search query, fuzzy correction indicator, hits count, OpenSearch `took` time in ms).
     3. Latest 10 orders in PostgreSQL with status transitions (PLACED -> CONFIRMED), masked emails, and timestamps.
     4. Latest 20 events on the Apache Kafka backbone with topic, partition, offset, key, and timestamp.
     5. Asynchronous consumer actions (inventory deduction, customer notification dispatch, search index update).
     - Polls live every 2 seconds and cleanly unsubscribes on unmount.
     - Includes loading, error, and empty states.
     - Accessible and responsive layout.

3. **`frontend/app/under-the-hood/page.tsx`**
   - **Reason**: Implements the route `/under-the-hood` rendering `<UnderTheHood />`.

