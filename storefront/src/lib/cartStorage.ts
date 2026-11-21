import { USE_MOCK } from './config';

export interface CartStorageItem {
  productId: number;
  name: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  quantity: number;
  maxQuantity: number;
}

const STORAGE_KEY = 'cart:v1:' + (USE_MOCK ? 'mock' : 'live');

export function loadCart(): CartStorageItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read cart from localStorage', err);
    return [];
  }
}

export function saveCart(items: CartStorageItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to write cart to localStorage', err);
  }
}

export function clearCartStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear cart in localStorage', err);
  }
}
