import {
  CONTRACT_VERSION,
  CreateOrderRequest,
  ErrorCode,
  HealthResponse,
  Order,
  Product,
  SearchParams,
  SearchResponse,
} from '../types/contract';
import { API_BASE, USE_MOCK } from './config';
import {
  mockCreateOrder,
  mockGetHealth,
  mockGetOrder,
  mockGetProduct,
  mockSearchProducts,
} from './mockApi';

export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR';

export class ApiError extends Error {
  status: number;
  code: ClientErrorCode;
  details?: Record<string, unknown>;

  constructor(status: number, code: ClientErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let healthChecked = false;

async function checkContractVersionOnce(): Promise<void> {
  if (healthChecked || typeof window === 'undefined') return;
  healthChecked = true;
  try {
    const health = await getHealth();
    if (health.contractVersion !== CONTRACT_VERSION) {
      console.warn(
        `⚠️ Contract Version Mismatch: Backend reports ${health.contractVersion}, but Frontend expects ${CONTRACT_VERSION}`
      );
    }
  } catch (err) {
    // Silent check on boot
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T; status: number }> {
  checkContractVersionOnce();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const url = `${API_BASE}${endpoint}`;
  const headers = new Headers(options.headers || {});
  headers.set('ngrok-skip-browser-warning', 'true');

  if (options.method === 'POST') {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const isJson = res.headers.get('content-type')?.includes('application/json');
    let body: any;

    if (isJson) {
      try {
        body = await res.json();
      } catch (e) {
        throw new ApiError(res.status, 'INTERNAL_ERROR', 'Failed to parse JSON response from backend.');
      }
    } else {
      body = await res.text();
    }

    if (!res.ok) {
      const errShape = body?.error || {};
      throw new ApiError(
        res.status,
        errShape.code || (res.status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
        errShape.message || (typeof body === 'string' ? body : 'Server error'),
        errShape.details
      );
    }

    return { data: body as T, status: res.status };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    if (err.name === 'AbortError') {
      throw new ApiError(0, 'NETWORK_ERROR', 'Request timed out after 15 seconds.');
    }

    throw new ApiError(0, 'NETWORK_ERROR', err.message || 'Network connection failed.');
  }
}

export async function searchProducts(params: SearchParams): Promise<SearchResponse> {
  if (USE_MOCK) return mockSearchProducts(params);

  const qry = new URLSearchParams();
  if (params.q && params.q.trim()) qry.set('q', params.q.trim());
  if (params.page) qry.set('page', String(params.page));
  if (params.pageSize) qry.set('pageSize', String(params.pageSize));
  if (params.sort) qry.set('sort', params.sort);
  if (params.minPrice !== undefined) qry.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== undefined) qry.set('maxPrice', String(params.maxPrice));

  if (params.category) {
    for (const c of params.category) qry.append('category', c);
  }
  if (params.city) {
    for (const c of params.city) qry.append('city', c);
  }

  const queryStr = qry.toString() ? `?${qry.toString()}` : '';
  const { data } = await request<SearchResponse>(`/api/search${queryStr}`);
  return data;
}

export async function getProduct(productId: number): Promise<Product> {
  if (USE_MOCK) return mockGetProduct(productId);
  const { data } = await request<Product>(`/api/products/${productId}`);
  return data;
}

export async function createOrder(body: CreateOrderRequest): Promise<{ order: Order; created: boolean }> {
  if (USE_MOCK) return mockCreateOrder(body);
  const { data, status } = await request<Order>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { order: data, created: status === 201 };
}

export async function getOrder(orderId: string): Promise<Order> {
  if (USE_MOCK) return mockGetOrder(orderId);
  const { data } = await request<Order>(`/api/orders/${orderId}`);
  return data;
}

export async function getHealth(): Promise<HealthResponse> {
  if (USE_MOCK) return mockGetHealth();
  const { data } = await request<HealthResponse>('/api/health');
  return data;
}

