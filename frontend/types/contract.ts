// AUTO-COPIED FROM contract/types.ts. DO NOT EDIT.
export const CONTRACT_VERSION = '1.0.0';
export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'CANCELLED';
export type SortOption = 'relevance' | 'price_asc' | 'price_desc';
export type ServiceState = 'up' | 'down';
export type ErrorCode = 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'OUT_OF_STOCK' | 'RATE_LIMITED' | 'INTERNAL_ERROR';
export interface ApiErrorBody { error: { code: ErrorCode; message: string; details?: Record<string, unknown>; }; }
export interface HealthResponse { status: 'ok' | 'degraded'; contractVersion: string; time: string; services: { postgres: ServiceState; kafka: ServiceState; opensearch: ServiceState; }; }
export interface Product { productId: number; sku: string; name: string; description: string; category: string; city: string; priceCents: number; currency: string; imageUrl: string | null; inStock: boolean; availableCount: number; tags?: string[]; rating?: number; delivery_time_mins?: number; delivery_fee?: number; distance_km?: number; delivery_status?: string; stock?: number; expiry_date?: string | null; days_to_expiry?: number | null; expiry_status?: 'none' | 'fresh' | 'near_expiry' | 'expired'; badge?: string | null; }
export interface FacetBucket { value: string; count: number; }
export interface PriceRangeBucket { key: 'lt-500' | '500-2000' | '2000-10000' | 'gt-10000'; label: string; minPrice: number | null; maxPrice: number | null; count: number; }
export interface SearchFacets { categories: FacetBucket[]; cities: FacetBucket[]; priceRanges: PriceRangeBucket[]; ratings?: FacetBucket[]; delivery_buckets?: FacetBucket[]; price?: { min: number; max: number }; }
export interface SearchResponse { total: number; page: number; pageSize: number; totalPages: number; items: Product[]; facets: SearchFacets; }
export interface SearchParams { q?: string; category?: string[]; city?: string[]; minPrice?: number; maxPrice?: number; rating?: number; delivery?: string; sort?: SortOption; page?: number; pageSize?: number; }
export interface CreateOrderItem { productId: number; quantity: number; }
export interface CreateOrderRequest { customerEmail: string; customerName: string; idempotencyKey: string; items: CreateOrderItem[]; }
export interface OrderItem { productId: number; name: string; quantity: number; unitPriceCents: number; }
export interface Order { orderId: string; status: OrderStatus; customerEmail: string; totalCents: number; currency: string; createdAt: string; items: OrderItem[]; }
export const LIMITS = { searchQueryMaxLength: 100, pageSizeDefault: 20, pageSizeMax: 50, quantityMin: 1, quantityMax: 10, itemsPerOrderMax: 20, emailMaxLength: 254, nameMaxLength: 100, idempotencyKeyMin: 8, idempotencyKeyMax: 100 } as const;
export const PRICE_RANGE_KEYS = ['lt-500', '500-2000', '2000-10000', 'gt-10000'] as const;
