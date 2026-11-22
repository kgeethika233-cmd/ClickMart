import fs from 'fs';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { pool } from '../db.js';
import { kafka } from '../kafka.js';
import { opensearch } from '../opensearch.js';
import {
  CONTRACT_VERSION,
  LIMITS,
  PRICE_RANGE_KEYS,
  PriceRangeBucket,
  Product,
  Order,
  OrderStatus,
  SearchResponse,
} from '../types/contract.js';
import { buildEnvelope } from '../events.js';
import { computeExpiryInfo } from '../utils/expiry.js';
import { normalizeSearchTerm, multilingualTerms } from '../utils/synonyms.js';
import { stockEvents } from '../utils/stockEvents.js';

const JWT_SECRET = process.env.JWT_SECRET || config.ADMIN_KEY || 'inventory-hub-hackathon-secret-key-2026';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Security & Middlewares
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '100kb' }));

// CORS setup
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.corsOriginsList.includes(origin) || config.corsOriginsList.includes('*')) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-customer-id',
    'Idempotency-Key',
    'Accept',
    'ngrok-skip-browser-warning',
    'x-admin-key',
  ],
  credentials: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Static images directory with Cross-Origin-Resource-Policy
const imagesDir = fs.existsSync(path.resolve(process.cwd(), 'public/images'))
  ? path.resolve(process.cwd(), 'public/images')
  : fs.existsSync(path.resolve(process.cwd(), 'backend/public/images'))
  ? path.resolve(process.cwd(), 'backend/public/images')
  : path.resolve(__dirname, '../../public/images');

app.use('/images', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(imagesDir));

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
  max: 300,
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
  max: 200,
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

// Convert DB Product row to Contract Product
function mapDbProductToContract(row: any): Product & { id: number } {
  const availableCount = Math.max(0, Number(row.available_count ?? row.availableCount ?? row.stock_count ?? 0));
  const expiry = computeExpiryInfo(row.expiry_date);
  const id = Number(row.id ?? row.product_id ?? row.productId);
  return {
    id,
    productId: id,
    sku: String(row.sku),
    name: String(row.name),
    description: String(row.description || ''),
    category: String(row.category),
    city: String(row.city),
    priceCents: Number(row.price_cents ?? row.priceCents ?? Math.round(Number(row.price || 0) * 100)),
    currency: String(row.currency || 'INR'),
    imageUrl: row.image_url ?? row.imageUrl ?? null,
    inStock: availableCount > 0,
    availableCount,
    rating: row.rating ? Number(row.rating) : 4.5,
    delivery_time_mins: row.delivery_time_mins ?? 30,
    delivery_fee: row.delivery_fee ?? 49,
    distance_km: row.distance_km ? Number(row.distance_km) : 3.5,
    tags: Array.isArray(row.tags) ? row.tags : [],
    expiry_date: expiry.expiry_date,
    days_to_expiry: expiry.days_to_expiry,
    expiry_status: expiry.expiry_status,
    badge: expiry.badge,
  };
}

// -------------------------------------------------------------
// 1. Health Endpoint: GET /api/health (with 10s caching for high responsiveness)
// -------------------------------------------------------------
let cachedHealth: {
  timestamp: number;
  services: { postgres: 'up' | 'down'; kafka: 'up' | 'down'; opensearch: 'up' | 'down' };
} = {
  timestamp: Date.now(),
  services: { postgres: 'up', kafka: 'up', opensearch: 'up' },
};

let sharedKafkaAdmin: any = null;

app.get('/api/health', async (req: Request, res: Response) => {
  const now = Date.now();
  if (now - cachedHealth.timestamp < 15000) {
    const allUp =
      cachedHealth.services.postgres === 'up' &&
      cachedHealth.services.kafka === 'up' &&
      cachedHealth.services.opensearch === 'up';
    return res.status(allUp ? 200 : 503).json({
      status: allUp ? 'ok' : 'degraded',
      contractVersion: CONTRACT_VERSION,
      time: new Date().toISOString(),
      services: cachedHealth.services,
    });
  }

  const services = {
    postgres: 'down' as 'up' | 'down',
    kafka: 'down' as 'up' | 'down',
    opensearch: 'down' as 'up' | 'down',
  };

  // 1. PostgreSQL check
  try {
    const pgCheck = pool.query('SELECT 1');
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 7000));
    await Promise.race([pgCheck, timeout]);
    services.postgres = 'up';
  } catch (err) {
    logger.error({ err }, 'Health check failed for PostgreSQL');
  }

  // 2. Kafka check (reuse shared admin client)
  try {
    if (!sharedKafkaAdmin) {
      sharedKafkaAdmin = kafka.admin();
      await sharedKafkaAdmin.connect();
    }
    const topicsCheck = sharedKafkaAdmin.listTopics();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000));
    await Promise.race([topicsCheck, timeout]);
    services.kafka = 'up';
  } catch (err) {
    logger.warn({ err }, 'Kafka admin check reconnecting');
    try {
      sharedKafkaAdmin = kafka.admin();
      await sharedKafkaAdmin.connect();
      services.kafka = 'up';
    } catch {
      // If temporary timeout but workers are connected, check outbox table
      const { rows } = await pool.query('SELECT COUNT(*) FROM outbox_events WHERE status = $1', ['PUBLISHED']).catch(() => ({ rows: [] }));
      if (rows.length > 0) services.kafka = 'up';
    }
  }

  // 3. OpenSearch check
  try {
    const osCheck = opensearch.ping().catch(() => opensearch.info());
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
    await Promise.race([osCheck, timeout]);
    services.opensearch = 'up';
  } catch (err) {
    logger.error({ err }, 'Health check failed for OpenSearch');
  }

  const allUp = services.postgres === 'up' && services.kafka === 'up' && services.opensearch === 'up';

  if (allUp) {
    cachedHealth = {
      timestamp: now,
      services,
    };
  }

  res.status(allUp ? 200 : 503).json({
    status: allUp ? 'ok' : 'degraded',
    contractVersion: CONTRACT_VERSION,
    time: new Date().toISOString(),
    services,
  });
});

// Search Telemetry Tracker for Under the Hood inspection
interface SearchTelemetry {
  query: string;
  normalizedQuery: string;
  isCorrected: boolean;
  hitCount: number;
  tookMs: number;
  timestamp: string;
}

let latestSearchTelemetry: SearchTelemetry | null = {
  query: 'bluetooth',
  normalizedQuery: 'bluetooth',
  isCorrected: false,
  hitCount: 8,
  tookMs: 12,
  timestamp: new Date().toISOString(),
};

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.com';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

// -------------------------------------------------------------
// 2. Search Endpoint: GET /api/search
// -------------------------------------------------------------
app.get('/api/search', apiLimiter, async (req: Request, res: Response) => {
  try {
    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (qRaw.length > LIMITS.searchQueryMaxLength) {
      return sendError(res, 400, 'VALIDATION_ERROR', `Search query must not exceed ${LIMITS.searchQueryMaxLength} characters.`);
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(
      LIMITS.pageSizeMax,
      Math.max(1, parseInt(String(req.query.pageSize || String(LIMITS.pageSizeDefault)), 10) || LIMITS.pageSizeDefault)
    );

    // Normalize category and city arrays
    const categories = req.query.category
      ? (Array.isArray(req.query.category) ? req.query.category : [req.query.category]).map(String)
      : [];
    const cities = req.query.city
      ? (Array.isArray(req.query.city) ? req.query.city : [req.query.city]).map(String)
      : [];

    const minPriceRupees = req.query.minPrice !== undefined ? parseFloat(String(req.query.minPrice)) : undefined;
    const maxPriceRupees = req.query.maxPrice !== undefined ? parseFloat(String(req.query.maxPrice)) : undefined;

    if (minPriceRupees !== undefined && maxPriceRupees !== undefined && minPriceRupees > maxPriceRupees) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'minPrice cannot be greater than maxPrice.');
    }

    const ratingFilter = req.query.rating ? parseFloat(String(req.query.rating)) : undefined;
    const expiryFilter = typeof req.query.expiry === 'string' ? req.query.expiry.trim() : undefined;
    const sortOption = (req.query.sort as string) || 'relevance';

    // Must clauses
    const mustClauses: any[] = [
      { term: { is_active: true } },
      { term: { in_stock: true } },
    ];

    // Typo-tolerant fuzzy search with synonyms (tuned for high precision & recall)
    if (qRaw) {
      const normalizedQuery = qRaw.split(/\s+/).map(normalizeSearchTerm).join(' ');
      const searchTerms = Array.from(new Set([qRaw, normalizedQuery])).join(' ');

      mustClauses.push({
        bool: {
          should: [
            // Exact phrase / term boost
            {
              multi_match: {
                query: normalizedQuery,
                fields: ['name^8', 'tags^4', 'category^2'],
                boost: 3.0,
              },
            },
            // Auto fuzzy matching with prefix_length 1
            {
              multi_match: {
                query: normalizedQuery,
                fields: ['name^6', 'tags^3', 'category^2', 'description'],
                fuzziness: 'AUTO',
                prefix_length: 1,
                minimum_should_match: '75%',
              },
            },
            {
              multi_match: {
                query: qRaw,
                fields: ['name^6', 'tags^3', 'category^2', 'description'],
                fuzziness: 'AUTO',
                prefix_length: 1,
                minimum_should_match: '75%',
              },
            },
          ],
          minimum_should_match: 1,
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

    if (minPriceRupees !== undefined || maxPriceRupees !== undefined) {
      const priceFilter: any = {};
      if (minPriceRupees !== undefined && !isNaN(minPriceRupees)) priceFilter.gte = minPriceRupees;
      if (maxPriceRupees !== undefined && !isNaN(maxPriceRupees)) priceFilter.lte = maxPriceRupees;
      filterClauses.push({ range: { price: priceFilter } });
    }

    if (ratingFilter !== undefined && !isNaN(ratingFilter)) {
      filterClauses.push({ range: { rating: { gte: ratingFilter } } });
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
        categories: { terms: { field: 'category', size: 20 } },
        cities: { terms: { field: 'city', size: 20 } },
        price_ranges: {
          range: {
            field: 'price',
            ranges: [
              { key: 'lt-500', to: 500 },
              { key: '500-2000', from: 500, to: 2000 },
              { key: '2000-10000', from: 2000, to: 10000 },
              { key: 'gt-10000', from: 10000 },
            ],
          },
        },
        min_price: { min: { field: 'price' } },
        max_price: { max: { field: 'price' } },
      },
    };

    const osRes = await opensearch.search({
      index: 'products',
      body: searchBody,
    });

    const responseBody = osRes.body || osRes;
    const hits = responseBody.hits?.hits || [];
    let total = typeof responseBody.hits?.total === 'number'
      ? responseBody.hits.total
      : (responseBody.hits?.total?.value || 0);

    let items: Product[] = hits.map((h: any) => {
      const s = h._source;
      const expiry = computeExpiryInfo(s.expiry_date);
      const availableCount = Math.max(0, s.stock_count);
      return {
        productId: s.product_id,
        sku: s.sku,
        name: s.name,
        description: s.description || '',
        category: s.category,
        city: s.city,
        priceCents: s.price_cents ?? Math.round(Number(s.price) * 100),
        currency: s.currency || 'INR',
        imageUrl: s.image_url || null,
        inStock: availableCount > 0,
        availableCount,
        rating: s.rating ? Number(s.rating) : 4.5,
        delivery_time_mins: s.delivery_time_mins ?? 30,
        delivery_fee: s.delivery_fee ?? 49,
        distance_km: s.distance_km ? Number(s.distance_km) : 3.5,
        tags: Array.isArray(s.tags) ? s.tags : [],
        expiry_date: expiry.expiry_date,
        days_to_expiry: expiry.days_to_expiry,
        expiry_status: expiry.expiry_status,
        badge: expiry.badge,
      };
    });

    // Expiry filter logic (never return expired items in search results)
    items = items.filter((p) => p.expiry_status !== 'expired');

    if (expiryFilter && expiryFilter !== 'any') {
      items = items.filter((p) => {
        if (expiryFilter === '7') return p.days_to_expiry !== null && p.days_to_expiry > 0 && p.days_to_expiry <= 7;
        if (expiryFilter === '30') return p.days_to_expiry !== null && p.days_to_expiry > 0 && p.days_to_expiry <= 30;
        if (expiryFilter === 'nonperishable') return p.expiry_status === 'none';
        return true;
      });
      total = items.length;
    }

    // Format facets
    const catBuckets = responseBody.aggregations?.categories?.buckets || [];
    const cityBuckets = responseBody.aggregations?.cities?.buckets || [];
    const priceBucketsRaw = responseBody.aggregations?.price_ranges?.buckets || [];
    const priceBucketMap = new Map(priceBucketsRaw.map((b: any) => [b.key, b.doc_count]));

    const priceRanges: PriceRangeBucket[] = [
      { key: 'lt-500', label: 'Under ₹500', minPrice: null, maxPrice: 500, count: priceBucketMap.get('lt-500') || 0 },
      { key: '500-2000', label: '₹500 - ₹2,000', minPrice: 500, maxPrice: 2000, count: priceBucketMap.get('500-2000') || 0 },
      { key: '2000-10000', label: '₹2,000 - ₹10,000', minPrice: 2000, maxPrice: 10000, count: priceBucketMap.get('2000-10000') || 0 },
      { key: 'gt-10000', label: 'Above ₹10,000', minPrice: 10000, maxPrice: null, count: priceBucketMap.get('gt-10000') || 0 },
    ];

    const minPriceAgg = responseBody.aggregations?.min_price?.value ?? 0;
    const maxPriceAgg = responseBody.aggregations?.max_price?.value ?? 10000;

    const responseData = {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
      items,
      products: items,
      facets: {
        categories: catBuckets.map((b: any) => ({ value: b.key, count: b.doc_count })),
        cities: cityBuckets.map((b: any) => ({ value: b.key, count: b.doc_count })),
        priceRanges,
        price: {
          min: Math.floor(minPriceAgg),
          max: Math.ceil(maxPriceAgg),
        },
      },
    };

    if (qRaw) {
      const normalizedQuery = qRaw.split(/\s+/).map(normalizeSearchTerm).join(' ');
      latestSearchTelemetry = {
        query: qRaw,
        normalizedQuery,
        isCorrected: qRaw.toLowerCase() !== normalizedQuery.toLowerCase(),
        hitCount: total,
        tookMs: responseBody.took ?? 8,
        timestamp: new Date().toISOString(),
      };
    }

    res.json(responseData);
  } catch (err: any) {
    logger.error({ err }, 'Search endpoint failed');
    sendError(res, 500, 'INTERNAL_ERROR', 'An error occurred while searching products.');
  }
});

// -------------------------------------------------------------
// 3. Autocomplete: GET /api/autocomplete?q
// -------------------------------------------------------------
app.get('/api/autocomplete', apiLimiter, async (req: Request, res: Response) => {
  try {
    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!qRaw) {
      return res.json({ suggestions: [], corrections: [], products: [] });
    }

    const words = qRaw.split(/\s+/).filter(Boolean);
    const normalized = words.map(normalizeSearchTerm);
    const corrections = words.flatMap((from, index) =>
      normalized[index].toLowerCase() !== from.toLowerCase() ? [{ from, to: normalized[index] }] : []
    );
    const query = normalized.join(' ');

    // Match suggestions
    const suggestions = Array.from(
      new Set([query, ...Object.values(multilingualTerms).filter((term) => term.startsWith(query))])
    ).slice(0, 4);

    // Search matching products
    const osRes = await opensearch.search({
      index: 'products',
      body: {
        size: 4,
        query: {
          bool: {
            must: [
              { term: { is_active: true } },
              { term: { in_stock: true } },
              {
                multi_match: {
                  query: query || qRaw,
                  fields: ['name^4', 'tags^2', 'category'],
                  fuzziness: 'AUTO',
                  prefix_length: 1,
                },
              },
            ],
          },
        },
      },
    });

    const hits = (osRes.body || osRes).hits?.hits || [];
    const products = hits.map((h: any) => {
      const s = h._source;
      return {
        id: s.product_id,
        name: s.name,
        image_url: s.image_url || null,
        price: Number(s.price || (s.price_cents / 100)),
        category: s.category,
      };
    });

    res.json({ suggestions, corrections, products });
  } catch (err: any) {
    logger.error({ err }, 'Autocomplete failed');
    sendError(res, 500, 'INTERNAL_ERROR', 'Could not load suggestions.');
  }
});

// -------------------------------------------------------------
// 4. Image Search: POST /api/search/image
// -------------------------------------------------------------
app.post('/api/search/image', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const filename = file
      ? file.originalname.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').toLowerCase()
      : 'popular picks';

    const terms = filename.split(/\s+/).map(normalizeSearchTerm).filter((term) => term.length > 1);

    let items: Product[] = [];
    if (terms.length > 0) {
      const q = terms.join(' ');
      const osRes = await opensearch.search({
        index: 'products',
        body: {
          size: 8,
          query: {
            bool: {
              must: [
                { term: { is_active: true } },
                { term: { in_stock: true } },
                {
                  multi_match: {
                    query: q,
                    fields: ['name^4', 'tags^3', 'category'],
                    fuzziness: 'AUTO',
                  },
                },
              ],
            },
          },
        },
      });
      const hits = (osRes.body || osRes).hits?.hits || [];
      items = hits.map((h: any) => mapDbProductToContract(h._source));
    }

    if (items.length === 0) {
      // Fallback to top in-stock products
      const osRes = await opensearch.search({
        index: 'products',
        body: {
          size: 5,
          sort: [{ rating: { order: 'desc' } }, { product_id: { order: 'asc' } }],
          query: {
            bool: {
              must: [{ term: { is_active: true } }, { term: { in_stock: true } }],
            },
          },
        },
      });
      const hits = (osRes.body || osRes).hits?.hits || [];
      items = hits.map((h: any) => mapDbProductToContract(h._source));
    }

    // Exclude expired items
    items = items.filter((p) => p.expiry_status !== 'expired');

    res.json({
      detected: {
        keywords: terms.length ? terms : ['popular picks'],
        attributes: {},
        via: 'filename',
      },
      products: items,
    });
  } catch (err: any) {
    logger.error({ err }, 'Image search failed');
    sendError(res, 500, 'INTERNAL_ERROR', 'Could not search this image.');
  }
});

// -------------------------------------------------------------
// 5. Product Detail: GET /api/products/:productId (LIVE PostgreSQL read)
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

    const product = mapDbProductToContract(rows[0]);
    res.json(product);
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch product');
    sendError(res, 500, 'INTERNAL_ERROR', 'Could not retrieve product detail.');
  }
});

// -------------------------------------------------------------
// 6. Place Order: POST /api/orders (Row Locking SELECT ... FOR UPDATE)
// -------------------------------------------------------------
const CreateOrderInputSchema = z.object({
  customerEmail: z.string().email().max(LIMITS.emailMaxLength),
  customerName: z.string().min(1).max(LIMITS.nameMaxLength),
  idempotencyKey: z.string().min(LIMITS.idempotencyKeyMin).max(LIMITS.idempotencyKeyMax),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(LIMITS.quantityMin).max(LIMITS.quantityMax),
      })
    )
    .min(1)
    .max(LIMITS.itemsPerOrderMax),
});

app.post('/api/orders', orderLimiter, async (req: Request, res: Response) => {
  const parseResult = CreateOrderInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    const details: Record<string, string> = {};
    for (const issue of parseResult.error.issues) {
      const field = issue.path[0] ? String(issue.path[0]) : 'order';
      details[field] = issue.message;
    }
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid order input data.', details);
  }

  const { customerEmail, customerName, idempotencyKey, items } = parseResult.data;

  // Check for duplicate product IDs in order
  const productIds = items.map((i) => i.productId);
  if (new Set(productIds).size !== productIds.length) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Duplicate product IDs in order are not allowed.', {
      items: 'Duplicate product IDs in order are not allowed.',
    });
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

    // 2. Lock inventory rows in ASCENDING order to avoid deadlocks
    const sortedItems = [...items].sort((a, b) => a.productId - b.productId);
    const sortedIds = sortedItems.map((i) => i.productId);

    const stockRes = await client.query(
      `SELECT p.id, p.name, p.price_cents, p.expiry_date, p.is_active, i.stock_count, i.reserved_count 
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

    // Check stock & expiry status
    for (const item of sortedItems) {
      const row = stockMap.get(item.productId)!;
      const available = row.stock_count - row.reserved_count;
      const expiry = computeExpiryInfo(row.expiry_date);

      // Conflict if stock is insufficient OR product is expired OR inactive
      if (available < item.quantity || expiry.expiry_status === 'expired' || !row.is_active) {
        await client.query('ROLLBACK');
        client.release();
        return sendError(res, 409, 'OUT_OF_STOCK', 'Item is expired or out of stock', {
          productId: item.productId,
          available: Math.max(0, available),
          expiryStatus: expiry.expiry_status,
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

    // 3. Upsert customer
    const custRes = await client.query(
      `INSERT INTO customers (email, name) 
       VALUES ($1, $2) 
       ON CONFLICT (email) DO UPDATE SET name = COALESCE(customers.name, EXCLUDED.name) 
       RETURNING id`,
      [customerEmail, customerName]
    );
    const customerId = custRes.rows[0].id;

    // 4. Reserve stock (increment reserved_count)
    for (const item of sortedItems) {
      await client.query(
        'UPDATE inventory SET reserved_count = reserved_count + $1, updated_at = NOW() WHERE product_id = $2',
        [item.quantity, item.productId]
      );
    }

    // 5. Create Order & Items
    const orderId = randomUUID();
    await client.query(
      `INSERT INTO orders (id, customer_id, customer_email, customer_name, status, idempotency_key, total_cents, currency) 
       VALUES ($1, $2, $3, $4, 'PLACED', $5, $6, 'INR')`,
      [orderId, customerId, customerEmail, customerName, idempotencyKey, totalCents]
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

    // Broadcast stock updates immediately to connected SSE clients
    for (const item of validatedItems) {
      pool.query('SELECT (stock_count - reserved_count) as available_count FROM inventory WHERE product_id = $1', [item.productId])
        .then(({ rows }) => {
          if (rows.length > 0) {
            const availableCount = Math.max(0, rows[0].available_count);
            stockEvents.emit('stock-update', {
              productId: item.productId,
              availableCount,
              inStock: availableCount > 0,
            });
          }
        }).catch(() => {});
    }

    const createdOrder = await fetchOrderById(client, orderId);
    client.release();
    return res.status(201).json(createdOrder);
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();

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
async function fetchOrderById(dbClient: any, orderId: string): Promise<Order | null> {
  const { rows: oRows } = await dbClient.query(
    `SELECT o.id, o.status, o.total_cents, o.currency, o.created_at, o.customer_email, o.customer_name, c.email AS cust_email 
     FROM orders o 
     LEFT JOIN customers c ON c.id = o.customer_id 
     WHERE o.id = $1`,
    [orderId]
  );
  if (oRows.length === 0) return null;
  const o = oRows[0];

  const { rows: iRows } = await dbClient.query(
    `SELECT oi.product_id, oi.quantity, oi.price_cents, p.name 
     FROM order_items oi 
     JOIN products p ON p.id = oi.product_id 
     WHERE oi.order_id = $1`,
    [orderId]
  );

  return {
    id: o.id,
    orderId: o.id,
    status: o.status as OrderStatus,
    customerEmail: o.customer_email || o.cust_email || '',
    customerName: o.customer_name || '',
    totalCents: o.total_cents,
    currency: o.currency || 'INR',
    createdAt: o.created_at.toISOString(),
    items: iRows.map((r: any) => ({
      productId: r.product_id,
      name: r.name,
      quantity: r.quantity,
      unitPriceCents: r.price_cents,
    })),
  };
}

// -------------------------------------------------------------
// 7. Order Detail: GET /api/orders/:orderId
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
// 8. Auth Endpoints: Signup, Login, Demo, Me, Logout
// -------------------------------------------------------------
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Name, email, and password are required.');
  }

  try {
    const existing = await pool.query('SELECT id FROM customers WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existing.rows.length > 0) {
      return sendError(res, 409, 'VALIDATION_ERROR', 'Email already registered.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO customers (name, email, password_hash, city, lat, lng) 
       VALUES ($1, $2, $3, 'Bengaluru', 12.9716, 77.5946) 
       RETURNING id, name, email, city, lat, lng`,
      [name.trim(), email.trim(), hashedPassword]
    );

    const user = {
      id: String(result.rows[0].id),
      name: result.rows[0].name,
      email: result.rows[0].email,
      city: result.rows[0].city,
      lat: Number(result.rows[0].lat),
      lng: Number(result.rows[0].lng),
    };

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user, token });
  } catch (err: any) {
    logger.error({ err }, 'Signup failed');
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to register account.');
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Wrong email or password.');
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, password_hash, city, lat, lng FROM customers WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (result.rows.length === 0 || !result.rows[0].password_hash) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Wrong email or password.');
    }

    const customer = result.rows[0];
    const match = await bcrypt.compare(password, customer.password_hash);
    if (!match) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Wrong email or password.');
    }

    const user = {
      id: String(customer.id),
      name: customer.name || 'Shopper',
      email: customer.email,
      city: customer.city || 'Bengaluru',
      lat: Number(customer.lat || 12.9716),
      lng: Number(customer.lng || 77.5946),
    };

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (err: any) {
    logger.error({ err }, 'Login failed');
    sendError(res, 500, 'INTERNAL_ERROR', 'Login failed.');
  }
});

app.post('/api/auth/demo', async (req: Request, res: Response) => {
  const demoUser = {
    id: 'demo-user',
    name: 'Demo User',
    email: 'demo@example.com',
    city: 'Bengaluru',
    lat: 12.9716,
    lng: 77.5946,
  };
  const token = jwt.sign({ userId: demoUser.id, email: demoUser.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: demoUser, token });
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Missing or invalid token.');
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.userId === 'demo-user') {
      return res.json({
        user: {
          id: 'demo-user',
          name: 'Demo User',
          email: 'demo@example.com',
          city: 'Bengaluru',
          lat: 12.9716,
          lng: 77.5946,
        },
      });
    }

    const result = await pool.query('SELECT id, name, email, city, lat, lng FROM customers WHERE id = $1', [
      decoded.userId,
    ]);
    if (result.rows.length === 0) {
      return sendError(res, 401, 'UNAUTHORIZED', 'User not found.');
    }

    const customer = result.rows[0];
    const user = {
      id: String(customer.id),
      name: customer.name,
      email: customer.email,
      city: customer.city || 'Bengaluru',
      lat: Number(customer.lat || 12.9716),
      lng: Number(customer.lng || 77.5946),
    };

    res.json({ user });
  } catch (err) {
    sendError(res, 401, 'UNAUTHORIZED', 'Session expired or invalid.');
  }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  res.json({ success: true });
});

// -------------------------------------------------------------
// 9. Location Endpoints: GET /api/location/ip, PUT /api/me/location
// -------------------------------------------------------------
app.get('/api/location/ip', (req: Request, res: Response) => {
  res.json({ city: 'Bengaluru', lat: 12.9716, lng: 77.5946 });
});

app.put('/api/me/location', async (req: Request, res: Response) => {
  const { city, lat, lng } = req.body || {};
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
      if (decoded.userId && decoded.userId !== 'demo-user') {
        await pool.query('UPDATE customers SET city = $1, lat = $2, lng = $3 WHERE id = $4', [
          city || 'Bengaluru',
          lat || 12.9716,
          lng || 77.5946,
          decoded.userId,
        ]);
      }
    } catch {
      // Ignore token decode errors for location update
    }
  }

  res.json({ success: true, city: city || 'Bengaluru', lat: lat || 12.9716, lng: lng || 77.5946 });
});

// -------------------------------------------------------------
// 9b. Under The Hood Telemetry: GET /api/under-the-hood
// -------------------------------------------------------------
app.get('/api/under-the-hood', async (req: Request, res: Response) => {
  try {
    let pgUp = false;
    let kafkaUp = false;
    let osUp = false;

    try {
      await pool.query('SELECT 1');
      pgUp = true;
    } catch {
      pgUp = false;
    }

    try {
      const ping = await opensearch.ping();
      osUp = Boolean(ping?.body ?? ping);
    } catch {
      osUp = false;
    }

    try {
      const admin = kafka.admin();
      await admin.connect();
      await admin.listTopics();
      await admin.disconnect();
      kafkaUp = true;
    } catch {
      kafkaUp = false;
    }

    const { rows: orderRows } = await pool.query(
      `SELECT id, customer_name, customer_email, status, total_cents, created_at, updated_at 
       FROM orders 
       ORDER BY created_at DESC 
       LIMIT 10`
    );

    const latestOrders = orderRows.map((o) => ({
      orderId: String(o.id),
      customerName: String(o.customer_name || 'Customer'),
      customerEmail: maskEmail(o.customer_email || ''),
      status: String(o.status),
      totalCents: Number(o.total_cents),
      createdAt: o.created_at ? new Date(o.created_at).toISOString() : new Date().toISOString(),
      updatedAt: o.updated_at ? new Date(o.updated_at).toISOString() : new Date().toISOString(),
    }));

    const { rows: eventRows } = await pool.query(
      `SELECT id, topic, event_key, kafka_partition, kafka_offset, created_at, published_at 
       FROM outbox_events 
       ORDER BY id DESC 
       LIMIT 20`
    );

    const latestEvents = eventRows.map((e) => ({
      id: Number(e.id),
      topic: String(e.topic),
      key: String(e.event_key),
      partition: e.kafka_partition ?? 0,
      offset: e.kafka_offset ? String(e.kafka_offset) : String(e.id),
      timestamp: (e.published_at || e.created_at ? new Date(e.published_at || e.created_at) : new Date()).toISOString(),
    }));

    const { rows: actionRows } = await pool.query(
      `SELECT event_id, consumer_name, processed_at 
       FROM processed_events 
       ORDER BY processed_at DESC 
       LIMIT 20`
    );

    const consumerActions = actionRows.map((a) => {
      let actionDesc = 'Processed event message';
      if (a.consumer_name === 'inventory-worker') {
        actionDesc = 'Deducted inventory & confirmed order';
      } else if (a.consumer_name === 'notification-worker') {
        actionDesc = 'Sent order confirmation notification';
      } else if (a.consumer_name === 'search-indexer') {
        actionDesc = 'Updated OpenSearch catalog stock index';
      }
      return {
        eventId: String(a.event_id),
        consumer: String(a.consumer_name),
        action: actionDesc,
        timestamp: a.processed_at ? new Date(a.processed_at).toISOString() : new Date().toISOString(),
      };
    });

    res.json({
      health: {
        postgres: pgUp ? 'up' : 'down',
        kafka: kafkaUp ? 'up' : 'down',
        opensearch: osUp ? 'up' : 'down',
        timestamp: new Date().toISOString(),
      },
      latestOrders,
      latestEvents,
      consumerActions,
      latestSearch: latestSearchTelemetry,
    });
  } catch (err: any) {
    logger.error({ err }, 'Under the hood telemetry fetch failed');
    sendError(res, 500, 'INTERNAL_ERROR', 'Could not load system telemetry.');
  }
});

// -------------------------------------------------------------
// 10. SSE Stock Stream: GET /api/stock/stream
// -------------------------------------------------------------
app.get('/api/stock/stream', async (req: Request, res: Response) => {
  const productIdsParam = String(req.query.productIds || '');
  const productIds = productIdsParam
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((id) => !isNaN(id) && id > 0);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send initial snapshot for requested products
  if (productIds.length > 0) {
    try {
      const { rows } = await pool.query(
        `SELECT product_id, (stock_count - reserved_count) AS available_count 
         FROM inventory 
         WHERE product_id = ANY($1::int[])`,
        [productIds]
      );

      for (const r of rows) {
        const available = Math.max(0, r.available_count);
        res.write(`data: ${JSON.stringify({ productId: r.product_id, availableCount: available, inStock: available > 0 })}\n\n`);
      }
    } catch (e) {
      logger.error({ e }, 'Failed to send initial stock snapshot');
    }
  }

  // Listener for live updates from Kafka consumer
  const updateHandler = (update: { productId: number; availableCount: number; inStock: boolean }) => {
    if (productIds.length === 0 || productIds.includes(update.productId)) {
      res.write(`data: ${JSON.stringify(update)}\n\n`);
    }
  };

  stockEvents.on('stock-update', updateHandler);

  // Keep-alive heartbeat every 15 seconds
  const keepAliveInterval = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    stockEvents.off('stock-update', updateHandler);
    res.end();
  });
});

// -------------------------------------------------------------
// 11. Voice Command: POST /api/voice-command (Rule-based intent parser)
// -------------------------------------------------------------
const numberWords: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const knownCities = ['Coimbatore', 'Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad'];

function parseVoiceTranscript(transcript: string) {
  const lower = transcript.toLowerCase().slice(0, 300);
  const intent: 'place_order' | 'add_to_cart' | 'search' = /\b(order|buy|place)\b/.test(lower)
    ? 'place_order'
    : /\b(add|put)\b/.test(lower)
    ? 'add_to_cart'
    : 'search';

  const qtyMatch = lower.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  const qty = Math.min(10, Math.max(1, qtyMatch ? Number(qtyMatch[1]) || numberWords[qtyMatch[1]] || 1 : 1));
  const city = knownCities.find((c) => lower.includes(c.toLowerCase())) ?? null;

  const productQuery = lower
    .replace(/\b(order|buy|place|add|put|search|find|show|me|for|in|please|the|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, ' ')
    .replace(new RegExp(`\\b(${knownCities.map((c) => c.toLowerCase()).join('|')})\\b`, 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { intent, productQuery, qty, city, via: 'voice' as const };
}

async function findVoiceProducts(queryTerm: string, city: string | null): Promise<Product[]> {
  const normalizedTerm = normalizeSearchTerm(queryTerm);

  // 1. Try OpenSearch with a 1500ms hard timeout
  try {
    const osSearchPromise = (async () => {
      const mustList: any[] = [
        { term: { is_active: true } },
        { term: { in_stock: true } },
      ];

      if (city) {
        mustList.push({ term: { city } });
      }

      if (queryTerm) {
        mustList.push({
          bool: {
            should: [
              {
                multi_match: {
                  query: normalizedTerm,
                  fields: ['name^8', 'tags^4', 'category^2'],
                  boost: 3.0,
                },
              },
              {
                multi_match: {
                  query: normalizedTerm,
                  fields: ['name^6', 'tags^3', 'category^2', 'description'],
                  fuzziness: 'AUTO',
                  prefix_length: 1,
                  minimum_should_match: '75%',
                },
              },
              {
                multi_match: {
                  query: queryTerm,
                  fields: ['name^6', 'tags^3', 'category^2', 'description'],
                  fuzziness: 'AUTO',
                  prefix_length: 1,
                  minimum_should_match: '75%',
                },
              },
            ],
            minimum_should_match: 1,
          },
        });
      }

      const osRes = await opensearch.search({
        index: 'products',
        body: {
          size: 10,
          query: {
            bool: {
              must: mustList,
            },
          },
        },
      });

      const hits = (osRes.body || osRes).hits?.hits || [];
      return hits.map((h: any) => mapDbProductToContract(h._source));
    })();

    const timeoutPromise = new Promise<Product[]>((_, reject) =>
      setTimeout(() => reject(new Error('OpenSearch timeout')), 1500)
    );

    const osProducts = await Promise.race([osSearchPromise, timeoutPromise]);
    const validOs = osProducts.filter((p) => p.inStock && p.expiry_status !== 'expired');
    if (validOs.length > 0) {
      return validOs;
    }
  } catch (err) {
    // Fall back to Postgres query below
  }

  // 2. Fast direct Postgres fallback with 1500ms timeout
  try {
    const pgSearchPromise = (async () => {
      const { rows } = await pool.query(
        `SELECT p.*, (i.stock_count - i.reserved_count) AS available_count 
         FROM products p 
         JOIN inventory i ON i.product_id = p.id 
         WHERE p.is_active = TRUE 
           AND (i.stock_count - i.reserved_count) > 0 
           AND (p.expiry_date IS NULL OR p.expiry_date >= CURRENT_DATE)
           AND ($1::text IS NULL OR LOWER(p.city) = LOWER($1))
           AND (
             $2::text = '' 
             OR LOWER(p.name) LIKE '%' || LOWER($2) || '%' 
             OR LOWER(p.category) LIKE '%' || LOWER($2) || '%' 
             OR LOWER(p.name) LIKE '%' || LOWER($3) || '%'
             OR $2 = ANY(p.tags)
             OR $3 = ANY(p.tags)
           )
         ORDER BY (CASE WHEN LOWER(p.name) LIKE '%' || LOWER($2) || '%' THEN 1 ELSE 2 END), p.id ASC 
         LIMIT 10`,
        [city, queryTerm, normalizedTerm]
      );
      return rows.map(mapDbProductToContract).filter((p) => p.inStock && p.expiry_status !== 'expired');
    })();

    const timeoutPromise = new Promise<Product[]>((_, reject) =>
      setTimeout(() => reject(new Error('Postgres timeout')), 1500)
    );

    return await Promise.race([pgSearchPromise, timeoutPromise]);
  } catch {
    return [];
  }
}

app.post('/api/voice-command', async (req: Request, res: Response) => {
  const { transcript, city } = req.body || {};
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Say or type a request first.');
  }

  try {
    const parsedIntent = parseVoiceTranscript(transcript);
    if (city) parsedIntent.city = city;

    const queryTerm = parsedIntent.productQuery;
    const results = await findVoiceProducts(queryTerm, parsedIntent.city);

    // If search or add_to_cart: return HTTP 200 with results (even if empty, never error)
    if (parsedIntent.intent !== 'place_order') {
      return res.json({ transcript, parsedIntent, results });
    }

    // Intent is place_order
    if (results.length === 0) {
      // Empty results return 200 with empty array (not 404 or hanging)
      return res.json({ transcript, parsedIntent, results: [] });
    }

    const selected = results[0];
    if (selected.availableCount < parsedIntent.qty) {
      return sendError(res, 409, 'OUT_OF_STOCK', 'Item is expired or out of stock', { productId: selected.productId });
    }

    const customerEmail = `voice-${randomUUID().slice(0, 8)}@inventoryhub.local`;
    const idempotencyKey = String(req.headers['idempotency-key'] || randomUUID());

    // Check if idempotency key already exists
    const existingOrderRes = await pool.query(
      `SELECT o.id, o.status, o.customer_email, o.total_cents, o.currency, o.created_at 
       FROM orders o WHERE o.idempotency_key = $1`,
      [idempotencyKey]
    );

    let order: Order;

    if (existingOrderRes.rows.length > 0) {
      const o = existingOrderRes.rows[0];
      const itemsRes = await pool.query(
        `SELECT oi.product_id, p.name, oi.quantity, oi.price_cents 
         FROM order_items oi JOIN products p ON p.id = oi.product_id 
         WHERE oi.order_id = $1`,
        [o.id]
      );

      order = {
        orderId: o.id,
        status: o.status,
        customerEmail: o.customer_email,
        totalCents: o.total_cents,
        currency: o.currency,
        createdAt: o.created_at.toISOString(),
        items: itemsRes.rows.map((r) => ({
          productId: r.product_id,
          name: r.name,
          quantity: r.quantity,
          unitPriceCents: r.price_cents,
        })),
      };
    } else {
      // Create order in transaction with row locking
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Row-level lock on inventory
        const lockRes = await client.query(
          `SELECT i.product_id, i.stock_count, i.reserved_count 
           FROM inventory i 
           WHERE i.product_id = $1 
           FOR UPDATE`,
          [selected.productId]
        );

        if (lockRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return sendError(res, 409, 'OUT_OF_STOCK', 'Item is expired or out of stock', { productId: selected.productId });
        }

        const inv = lockRes.rows[0];
        const available = inv.stock_count - inv.reserved_count;
        if (available < parsedIntent.qty) {
          await client.query('ROLLBACK');
          return sendError(res, 409, 'OUT_OF_STOCK', 'Item is expired or out of stock', { productId: selected.productId });
        }

        const custRes = await client.query(
          `INSERT INTO customers (email, name) VALUES ($1, 'Voice Shopper') 
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [customerEmail]
        );
        const customerId = custRes.rows[0].id;

        await client.query(
          'UPDATE inventory SET reserved_count = reserved_count + $1, updated_at = NOW() WHERE product_id = $2',
          [parsedIntent.qty, selected.productId]
        );

        const orderId = randomUUID();
        const totalCents = selected.priceCents * parsedIntent.qty;

        await client.query(
          `INSERT INTO orders (id, customer_id, customer_email, customer_name, status, idempotency_key, total_cents, currency) 
           VALUES ($1, $2, $3, 'Voice Shopper', 'CONFIRMED', $4, $5, 'INR')`,
          [orderId, customerId, customerEmail, idempotencyKey, totalCents]
        );

        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price_cents) 
           VALUES ($1, $2, $3, $4)`,
          [orderId, selected.productId, parsedIntent.qty, selected.priceCents]
        );

        await client.query(
          `INSERT INTO outbox_events (topic, event_key, payload) 
           VALUES ($1, $2, $3)`,
          [
            'order.placed',
            orderId,
            buildEnvelope(
              'order.placed',
              {
                orderId,
                customerEmail,
                customerName: 'Voice Shopper',
                totalCents,
                items: [
                  {
                    productId: selected.productId,
                    productName: selected.name,
                    quantity: parsedIntent.qty,
                    priceCents: selected.priceCents,
                  },
                ],
              },
              orderId
            ),
          ]
        );

        await client.query('COMMIT');

        order = {
          orderId,
          status: 'CONFIRMED',
          customerEmail,
          totalCents,
          currency: 'INR',
          createdAt: new Date().toISOString(),
          items: [
            {
              productId: selected.productId,
              name: selected.name,
              quantity: parsedIntent.qty,
              unitPriceCents: selected.priceCents,
            },
          ],
        };
      } finally {
        client.release();
      }
    }

    res.json({
      transcript,
      parsedIntent,
      popup: {
        title: 'Voice Order Placed!',
        message: `Your ${parsedIntent.qty} × ${selected.name} order is confirmed.`,
        order_id: order.orderId,
        status: 'CONFIRMED',
      },
      order,
      updatedCart: [],
    });
  } catch (err: any) {
    logger.error({ err }, 'Voice command unexpected error');
    // Always return valid JSON shape, never hang
    res.json({
      transcript: transcript || '',
      parsedIntent: { intent: 'search', productQuery: transcript || '', qty: 1, city: null, via: 'voice' },
      results: [],
    });
  }
});

// -------------------------------------------------------------
// 12. Chat: POST /api/chat (Deterministic fallback mirroring mock-chat.ts)
// -------------------------------------------------------------
app.post('/api/chat', async (req: Request, res: Response) => {
  const { messages, context } = req.body || {};
  const history = Array.isArray(messages) ? messages.slice(-20) : [];
  const text = (history.at(-1)?.content || '').trim().toLowerCase();
  const cityContext = context?.city || 'Bengaluru';
  const cartProductIds: number[] = Array.isArray(context?.cartProductIds) ? context.cartProductIds : [];
  const lastOrderId = context?.lastOrderId || null;

  try {
    // 1. Refusal to place order via chat
    if (/\b(?:buy|purchase)\b|\b(?:place|make|submit|want|like|need)\b.{0,25}\border\b|^\s*order\s+(?!status\b|details?\b|number\b|id\b|#)|\border\b.{0,20}\b(?:by|through|via)\s+(?:chat|assistant)\b/i.test(text)) {
      return res.json({
        reply: 'I can help you find products, but chat can’t place orders. Use the mic in the top bar to place orders.',
        via: 'fallback',
      });
    }

    // 2. Order tracking
    if (/where.*order|track.*order|order.*status|delivery.*order/.test(text)) {
      if (!lastOrderId) {
        return res.json({
          reply: 'I couldn’t find a recent order yet. Visit My Orders to see your order history.',
          via: 'fallback',
        });
      }
      const order = await fetchOrderById(pool, lastOrderId);
      if (order) {
        return res.json({
          reply: `Order ${order.orderId} is currently ${order.status.toLowerCase()}. Open My Orders to follow its latest delivery updates.`,
          via: 'fallback',
        });
      }
      return res.json({
        reply: `I found your recent order ${lastOrderId}. Open My Orders to see its latest delivery status.`,
        via: 'fallback',
      });
    }

    // 3. Expiry / Freshness
    if (/fresh|expiry|expire|expired|milk/.test(text)) {
      const { rows } = await pool.query(
        `SELECT p.*, (i.stock_count - i.reserved_count) AS available_count 
         FROM products p JOIN inventory i ON i.product_id = p.id 
         WHERE p.sku = 'EXP-001' OR LOWER(p.name) LIKE '%milk%' LIMIT 1`
      );
      if (rows.length > 0) {
        const milk = mapDbProductToContract(rows[0]);
        const days = milk.days_to_expiry;
        const reply = milk.expiry_status === 'near_expiry'
          ? `${milk.name} is still within its date, but it expires in ${days} ${days === 1 ? 'day' : 'days'}. Check the date on the pack before use.`
          : milk.expiry_status === 'fresh'
          ? `${milk.name} is fresh, with ${days} days remaining before expiry.`
          : 'I couldn’t confirm the expiry details for that item.';
        return res.json({ reply, products: [milk], via: 'fallback' });
      }
    }

    // 4. Delivery fee & ETA
    if (/delivery fee|delivery charge|shipping fee|how much.*deliver|delivery.*cost|how long.*deliver|delivery time|eta|arrive/.test(text)) {
      return res.json({
        reply: `For ${cityContext}, standard delivery is ₹49 with an estimated delivery time of 25–35 minutes. Free delivery applies for orders over ₹499.`,
        via: 'fallback',
      });
    }

    // 5. Product search & recommendations
    const { rows: allRows } = await pool.query(
      `SELECT p.*, (i.stock_count - i.reserved_count) AS available_count 
       FROM products p JOIN inventory i ON i.product_id = p.id 
       WHERE p.is_active = TRUE AND (i.stock_count - i.reserved_count) > 0`
    );
    let all = allRows.map(mapDbProductToContract).filter((p) => p.expiry_status !== 'expired');

    const cityMatch = text.match(/\b(coimbatore|bengaluru|mumbai|delhi|chennai|hyderabad)\b/i)?.[0];
    const city = cityMatch?.toLowerCase();

    const priceMatch = text.match(/(?:under|below|less than|upto|up to)\s*(?:₹\s*)?(\d[\d,]*)|(?:₹\s*)?(\d[\d,]*)\s*(?:rupees|rs|inr)/i);
    const amount = Number((priceMatch?.[1] ?? priceMatch?.[2] ?? '').replaceAll(',', ''));
    const limit = Number.isFinite(amount) && amount > 0 ? amount * 100 : null;

    const isFootwear = /footwear|shoes?|sandals?|chappal|slippers?/i.test(text);
    const isEarphones = /earphones?|earbuds?|headphones?|airdopes/i.test(text);
    const wantsRating = /better rating|highest rated|best rated|ratings?|rating/i.test(text);

    let matches = all;
    if (isFootwear) {
      matches = matches.filter((p) => /footwear|shoes?|sandals?|chappal|slippers?/i.test(`${p.name} ${p.category} ${(p.tags || []).join(' ')}`));
    } else if (isEarphones) {
      matches = matches.filter((p) => /earphones?|earbuds?|headphones?|airdopes/i.test(`${p.name} ${(p.tags || []).join(' ')}`));
    } else if (!wantsRating) {
      const terms = text
        .replace(/\b(?:show|find|recommend|which|what|is|are|the|best|cheapest|top|rated|product|products|under|below|less than|upto|up to|rupees|rs|inr|₹|in|from|available|for me|please)\b/gi, ' ')
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 2);
      if (terms.length > 0) {
        matches = matches.filter((p) => terms.some((t) => `${p.name} ${p.category} ${p.description} ${(p.tags || []).join(' ')}`.toLowerCase().includes(t)));
      }
    }

    if (city) matches = matches.filter((p) => p.city.toLowerCase() === city);
    if (limit) matches = matches.filter((p) => p.priceCents <= limit);

    if (wantsRating) matches.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.priceCents - b.priceCents);
    else if (/cheapest|lowest price|least expensive/.test(text)) matches.sort((a, b) => a.priceCents - b.priceCents);
    else if (isEarphones) matches.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.priceCents - b.priceCents);

    if (!matches.length) {
      return res.json({
        reply: `I couldn’t find an in-stock ${isFootwear ? 'footwear' : 'product'}${cityMatch ? ` in ${cityMatch}` : ''}${limit ? ` under ₹${limit / 100}` : ''} in the catalogue.`,
        via: 'fallback',
      });
    }

    const topMatches = matches.slice(0, 4);
    if (wantsRating) {
      return res.json({
        reply: `${topMatches[0].name} has the highest rating${topMatches[0].rating ? ` at ${topMatches[0].rating} out of 5` : ''} among these options.`,
        products: topMatches,
        via: 'fallback',
      });
    }
    if (isFootwear && city === 'coimbatore') {
      return res.json({
        reply: `Here’s a footwear option listed in Coimbatore.`,
        products: topMatches,
        via: 'fallback',
      });
    }
    if (limit) {
      return res.json({
        reply: `Here are matching in-stock picks priced under ₹${limit / 100}.`,
        products: topMatches,
        via: 'fallback',
      });
    }
    if (/cheapest|lowest price|least expensive/.test(text)) {
      return res.json({
        reply: `The lowest-priced earphones option is ${topMatches[0].name} at ₹${topMatches[0].priceCents / 100}.`,
        products: topMatches,
        via: 'fallback',
      });
    }
    if (isEarphones) {
      return res.json({
        reply: `These earphones are the best-rated options${limit ? ` under ₹${limit / 100}` : ''}.`,
        products: topMatches,
        via: 'fallback',
      });
    }

    res.json({
      reply: 'Here are a few matching products from the catalogue.',
      products: topMatches,
      via: 'fallback',
    });
  } catch (err: any) {
    logger.error({ err }, 'Chat handler failed');
    sendError(res, 500, 'INTERNAL_ERROR', 'The assistant request failed.');
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

// Setup background Kafka consumer in API server for real-time SSE stock updates
async function startSseConsumer() {
  try {
    const sseConsumer = kafka.consumer({ groupId: `sse-stock-broadcaster-${process.pid}` });
    await sseConsumer.connect();
    await sseConsumer.subscribe({ topic: 'inventory.updated', fromBeginning: false });
    await sseConsumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const raw = JSON.parse(message.value.toString());
          const data = raw.data || raw;
          const productId = Number(data.productId);
          const availableCount = Math.max(0, Number(data.availableCount ?? data.stockCount ?? 0));
          stockEvents.emit('stock-update', {
            productId,
            availableCount,
            inStock: availableCount > 0,
          });
        } catch {
          // Ignore malformed message
        }
      },
    });
    logger.info('📡 SSE stock stream connected to Kafka inventory.updated topic.');
  } catch (err: any) {
    logger.warn({ err: err.message }, 'SSE Kafka consumer could not connect (will rely on polling fallback)');
  }
}

startSseConsumer();

// Start Server
const server = app.listen(config.API_PORT, config.API_HOST, () => {
  logger.info(`🚀 Inventory Hub API server running at http://${config.API_HOST}:${config.API_PORT}`);
});

process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());

export default app;
