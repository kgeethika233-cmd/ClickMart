# Inventory Hub - Storefront (Device B)

Next.js 14 App Router e-commerce storefront for Inventory Hub.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Synchronize Contract Types
```bash
npm run sync:contract
```

### 3. Environment Configuration
Create `.env.local` based on `.env.example`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_USE_MOCK=false
```

- `NEXT_PUBLIC_USE_MOCK=true`: Run in offline Mock mode with zero backend dependencies.
- `NEXT_PUBLIC_USE_MOCK=false`: Connect to the live backend running on Device A.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
```

## Pointing at Device A Across Devices (LAN / Tunnel)
If the backend is running on Device A (e.g., IP `192.168.1.25` or Cloudflare tunnel):
1. In `storefront/.env.local`:
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://192.168.1.25:4000
   NEXT_PUBLIC_USE_MOCK=false
   ```
2. Restart `npm run dev`.
