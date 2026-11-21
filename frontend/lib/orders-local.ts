import type { OrderStatus } from '@/types/contract'

export type LocalOrder = {
  orderId: string
  placedAt: string
  total: number
  status: OrderStatus
  itemCount: number
  storeName: string
  city: string
  items?: { productId: number; quantity: number }[]
}

const STORAGE_KEY = 'my-orders:v1'

function isStoredOrderItem(item: unknown): item is { productId: number; quantity: number } {
  if (!item || typeof item !== 'object') return false
  const value = item as Record<string, unknown>
  return typeof value.productId === 'number' && Number.isInteger(value.productId) && value.productId > 0 &&
    typeof value.quantity === 'number' && Number.isInteger(value.quantity) && value.quantity > 0
}

function readOrders(): LocalOrder[] {
  if (typeof window === 'undefined') return []

  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((order): order is LocalOrder =>
      !!order &&
      typeof order.orderId === 'string' &&
      typeof order.placedAt === 'string' &&
      Number.isFinite(order.total) &&
      typeof order.status === 'string' &&
      Number.isInteger(order.itemCount) &&
      typeof order.storeName === 'string' &&
      typeof order.city === 'string' &&
      (order.items === undefined || (Array.isArray(order.items) && order.items.every(isStoredOrderItem)))
    )
  } catch {
    return []
  }
}

function writeOrders(orders: LocalOrder[]) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  } catch {
    // Browser storage can be disabled; the order itself is already placed.
  }
}

export function getOrders(): LocalOrder[] {
  return readOrders().sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt))
}

export function addOrder(order: LocalOrder): void {
  const orders = readOrders()
  if (orders.some(existing => existing.orderId === order.orderId)) return
  writeOrders([order, ...orders].sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt)))
}

export function updateStatus(id: string, status: OrderStatus): void {
  const orders = readOrders()
  const updated = orders.map(order => order.orderId === id ? { ...order, status } : order)
  if (updated.some((order, index) => order.status !== orders[index]?.status)) writeOrders(updated)
}
