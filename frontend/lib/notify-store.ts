import type { Order, Product } from '@/types/contract'

type CartNotice = { type: 'cart'; id: string; product: Product; quantity: number; undo: () => void }
type WishlistNotice = { type: 'wishlist'; id: string; product: Product; saved: boolean; undo: () => void }
type OrderNotice = { type: 'order'; id: string; order: Order; storeName: string; title?: string; message?: string; onClose?: (open: boolean) => void }
export type AppNotice = CartNotice | WishlistNotice | OrderNotice

type Listener = (notice: AppNotice) => void
type NoticePayload<T = AppNotice> = T extends { id: string } ? Omit<T, 'id'> : never
const listeners = new Set<Listener>()
let sequence = 0

function publish(notice: NoticePayload) {
  const event = { ...notice, id: `notice-${Date.now()}-${++sequence}` } as AppNotice
  listeners.forEach(listener => listener(event))
}

export function subscribeToNotices(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function notifyCartAdded(product: Product, quantity: number, undo: () => void) {
  publish({ type: 'cart', product, quantity, undo })
}

export function notifyWishlistChanged(product: Product, saved: boolean, undo: () => void) {
  publish({ type: 'wishlist', product, saved, undo })
}

export function notifyOrderPlaced(order: Order, onClose?: (open: boolean) => void, copy?: { title?: string; message?: string }) {
  publish({ type: 'order', order, storeName: 'Inventory Hub', onClose, ...copy })
}
