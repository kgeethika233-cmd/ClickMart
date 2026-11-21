import type { Product, Order } from '@/types/contract'
import { ApiError, emitMockStockUpdate } from './api'
import { searchProducts } from './mockApi'
import { decrementMockExpiryStock, mockExpiryProducts } from './mock-expiry'
import { withCurrentExpiry } from './expiry'
import { createOrder } from './mockApi'
import { generateId } from './id'

export type VoiceIntent = { intent: 'search' | 'add_to_cart' | 'place_order'; productQuery: string; qty: number; city: string | null; via: 'voice' }
export type VoiceResult = {
  transcript: string
  parsedIntent: VoiceIntent
  results?: Product[]
  popup?: { title: string; message: string; order_id: string; status: 'CONFIRMED' }
  order?: Order
  updatedCart?: []
}

const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
const cities = ['Coimbatore', 'Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad']

export function parseVoiceTranscript(transcript: string): VoiceIntent {
  const lower = transcript.toLowerCase().slice(0, 300)
  const intent = /\b(order|buy|place)\b/.test(lower) ? 'place_order' : /\b(add|put)\b/.test(lower) ? 'add_to_cart' : 'search'
  const qtyMatch = lower.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/)
  const qty = Math.min(10, Math.max(1, qtyMatch ? Number(qtyMatch[1]) || numberWords[qtyMatch[1]] || 1 : 1))
  const city = cities.find(value => lower.includes(value.toLowerCase())) ?? null
  const productQuery = lower
    .replace(/\b(order|buy|place|add|put|search|find|show|me|for|in|please|the|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, ' ')
    .replace(new RegExp(`\\b(${cities.map(cityName => cityName.toLowerCase()).join('|')})\\b`, 'g'), ' ')
    .replace(/\s+/g, ' ').trim()
  return { intent, productQuery, qty, city, via: 'voice' }
}

export async function mockVoiceCommand(transcript: string, city: string | null = null): Promise<VoiceResult> {
  const parsedIntent = parseVoiceTranscript(transcript)
  if (city) parsedIntent.city = city
  const base = await searchProducts({ q: parsedIntent.productQuery })
  const allProducts = [...base.items, ...mockExpiryProducts.map(withCurrentExpiry).filter(product => product.expiry_status !== 'expired' && product.inStock)]
  const distinct = Array.from(new Map(allProducts.map(product => [product.productId, product])).values())
  const tokens = parsedIntent.productQuery.toLowerCase().split(/\s+/).filter(Boolean)
  const results = distinct.filter(product => product.inStock && product.expiry_status !== 'expired' && (!parsedIntent.city || product.city.toLowerCase() === parsedIntent.city.toLowerCase()) && tokens.every(token => `${product.name} ${product.category}`.toLowerCase().includes(token)))
  if (!results.length) throw new ApiError(404, 'NOT_FOUND', `No available product found for ${parsedIntent.productQuery || 'that request'}`)
  if (parsedIntent.intent !== 'place_order') return { transcript, parsedIntent, results }
  const selected = results[0]
  if (selected.availableCount < parsedIntent.qty) throw new ApiError(409, 'OUT_OF_STOCK', 'Item is expired or out of stock', { productId: selected.productId })
  const customerEmail = `voice-${generateId()}@inventoryhub.local`
  let order: Order
  if (selected.productId >= 1001) {
    decrementMockExpiryStock(selected.productId, parsedIntent.qty)
    order = { orderId: generateId(), status: 'CONFIRMED', customerEmail, totalCents: selected.priceCents * parsedIntent.qty, currency: selected.currency, createdAt: new Date().toISOString(), items: [{ productId: selected.productId, name: selected.name, quantity: parsedIntent.qty, unitPriceCents: selected.priceCents }] }
  } else {
    const result = await createOrder({ customerName: 'Voice shopper', customerEmail, idempotencyKey: generateId(), items: [{ productId: selected.productId, quantity: parsedIntent.qty }] })
    order = { ...result.order, status: 'CONFIRMED' }
  }
  emitMockStockUpdate({ productId: selected.productId, availableCount: Math.max(0, selected.availableCount - parsedIntent.qty), inStock: selected.availableCount > parsedIntent.qty })
  return {
    transcript,
    parsedIntent,
    popup: { title: 'Voice Order Placed!', message: `Your ${parsedIntent.qty} × ${selected.name} order is confirmed.`, order_id: order.orderId, status: 'CONFIRMED' },
    order,
    updatedCart: [],
  }
}
