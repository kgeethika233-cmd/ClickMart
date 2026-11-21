import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { pool } from '../db.js';
import { kafka } from '../kafka.js';
import { opensearch } from '../opensearch.js';
import { CONTRACT_VERSION, LIMITS, PRICE_RANGE_KEYS, PriceRangeBucket, Product } from '../types/contract.js';
import { buildEnvelope } from '../events.js';

const app = express();

// Security & Middlewares
app.use(helmet());
app.use(express.json({ limit: '100kb' }));

// CORS setup strictly per contract Section 5
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.corsOriginsList.includes(origin) || config.corsOriginsList.includes('*')) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'ngrok-skip-browser-warning'],
  credentials: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please slow down.',
      },
    });
  },
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Order rate limit exceeded. Please wait a minute before retrying.',
      },
    });
  },
});

// Central Error Helper
function sendError(res: Response, status: number, code: string, message: string, details?: any) {
  return res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}

// -------------------------------------------------------------
// 1. Health Endpoint: GET /api/health
// -------------------------------------------------------------
app.get('/api/health', async (req: Request, res: Response) => {
  const services = {
    postgres: 'down' as 'up' | 'down',
    kafka: 'down' as 'up' | 'down',
    opensearch: 'down' as 'up' | 'down',
  };

  // 1. PostgreSQL check with 3s timeout
  try {
    const pgCheck = pool.query('SELECT 1');
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
    await Promise.race([pgCheck, timeout]);
    services.postgres = 'up';
  } catch (err) {
    logger.error({ err }, 'Health check failed for PostgreSQL');
  }

  // 2. Kafka check with 3s timeout
  try {
    const admin = kafka.admin();
    await admin.connect();
    const topicsCheck = admin.listTopics();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
    await Promise.race([topicsCheck, timeout]);
    await admin.disconnect();
    services.kafka = 'up';
  } catch (err) {
    logger.error({ err }, 'Health check failed for Kafka');
  }

  // 3. OpenSearch check with 3s timeout
  try {
    const osCheck = opensearch.cluster.health();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
    await Promise.race([osCheck, timeout]);
    services.opensearch = 'up';
  } catch (err) {
    logger.error({ err }, 'Health check failed for OpenSearch');
  }

  const allUp = services.postgres === 'up' && services.kafka === 'up' && services.opensearch === 'up';

  res.status(allUp ? 200 : 503).json({
    status: allUp ? 'ok' : 'degraded',
    services,
    contractVersion: CONTRACT_VERSION,
  });
});

// -------------------------------------------------------------
// 2. Search Endpoint: GET /api/search
// -------------------------------------------------------------
app.get('/api/search', apiLimiter, async (req: Request, res: Response) => {
  try {
    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (qRaw.length > LIMITS.SEARCH_Q_MAX_LENGTH) {
      return sendError(res, 400, 'VALIDATION_ERROR', `Search query must not exceed ${LIMITS.SEARCH_Q_MAX_LENGTH} characters.`);
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(
      LIMITS.SEARCH_PAGE_SIZE_MAX,
      Math.max(1, parseInt(String(req.query.pageSize || String(LIMITS.SEARCH_PAGE_SIZE_DEFAULT)), 10) || LIMITS.SEARCH_PAGE_SIZE_DEFAULT)
    );

    // Normalize category and city arrays
    const categories = req.query.category
      ? (Array.isArray(req.query.category) ? req.query.category : [req.query.category]).map(String)
      : [];
    const cities = req.query.city
      ? (Array.isArray(req.query.city) ? req.query.city : [req.query.city]).map(String)
      : [];

    const minPricePaise = req.query.minPrice ? parseInt(String(req.query.minPrice), 10) : undefined;
    const maxPricePaise = req.query.maxPrice ? parseInt(String(req.query.maxPrice), 10) : undefined;

    if (minPricePaise !== undefined && maxPricePaise !== undefined && minPricePaise > maxPricePaise) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'minPrice cannot be greater than maxPrice.');
    }

    const sortOption = req.query.sort || 'relevance';

    // Build OpenSearch query
    const mustClauses: any[] = [
      { term: { is_active: true } },
      { term: { in_stock: true } },
    ];

    if (qRaw) {
      mustClauses.push({
        multi_match: {
          query: qRaw,
          fields: ['name^3', 'description', 'category'],
          fuzziness: 'AUTO',
          prefix_length: 1,
        },
      });
    }

    const filterClauses: any[] = [];
    if (categories.length > 0) {
      filterClauses.push({ terms: { category: categories } });
    }
    if (cities.length > 0) {
      filterClauses.push({ terms: { city: cities } });
    }

    if (minPricePaise !== undefined || maxPricePaise !== undefined) {
      const priceFilter: any = {};
      if (minPricePaise !== undefined) priceFilter.gte = minPricePaise / 100;
      if (maxPricePaise !== undefined) priceFilter.lte = maxPricePaise / 100;
      filterClauses.push({ range: { price: priceFilter } });
    }

    // Sort order
    let sortArray: any[] = [];
    if (sortOption === 'price_asc') {
      sortArray = [{ price: { order: 'asc' } }, { product_id: { order: 'asc' } }];
    } else if (sortOption === 'price_desc') {
      sortArray = [{ price: { order: 'desc' } }, { product_id: { order: 'asc' } }];
    } else {
      if (qRaw) {
        sortArray = [{ _score: { order: 'desc' } }, { product_id: { order: 'asc' } }];
      } else {
        sortArray = [{ product_id: { order: 'asc' } }];
      }
    }

    const searchBody = {
      from: (page - 1) * pageSize,
      size: pageSize,
      query: {
        bool: {
          must: mustClauses,
          filter: filterClauses,
        },
      },
      sort: sortArray,
      aggs: {
        categories: { terms: { field: 'category', size: 10 } },
        cities: { terms: { field: 'city', size: 10 } },
        price_ranges: {
          range: {
            field: 'price',
            ranges: [
              { key: 'under-500', to: 500 },
              { key: '500-1500', from: 500, to: 1500 },
              { key: '1500-5000', from: 1500, to: 5000 },
              { key: 'above-5000', from: 5000 },
            ],
          },
        },
      },
    };

    const osRes = await opensearch.search({
      index: 'products',
      body: searchBody,
    });

    const responseBody = osRes.body || osRes;
    const hits = responseBody.hits?.hits || [];
    const total = typeof responseBody.hits?.total === 'number'
      ? responseBody.hits.total
      : (responseBody.hits?.total?.value || 0);

    const products: Product[] = hits.map((h: any) => {
      const s = h._source;
      return {
        id: s.product_id,
        sku: s.sku,
        name: s.name,
        description: s.description || null,
        category: s.category,
        city: s.city,
        priceCents: Math.round(Number(s.price) * 100),
        currency: s.currency || 'INR',
        imageUrl: s.image_url || null,
        availableCount: s.stock_count,
        inStock: s.in_stock,
      };
    });

    // Format facets
    const catBuckets = responseBody.aggregations?.categories?.buckets || [];
    const cityBuckets = responseBody.aggregations?.cities?.buckets || [];
    const priceBucketsRaw = responseBody.aggregations?.price_ranges?.buckets || [];

    const priceBucketMap = new Map(priceBucketsRaw.map((b: any) => [b.key, b.doc_count]));

    const priceRanges: PriceRangeBucket[] = [
      { key: 'under-500', label: 'Under ₹500', minPrice: 0, maxPrice: 50000, count: priceBucketMap.get('under-500') || 0 },
      { key: '500-1500', label: '₹500 - ₹1,500', minPrice: 50000, maxPrice: 150000, count: priceBucketMap.get('500-1500') || 0 },
      { key: '1500-5000', label: '₹1,500 - ₹5,000', minPrice: 150000, maxPrice: 500000, count: priceBucketMap.get('1500-5000') || 0 },
      { key: 'above-5000', label: 'Above ₹5,000', minPrice: 500000, maxPrice: null, count: priceBucketMap.get('above-5000') || 0 },
    ];

    res.json({
      products,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
      facets: {
        categories: catBuckets.map((b: any) => ({ value: b.key, count: b.doc_count })),
        cities: cityBuckets.map((b: any) => ({ value: b.key, count: b.doc_count })),
        priceRanges,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Search endpoint failed');
    sendError(res, 500, 'INTERNAL_ERROR', 'An error occurred while searching products.');
  }
});

// -------------------------------------------------------------
// 3. Product Detail: GET /api/products/:productId
// -------------------------------------------------------------
app.get('/api/products/:productId', apiLimiter, async (req: Request, res: Response) => {
  const productId = parseInt(req.params.productId, 10);
  if (isNaN(productId) || productId <= 0) {
    return sendError(res, 404, 'NOT_FOUND', 'Product not found.');
  }

  try {
    const { rows } = await pool.query(
      `SELECT p.*, (i.stock_count - i.reserved_count) AS available_count 
       FROM products p 
       JOIN inventory i ON i.product_id = p.id 
       WHERE p.id = $1 AND p.is_active = TRUE`,
      [productId]
    );

    if (rows.length === 0) {
      return sendError(res, 404, 'NOT_FOUND', 'Product not found.');
    }

    const p = rows[0];
    const availableCount = Math.max(0, p.available_count);

    const product: Product = {
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description || null,
      category: p.category,
      city: p.city,
      priceCents: p.price_cents,
      currency: p.currency,
      imageUrl: p.image_url || null,
      availableCount,
      inStock: availableCount > 0,
    };

    res.json(product);
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch product');
    sendError(res, 500, 'INTERNAL_ERROR', 'Could not retrieve product detail.');
  }
});

// -------------------------------------------------------------
// 4. Place Order: POST /api/orders (Core Locking Engine)
// -------------------------------------------------------------
const CreateOrderInputSchema = z.object({
  customerEmail: z.string().email().max(LIMITS.CUSTOMER_EMAIL_MAX),
  customerName: z.string().min(1).max(LIMITS.CUSTOMER_NAME_MAX),
  idempotencyKey: z.string().min(1).max(255),
  items: z.array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().min(1).max(LIMITS.ORDER_QUANTITY_MAX),
    })
  ).min(1).max(LIMITS.ORDER_ITEMS_MAX),
});

app.post('/api/orders', orderLimiter, async (req: Request, res: Response) => {
  const parseResult = CreateOrderInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    const fields: Record<string, string> = {};
    for (const issue of parseResult.error.issues) {
      fields[issue.path.join('.')] = issue.message;
    }
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid order input data.', { fields });
  }

  const { customerEmail, customerName, idempotencyKey, items } = parseResult.data;

  // Check for duplicate product IDs in the single order
  const productIds = items.map((i) => i.productId);
  if (new Set(productIds).size !== productIds.length) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Duplicate product IDs in order are not allowed.');
  }

  const client = await pool.connect();
  try {
    // 1. Check existing order with same idempotencyKey (200 OK replay)
    const existing = await client.query('SELECT id FROM orders WHERE idempotency_key = $1', [idempotencyKey]);
    if (existing.rows.length > 0) {
      const order = await fetchOrderById(client, existing.rows[0].id);
      client.release();
      return res.status(200).json(order);
    }

    await client.query('BEGIN');

    // 2. Upsert customer
    const custRes = await client.query(
      `INSERT INTO customers (email, name) 
       VALUES ($1, $2) 
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name 
       RETURNING id`,
      [customerEmail, customerName]
    );
    const customerId = custRes.rows[0].id;

    // 3. Lock inventory rows in ASCENDING order to avoid deadlocks
    const sortedItems = [...items].sort((a, b) => a.productId - b.productId);
    const sortedIds = sortedItems.map((i) => i.productId);

    const stockRes = await client.query(
      `SELECT p.id, p.name, p.price_cents, i.stock_count, i.reserved_count 
       FROM products p 
       JOIN inventory i ON i.product_id = p.id 
       WHERE p.id = ANY($1::int[]) 
       ORDER BY p.id ASC 
       FOR UPDATE OF i`,
      [sortedIds]
    );

    if (stockRes.rows.length !== sortedIds.length) {
      await client.query('ROLLBACK');
      client.release();
      return sendError(res, 404, 'NOT_FOUND', 'One or more products in your order do not exist.');
    }

    const stockMap = new Map(stockRes.rows.map((r) => [r.id, r]));
    let totalCents = 0;
    const validatedItems: any[] = [];

    // Verify stock availability
    for (const item of sortedItems) {
      const row = stockMap.get(item.productId)!;
      const available = row.stock_count - row.reserved_count;

      if (available < item.quantity) {
        await client.query('ROLLBACK');
        client.release();
        return sendError(res, 409, 'OUT_OF_STOCK', `Insufficient inventory for product "${row.name}".`, {
          productId: item.productId,
          available: Math.max(0, available),
        });
      }

      totalCents += row.price_cents * item.quantity;
      validatedItems.push({
        productId: item.productId,
        productName: row.name,
        quantity: item.quantity,
        priceCents: row.price_cents,
      });
    }

    // 4. Reserve stock (increment reserved_count, don't decrement stock_count yet)
    for (const item of sortedItems) {
      await client.query(
        'UPDATE inventory SET reserved_count = reserved_count + $1, updated_at = NOW() WHERE product_id = $2',
        [item.quantity, item.productId]
      );
    }

    // 5. Create Order & Items
    const orderId = randomUUID();
    await client.query(
      `INSERT INTO orders (id, customer_id, status, idempotency_key, total_cents) 
       VALUES ($1, $2, 'PLACED', $3, $4)`,
      [orderId, customerId, idempotencyKey, totalCents]
    );

    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_cents) 
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.productId, item.quantity, item.priceCents]
      );

      await client.query(
        `INSERT INTO ledger_entries (product_id, order_id, entry_type, quantity) 
         VALUES ($1, $2, 'SALE', $3)`,
        [item.productId, orderId, item.quantity]
      );
    }

    // 6. Write outbox event for Kafka (order.placed)
    const orderPlacedPayload = buildEnvelope(
      'order.placed',
      {
        orderId,
        customerEmail,
        customerName,
        totalCents,
        items: validatedItems,
      },
      orderId
    );

    await client.query(
      `INSERT INTO outbox_events (topic, event_key, payload) 
       VALUES ($1, $2, $3)`,
      ['order.placed', orderId, orderPlacedPayload]
    );

    await client.query('COMMIT');

    const createdOrder = await fetchOrderById(client, orderId);
    client.release();
    return res.status(201).json(createdOrder);
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();

    // Handle race condition on unique idempotency_key (Postgres error 23505)
    if (err.code === '23505') {
      const existing = await pool.query('SELECT id FROM orders WHERE idempotency_key = $1', [idempotencyKey]);
      if (existing.rows.length > 0) {
        const order = await fetchOrderById(pool, existing.rows[0].id);
        return res.status(200).json(order);
      }
    }

    logger.error({ err }, 'Order placement transaction failed');
    return sendError(res, 500, 'INTERNAL_ERROR', 'Could not process order.');
  }
});

// Helper to fetch complete Order model
async function fetchOrderById(dbClient: any, orderId: string) {
  const { rows: oRows } = await dbClient.query(
    `SELECT o.id, o.status, o.total_cents, o.created_at, o.updated_at, c.email, c.name 
     FROM orders o 
     JOIN customers c ON c.id = o.customer_id 
     WHERE o.id = $1`,
    [orderId]
  );
  if (oRows.length === 0) return null;
  const o = oRows[0];

  const { rows: iRows } = await dbClient.query(
    `SELECT oi.id, oi.product_id, oi.quantity, oi.price_cents, p.name 
     FROM order_items oi 
     JOIN products p ON p.id = oi.product_id 
     WHERE oi.order_id = $1`,
    [orderId]
  );

  return {
    id: o.id,
    customerEmail: o.email,
    customerName: o.name,
    status: o.status,
    totalCents: o.total_cents,
    currency: 'INR',
    items: iRows.map((r: any) => ({
      id: r.id,
      productId: r.product_id,
      productName: r.name,
      quantity: r.quantity,
      priceCents: r.price_cents,
    })),
    createdAt: o.created_at.toISOString(),
    updatedAt: o.updated_at.toISOString(),
  };
}

// -------------------------------------------------------------
// 5. Order Detail: GET /api/orders/:orderId
// -------------------------------------------------------------
app.get('/api/orders/:orderId', apiLimiter, async (req: Request, res: Response) => {
  const orderId = req.params.orderId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
  if (!isUuid) {
    return sendError(res, 404, 'NOT_FOUND', 'Order not found.');
  }

  try {
    const order = await fetchOrderById(pool, orderId);
    if (!order) {
      return sendError(res, 404, 'NOT_FOUND', 'Order not found.');
    }
    res.json(order);
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch order');
    sendError(res, 500, 'INTERNAL_ERROR', 'Could not retrieve order details.');
  }
});

// -------------------------------------------------------------
// 6. Admin Upsert: POST /api/admin/products
// -------------------------------------------------------------
app.post('/api/admin/products', async (req: Request, res: Response) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== config.ADMIN_KEY) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Invalid or missing x-admin-key header.');
  }

  const { sku, name, description, category, city, priceCents, imageUrl, stockCount } = req.body;
  if (!sku || !name || !category || !city || typeof priceCents !== 'number') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Missing required product attributes.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pRes = await client.query(
      `INSERT INTO products (sku, name, description, category, city, price_cents, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT (sku) DO UPDATE SET 
         name = EXCLUDED.name, 
         description = EXCLUDED.description, 
         category = EXCLUDED.category, 
         city = EXCLUDED.city, 
         price_cents = EXCLUDED.price_cents, 
         image_url = EXCLUDED.image_url,
         updated_at = NOW() 
       RETURNING id`,
      [sku, name, description || null, category, city, priceCents, imageUrl || null]
    );
    const productId = pRes.rows[0].id;

    if (typeof stockCount === 'number') {
      await client.query(
        `INSERT INTO inventory (product_id, stock_count, reserved_count) 
         VALUES ($1, $2, 0) 
         ON CONFLICT (product_id) DO UPDATE SET stock_count = EXCLUDED.stock_count`,
        [productId, Math.max(0, stockCount)]
      );
    }

    // Write outbox event
    await client.query(
      `INSERT INTO outbox_events (topic, event_key, payload) 
       VALUES ($1, $2, $3)`,
      ['product.changed', String(productId), buildEnvelope('product.changed', { productId, action: 'UPSERT' }, `prod-${productId}`)]
    );

    await client.query('COMMIT');
    client.release();
    res.status(200).json({ success: true, productId });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to upsert product.');
  }
});

// Central 404 Handler
app.use((req: Request, res: Response) => {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found.`);
});

// Central Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err }, 'Unhandled Express Exception');
  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected internal error occurred.');
});

// Start Server
const server = app.listen(config.API_PORT, config.API_HOST, () => {
  logger.info(`🚀 Inventory Hub API server running at http://${config.API_HOST}:${config.API_PORT}`);
});

process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());

export default app;
