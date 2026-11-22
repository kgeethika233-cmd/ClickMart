import type { Product } from '@/types/contract'
import type { ChatMessage, ChatResponse, ChatContext } from './api'
import { getOrder, searchProducts } from './mockApi'
import { mockExpiryProduct, mockExpiryProducts } from './mock-expiry'
import { getStoreComparison } from './compare'
import { MOCK_LOCATIONS } from './mock-locations'
import { getOrders } from './orders-local'

async function catalog(): Promise<Product[]> {
  const base = await searchProducts({ pageSize: 50 })
  const expiry = mockExpiryProducts.map(product => mockExpiryProduct(product.productId)).filter((product): product is Product => !!product && product.inStock && product.expiry_status !== 'expired')
  return [...base.items, ...expiry]
}

function priceLimit(text: string) {
  const match = text.match(/(?:under|below|less than|upto|up to)\s*(?:₹\s*)?(\d[\d,]*)|(?:₹\s*)?(\d[\d,]*)\s*(?:rupees|rs|inr)/i)
  const amount = Number((match?.[1] ?? match?.[2] ?? '').replaceAll(',', ''))
  return Number.isFinite(amount) && amount > 0 ? amount * 100 : null
}

function productTerms(text: string) {
  return text.replace(/\b(?:show|find|recommend|which|what|is|are|the|best|cheapest|top|rated|product|products|under|below|less than|upto|up to|rupees|rs|inr|₹|in|from|available|for me|please)\b/gi, ' ').replace(/[\d,]+/g, ' ').trim().toLowerCase()
}

function withProducts(reply: string, products: Product[]): ChatResponse {
  return { reply, products: products.slice(0, 4), via: 'fallback' }
}

export async function mockChatReply(messages: ChatMessage[], context: ChatContext): Promise<ChatResponse> {
  await new Promise(resolve => setTimeout(resolve, 350))
  const text = messages.at(-1)?.content.trim().toLowerCase() ?? ''
  if (/\b(?:buy|purchase)\b|\b(?:place|make|submit)\b.{0,25}\border\b|\b(?:want|need|would like)\s+to\s+(?:buy|purchase|order)\b|^\s*order\s+(?!status\b|details?\b|number\b|id\b|#)|\border\b.{0,20}\b(?:by|through|via)\s+(?:chat|assistant)\b/i.test(text)) {
    return { reply: 'I can help you find products, but chat can’t place orders. Use the mic in the top bar to place orders.', via: 'fallback' }
  }
  if (/where.*order|track.*order|order.*status|delivery.*order/.test(text)) {
    const localOrders = getOrders()
    const localOrder = localOrders.find(order => order.orderId === context.lastOrderId) ?? localOrders[0]
    const localOrderId = context.lastOrderId ?? localOrder?.orderId
    if (!localOrderId) return { reply: 'I couldn’t find a recent order yet. Visit My Orders to see your order history.', via: 'fallback' }
    try {
      const order = await getOrder(localOrderId)
      return { reply: `Order ${order.orderId} is currently ${order.status.toLowerCase()}. Open My Orders to follow its latest delivery updates.`, via: 'fallback' }
    } catch {
      if (localOrder?.orderId === localOrderId) return { reply: `Order ${localOrder.orderId} is currently ${localOrder.status.toLowerCase()}. Open My Orders to follow its latest delivery updates.`, via: 'fallback' }
      return { reply: `I found your recent order ${localOrderId}. Open My Orders to see its latest delivery status.`, via: 'fallback' }
    }
  }
  if (/fresh|expiry|expire|expired|milk/.test(text)) {
    const milk = mockExpiryProduct(1001)
    const days = milk?.days_to_expiry
    const reply = milk?.expiry_status === 'near_expiry'
      ? `${milk.name} is still within its date, but it expires in ${days} ${days === 1 ? 'day' : 'days'}. Check the date on the pack before use.`
      : milk?.expiry_status === 'fresh' ? `${milk.name} is fresh, with ${days} days remaining before expiry.` : 'I couldn’t confirm the expiry details for that item.'
    return withProducts(reply, milk ? [milk] : [])
  }
  if (/delivery fee|delivery charge|shipping fee|how much.*deliver|delivery.*cost|how long.*deliver|delivery time|eta|arrive/.test(text)) {
    const city = MOCK_LOCATIONS.some(entry => entry.city.toLowerCase() === context.city?.toLowerCase()) ? context.city : 'Bengaluru'
    const area = MOCK_LOCATIONS.find(entry => entry.city === city)?.areas[0]
    const items = context.cartProductIds.length ? context.cartProductIds.slice(0, 3).map(productId => ({ productId, quantity: 1 })) : [{ productId: 1, quantity: 1 }]
    if (area) {
      try {
        const stores = await getStoreComparison(items, { ...area, city })
        const store = stores.find(candidate => candidate.deliverable)
        if (store) return { reply: `For ${city}, delivery from ${store.name} is ₹${store.deliveryFee} and the estimated delivery time is about ${store.etaMinutes} minutes. Fees and ETA can vary by basket and address.`, via: 'fallback' }
      } catch { /* Use the comparison defaults below if the basket contains unavailable products. */ }
    }
    return { reply: 'Delivery fee and arrival time depend on your selected store, basket total, and delivery address. Compare stores at checkout for the current estimate.', via: 'fallback' }
  }

  const all = await catalog()
  const cityMatch = text.match(/\b(coimbatore|bengaluru|mumbai|delhi|chennai|hyderabad)\b/i)?.[0]
  const city = cityMatch?.toLowerCase()
  const limit = priceLimit(text)
  const isFootwear = /footwear|shoes?|sandals?|chappal|slippers?/.test(text)
  const isEarphones = /earphones?|earbuds?|headphones?|airdopes/.test(text)
  const wantsRating = /better rating|highest rated|best rated|ratings?|rating/.test(text)
  const cartProducts = context.cartProductIds.map(id => all.find(product => product.productId === id)).filter((product): product is Product => !!product)
  let matches = wantsRating && cartProducts.length ? cartProducts : all
  if (isFootwear) matches = matches.filter(product => /footwear|shoes?|sandals?|chappal|slippers?/i.test(`${product.name} ${product.category} ${(product.tags ?? []).join(' ')}`))
  else if (isEarphones) matches = matches.filter(product => /earphones?|earbuds?|headphones?|airdopes/i.test(`${product.name} ${(product.tags ?? []).join(' ')}`))
  else if (!wantsRating) {
    const terms = productTerms(text).split(/\s+/).filter(term => term.length > 2 && !['rating', 'ratings'].includes(term))
    if (terms.length) matches = matches.filter(product => terms.some(term => `${product.name} ${product.category} ${product.description} ${(product.tags ?? []).join(' ')}`.toLowerCase().includes(term)))
  }
  if (city) matches = matches.filter(product => product.city.toLowerCase() === city)
  if (limit) matches = matches.filter(product => product.priceCents <= limit)
  if (wantsRating) matches.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.priceCents - b.priceCents)
  else if (/cheapest|lowest price|least expensive/.test(text)) matches.sort((a, b) => a.priceCents - b.priceCents)
  else if (isEarphones) matches.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.priceCents - b.priceCents)

  if (!matches.length) return { reply: `I couldn’t find an in-stock ${isFootwear ? 'footwear' : 'product'}${cityMatch ? ` in ${cityMatch}` : ''}${limit ? ` under ₹${limit / 100}` : ''} in the mock catalogue.`, via: 'fallback' }
  if (wantsRating) return withProducts(`${matches[0].name} has the highest rating${matches[0].rating ? ` at ${matches[0].rating} out of 5` : ''} among these options.`, matches)
  if (isFootwear && city === 'coimbatore') return withProducts(`Here’s a footwear option listed in Coimbatore.`, matches)
  if (limit) return withProducts(`Here are matching in-stock picks priced under ₹${limit / 100}.`, matches)
  if (/cheapest|lowest price|least expensive/.test(text)) return withProducts(`The lowest-priced earphones option is ${matches[0].name} at ₹${matches[0].priceCents / 100}.`, matches)
  if (isEarphones) return withProducts(`These earphones are the best-rated options${limit ? ` under ₹${limit / 100}` : ''}.`, matches)
  return withProducts('Here are a few matching products from the catalogue.', matches)
}
