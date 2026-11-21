// AUTO-COPIED, DO NOT EDIT.
/**
 * Contract Types for Inventory Hub
 * CONTRACT_VERSION: 1.0.0
 * This file is the single source of truth for both Device A (backend) and Device B (frontend).
 */

export const CONTRACT_VERSION = '1.0.0';

export const LIMITS = {
  SEARCH_Q_MAX_LENGTH: 100,
  SEARCH_PAGE_DEFAULT: 1,
  SEARCH_PAGE_SIZE_DEFAULT: 12,
  SEARCH_PAGE_SIZE_MAX: 50,
  ORDER_ITEMS_MAX: 10,
  ORDER_QUANTITY_MAX: 10,
  CUSTOMER_NAME_MAX: 100,
  CUSTOMER_EMAIL_MAX: 254,
} as const;

export const PRICE_RANGE_KEYS = [
  'under-500',
  '500-1500',
  '1500-5000',
  'above-5000',
] as const;

export type PriceRangeKey = typeof PRICE_RANGE_KEYS[number];

export interface PriceRangeBucket {
  key: PriceRangeKey;
  label: string;
  minPrice: number | null;
  maxPrice: number | null;
  count: number;
}

export type Category = 'Electronics' | 'Fashion' | 'Home' | 'Books' | 'Sports';
export type City = 'Bengaluru' | 'Mumbai' | 'Delhi' | 'Chennai' | 'Hyderabad';

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category: Category;
  city: City;
  priceCents: number; // Integer paise (e.g. 199900 = ₹1,999.00)
  currency: string;   // 'INR'
  imageUrl: string | null;
  availableCount: number;
  inStock: boolean;
}

export interface SearchFacets {
  categories: { value: Category; count: number }[];
  cities: { value: City; count: number }[];
  priceRanges: PriceRangeBucket[];
}

export interface SearchParams {
  q?: string;
  category?: Category[];
  city?: City[];
  minPrice?: number; // In paise
  maxPrice?: number; // In paise
  sort?: 'relevance' | 'price_asc' | 'price_desc';
  page?: number;
  pageSize?: number;
}

export interface SearchResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: SearchFacets;
}

export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'CANCELLED';

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  priceCents: number;
}

export interface Order {
  id: string; // UUID
  customerEmail: string;
  customerName: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  items: OrderItem[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreateOrderItemInput {
  productId: number;
  quantity: number;
}

export interface CreateOrderRequest {
  customerEmail: string;
  customerName: string;
  idempotencyKey: string;
  items: CreateOrderItemInput[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  services: {
    postgres: 'up' | 'down';
    kafka: 'up' | 'down';
    opensearch: 'up' | 'down';
  };
  contractVersion: string;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'OUT_OF_STOCK'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ContractError {
  error: {
    code: ErrorCode;
    message: string;
    details?: {
      fields?: Record<string, string>;
      productId?: number;
      available?: number;
      [key: string]: unknown;
    };
  };
}
