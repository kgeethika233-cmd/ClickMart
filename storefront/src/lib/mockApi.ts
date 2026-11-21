import {
  Category,
  City,
  CONTRACT_VERSION,
  CreateOrderRequest,
  HealthResponse,
  Order,
  PriceRangeBucket,
  Product,
  SearchParams,
  SearchResponse,
} from '../types/contract';
import { generateId } from './id';

// Initial 40 Mock Products
let mockProducts: Product[] = [
  // Electronics
  { id: 1, sku: 'ELEC-SPK-001', name: 'Bluetooth Speaker', description: 'Portable waterproof high-bass wireless speaker', category: 'Electronics', city: 'Bengaluru', priceCents: 149900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/ELEC-SPK-001/400/300', availableCount: 15, inStock: true },
  { id: 2, sku: 'ELEC-HD-002', name: 'Bluetooth Headphones', description: 'Over-ear active noise cancelling Bluetooth headphones', category: 'Electronics', city: 'Mumbai', priceCents: 249900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/ELEC-HD-002/400/300', availableCount: 8, inStock: true },
  { id: 3, sku: 'ELEC-EAR-003', name: 'Wireless Earbuds', description: 'True wireless stereo earbuds with charging case', category: 'Electronics', city: 'Delhi', priceCents: 129900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/ELEC-EAR-003/400/300', availableCount: 20, inStock: true },
  { id: 4, sku: 'ELEC-GAM-004', name: 'Studio Monitor Headphones', description: 'Professional studio grade wired and Bluetooth headphones', category: 'Electronics', city: 'Chennai', priceCents: 349900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/ELEC-GAM-004/400/300', availableCount: 12, inStock: true },
  { id: 5, sku: 'ELEC-CBL-005', name: 'USB-C Fast Cable', description: 'Durable braided nylon 100W charging cable', category: 'Electronics', city: 'Hyderabad', priceCents: 29900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/ELEC-CBL-005/400/300', availableCount: 50, inStock: true },
  { id: 6, sku: 'ELEC-PWR-006', name: 'Power Bank 20000mAh', description: 'High capacity fast charging portable battery pack', category: 'Electronics', city: 'Bengaluru', priceCents: 189900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/ELEC-PWR-006/400/300', availableCount: 18, inStock: true },
  { id: 7, sku: 'ELEC-MOU-007', name: 'Ergonomic Wireless Mouse', description: 'Silent click Bluetooth & 2.4GHz rechargeable mouse', category: 'Electronics', city: 'Mumbai', priceCents: 89900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/ELEC-MOU-007/400/300', availableCount: 25, inStock: true },
  { id: 8, sku: 'LAST-ITEM-TEST', name: 'Last Item Test Gadget', description: 'Special test product configured with exactly 1 unit stock', category: 'Electronics', city: 'Bengaluru', priceCents: 99900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/LAST-ITEM-TEST/400/300', availableCount: 1, inStock: true },
  { id: 9, sku: 'SOLDOUT-001', name: 'Sold Out Sample', description: 'Sample catalog product that is completely sold out', category: 'Electronics', city: 'Delhi', priceCents: 199900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/SOLDOUT-001/400/300', availableCount: 0, inStock: false },

  // Fashion
  { id: 10, sku: 'FASH-TSH-001', name: 'Classic Cotton T-Shirt', description: 'Breathable organic crew-neck casual t-shirt', category: 'Fashion', city: 'Delhi', priceCents: 49900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/FASH-TSH-001/400/300', availableCount: 40, inStock: true },
  { id: 11, sku: 'FASH-JAC-002', name: 'Denim Slim Jacket', description: 'Vintage washed rugged denim streetwear jacket', category: 'Fashion', city: 'Mumbai', priceCents: 299900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/FASH-JAC-002/400/300', availableCount: 14, inStock: true },
  { id: 12, sku: 'FASH-HOO-003', name: 'Fleece Pullover Hoodie', description: 'Warm thermal heavyweight winter hoodie', category: 'Fashion', city: 'Bengaluru', priceCents: 179900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/FASH-HOO-003/400/300', availableCount: 22, inStock: true },
  { id: 13, sku: 'FASH-SNK-004', name: 'Canvas Low-Top Sneakers', description: 'Comfortable vulcanized sole everyday casual shoes', category: 'Fashion', city: 'Chennai', priceCents: 159900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/FASH-SNK-004/400/300', availableCount: 16, inStock: true },
  { id: 14, sku: 'FASH-SKS-005', name: 'Sports Cushion Socks 3-Pack', description: 'Moisture-wicking athletic ankle socks', category: 'Fashion', city: 'Hyderabad', priceCents: 34900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/FASH-SKS-005/400/300', availableCount: 60, inStock: true },
  { id: 15, sku: 'FASH-WCH-006', name: 'Minimalist Chronograph Watch', description: 'Stainless steel analog wrist watch with leather strap', category: 'Fashion', city: 'Bengaluru', priceCents: 549900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/FASH-WCH-006/400/300', availableCount: 7, inStock: true },

  // Home
  { id: 16, sku: 'HOME-LMP-001', name: 'LED Desk Lamp', description: 'Adjustable brightness eye-caring architect study lamp', category: 'Home', city: 'Bengaluru', priceCents: 119900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/HOME-LMP-001/400/300', availableCount: 20, inStock: true },
  { id: 17, sku: 'HOME-CUP-002', name: 'Ceramic Coffee Mug Set', description: 'Handcrafted artisan minimalist ceramic tea mugs', category: 'Home', city: 'Chennai', priceCents: 69900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/HOME-CUP-002/400/300', availableCount: 30, inStock: true },
  { id: 18, sku: 'HOME-BLN-003', name: 'Organic Cotton Bedlinen', description: 'King size 400 thread count soft bedsheet set', category: 'Home', city: 'Mumbai', priceCents: 249900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/HOME-BLN-003/400/300', availableCount: 15, inStock: true },
  { id: 19, sku: 'HOME-DIFF-004', name: 'Aroma Oil Diffuser', description: 'Ultrasonic quiet cool mist essential oil humidifier', category: 'Home', city: 'Delhi', priceCents: 149900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/HOME-DIFF-004/400/300', availableCount: 18, inStock: true },
  { id: 20, sku: 'HOME-PLT-005', name: 'Indoor Planter Ceramic Pot', description: 'Modern geometric drainage pot for succulents and herbs', category: 'Home', city: 'Hyderabad', priceCents: 39900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/HOME-PLT-005/400/300', availableCount: 35, inStock: true },
  { id: 21, sku: 'HOME-ROB-006', name: 'Smart Robot Vacuum Cleaner', description: 'Automatic laser mapping sweep and mop robot', category: 'Home', city: 'Bengaluru', priceCents: 1999900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/HOME-ROB-006/400/300', availableCount: 5, inStock: true },

  // Books
  { id: 22, sku: 'BOOK-SYS-001', name: 'Designing Data-Intensive Applications', description: 'The definitive guide to distributed systems architecture', category: 'Books', city: 'Bengaluru', priceCents: 169900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/BOOK-SYS-001/400/300', availableCount: 25, inStock: true },
  { id: 23, sku: 'BOOK-CLN-002', name: 'Clean Code Handbook', description: 'A handbook of agile software craftsmanship and style', category: 'Books', city: 'Delhi', priceCents: 79900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/BOOK-CLN-002/400/300', availableCount: 30, inStock: true },
  { id: 24, sku: 'BOOK-PRG-003', name: 'The Pragmatic Programmer', description: 'Your journey to software mastery, 20th anniversary edition', category: 'Books', city: 'Mumbai', priceCents: 189900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/BOOK-PRG-003/400/300', availableCount: 20, inStock: true },
  { id: 25, sku: 'BOOK-KAF-004', name: 'Kafka: The Definitive Guide', description: 'Real-time data and stream processing at scale', category: 'Books', city: 'Hyderabad', priceCents: 219900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/BOOK-KAF-004/400/300', availableCount: 15, inStock: true },
  { id: 26, sku: 'BOOK-NTB-005', name: 'Hardcover Dot Grid Journal', description: 'Thick 160gsm archival notebook for notes and sketches', category: 'Books', city: 'Chennai', priceCents: 44900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/BOOK-NTB-005/400/300', availableCount: 45, inStock: true },

  // Sports
  { id: 27, sku: 'SPRT-YOG-001', name: 'Eco TPE Yoga Mat', description: 'Non-slip extra thick alignment workout fitness mat', category: 'Sports', city: 'Chennai', priceCents: 129900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/SPRT-YOG-001/400/300', availableCount: 28, inStock: true },
  { id: 28, sku: 'SPRT-BTL-002', name: 'Stainless Steel Water Bottle', description: 'Double-wall vacuum insulated 1 litre flask', category: 'Sports', city: 'Mumbai', priceCents: 89900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/SPRT-BTL-002/400/300', availableCount: 40, inStock: true },
  { id: 29, sku: 'SPRT-DUM-003', name: 'Adjustable Dumbbell Pair', description: 'Space-saving quick change weights 2kg - 24kg', category: 'Sports', city: 'Bengaluru', priceCents: 899900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/SPRT-DUM-003/400/300', availableCount: 6, inStock: true },
  { id: 30, sku: 'SPRT-RST-004', name: 'Resistance Loop Bands Set', description: '5 exercise workout bands with door anchor and carry pouch', category: 'Sports', city: 'Hyderabad', priceCents: 49900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/SPRT-RST-004/400/300', availableCount: 50, inStock: true },
  { id: 31, sku: 'SPRT-CYC-005', name: 'Road Cycling Helmet', description: 'Aerodynamic lightweight safety helmet with visor', category: 'Sports', city: 'Delhi', priceCents: 279900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/SPRT-CYC-005/400/300', availableCount: 14, inStock: true },
  { id: 32, sku: 'SPRT-RKT-006', name: 'Carbon Fiber Badminton Racket', description: 'High tension lightweight professional competition racquet', category: 'Sports', city: 'Bengaluru', priceCents: 319900, currency: 'INR', imageUrl: 'https://picsum.photos/seed/SPRT-RKT-006/400/300', availableCount: 18, inStock: true },
];

const mockOrders = new Map<string, Order>();
const mockIdempotencyKeys = new Map<string, Order>();

function delay(ms = 300) {
  return new Promise((r) => setTimeout(r, ms));
}

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function fuzzyMatch(text: string, query: string): boolean {
  const words = text.toLowerCase().split(/\s+/);
  const qWords = query.toLowerCase().split(/\s+/);

  return qWords.every((q) => {
    return words.some((w) => {
      if (w.includes(q)) return true;
      const maxDistance = q.length >= 6 ? 2 : (q.length >= 3 ? 1 : 0);
      return levenshtein(w, q) <= maxDistance;
    });
  });
}

export async function mockSearchProducts(params: SearchParams): Promise<SearchResponse> {
  await delay(250);

  // Only return in_stock items
  let filtered = mockProducts.filter((p) => p.inStock && p.availableCount > 0);

  if (params.q) {
    const q = params.q.trim();
    filtered = filtered.filter((p) =>
      fuzzyMatch(`${p.name} ${p.description || ''} ${p.category}`, q)
    );
  }

  if (params.category && params.category.length > 0) {
    filtered = filtered.filter((p) => params.category!.includes(p.category));
  }

  if (params.city && params.city.length > 0) {
    filtered = filtered.filter((p) => params.city!.includes(p.city));
  }

  if (params.minPrice !== undefined) {
    filtered = filtered.filter((p) => p.priceCents >= params.minPrice!);
  }

  if (params.maxPrice !== undefined) {
    filtered = filtered.filter((p) => p.priceCents <= params.maxPrice!);
  }

  // Sorting
  if (params.sort === 'price_asc') {
    filtered.sort((a, b) => a.priceCents - b.priceCents);
  } else if (params.sort === 'price_desc') {
    filtered.sort((a, b) => b.priceCents - a.priceCents);
  }

  const page = params.page || 1;
  const pageSize = params.pageSize || 12;
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  // Facet counts based on all in-stock products
  const inStockAll = mockProducts.filter((p) => p.inStock && p.availableCount > 0);
  const categoryMap = new Map<Category, number>();
  const cityMap = new Map<City, number>();

  for (const p of inStockAll) {
    categoryMap.set(p.category, (categoryMap.get(p.category) || 0) + 1);
    cityMap.set(p.city, (cityMap.get(p.city) || 0) + 1);
  }

  const priceRanges: PriceRangeBucket[] = [
    { key: 'under-500', label: 'Under ₹500', minPrice: 0, maxPrice: 50000, count: inStockAll.filter((p) => p.priceCents < 50000).length },
    { key: '500-1500', label: '₹500 - ₹1,500', minPrice: 50000, maxPrice: 150000, count: inStockAll.filter((p) => p.priceCents >= 50000 && p.priceCents < 150000).length },
    { key: '1500-5000', label: '₹1,500 - ₹5,000', minPrice: 150000, maxPrice: 500000, count: inStockAll.filter((p) => p.priceCents >= 150000 && p.priceCents < 500000).length },
    { key: 'above-5000', label: 'Above ₹5,000', minPrice: 500000, maxPrice: null, count: inStockAll.filter((p) => p.priceCents >= 500000).length },
  ];

  return {
    products: paginated,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
    facets: {
      categories: Array.from(categoryMap.entries()).map(([value, count]) => ({ value, count })),
      cities: Array.from(cityMap.entries()).map(([value, count]) => ({ value, count })),
      priceRanges,
    },
  };
}

export async function mockGetProduct(productId: number): Promise<Product> {
  await delay(200);
  const p = mockProducts.find((item) => item.id === productId);
  if (!p) {
    const error: any = new Error('Product not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  return { ...p };
}

export async function mockCreateOrder(
  body: CreateOrderRequest
): Promise<{ order: Order; created: boolean }> {
  await delay(350);

  // Idempotency replay check
  if (mockIdempotencyKeys.has(body.idempotencyKey)) {
    return { order: mockIdempotencyKeys.get(body.idempotencyKey)!, created: false };
  }

  // Stock check
  let totalCents = 0;
  const orderItems: any[] = [];

  for (const item of body.items) {
    const prod = mockProducts.find((p) => p.id === item.productId);
    if (!prod) {
      const error: any = new Error('Product not found.');
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (prod.availableCount < item.quantity) {
      const error: any = new Error(`Out of stock for ${prod.name}`);
      error.status = 409;
      error.code = 'OUT_OF_STOCK';
      error.details = { productId: item.productId, available: prod.availableCount };
      throw error;
    }

    totalCents += prod.priceCents * item.quantity;
    orderItems.push({
      id: Math.floor(Math.random() * 10000),
      productId: prod.id,
      productName: prod.name,
      quantity: item.quantity,
      priceCents: prod.priceCents,
    });
  }

  // Reserve stock
  for (const item of body.items) {
    const prod = mockProducts.find((p) => p.id === item.productId)!;
    prod.availableCount -= item.quantity;
    if (prod.availableCount <= 0) {
      prod.inStock = false;
    }
  }

  const orderId = generateId();
  const order: Order = {
    id: orderId,
    customerEmail: body.customerEmail,
    customerName: body.customerName,
    status: 'PLACED',
    totalCents,
    currency: 'INR',
    items: orderItems,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockOrders.set(orderId, order);
  mockIdempotencyKeys.set(body.idempotencyKey, order);

  // Simulate background inventory worker confirming order after 3s
  setTimeout(() => {
    const existing = mockOrders.get(orderId);
    if (existing) {
      existing.status = 'CONFIRMED';
      existing.updatedAt = new Date().toISOString();
    }
  }, 3000);

  return { order, created: true };
}

export async function mockGetOrder(orderId: string): Promise<Order> {
  await delay(200);
  const order = mockOrders.get(orderId);
  if (!order) {
    const error: any = new Error('Order not found.');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }
  return { ...order };
}

export async function mockGetHealth(): Promise<HealthResponse> {
  await delay(150);
  return {
    status: 'ok',
    services: {
      postgres: 'up',
      kafka: 'up',
      opensearch: 'up',
    },
    contractVersion: CONTRACT_VERSION,
  };
}
