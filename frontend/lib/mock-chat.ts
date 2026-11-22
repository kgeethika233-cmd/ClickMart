import type { Product } from '@/types/contract'
import type { ChatMessage, ChatResponse, ChatContext } from './api'
import { getOrder, listMockProducts } from './mockApi'
import { mockExpiryProduct } from './mock-expiry'
import { getOrders } from './orders-local'

async function catalog(): Promise<Product[]> {
  return listMockProducts()
}

function priceLimit(text: string) {
  const match = text.match(/(?:under|below|less than|upto|up to)\s*(?:₹\s*)?(\d[\d,]*)|(?:₹\s*)?(\d[\d,]*)\s*(?:rupees|rs|inr)/i)
  const amount = Number((match?.[1] ?? match?.[2] ?? '').replaceAll(',', ''))
  return Number.isFinite(amount) && amount > 0 ? amount * 100 : null
}

function withProducts(reply: string, products: Product[]): ChatResponse {
  return { reply, products: products.slice(0, 4), via: 'fallback' }
}

const actions = {
  search: { label: 'Browse products', href: '/search' },
  compare: { label: 'Compare stores', href: '/compare' },
  cart: { label: 'View cart', href: '/cart' },
  orders: { label: 'My orders', href: '/orders' },
  wishlist: { label: 'Wishlist', href: '/wishlist' },
  login: { label: 'Sign in', href: '/login' },
  home: { label: 'Home', href: '/' },
}
const stopWords = new Set('a an and are about best buy can could details do does find for from give have help i in is it me my of on please product products recommend show tell the this to want what which with under below less than up to available availability stock rating highest rated cheapest price cost item items you your sell catalog catalogue store stores inventory carry'.split(' '))
const aliases: Record<string, string> = { earphone: 'headphone', earphones: 'headphone', earbuds: 'headphone', airdopes: 'headphone', headphones: 'headphone', sandal: 'shoe', sandals: 'shoe', slipper: 'shoe', slippers: 'shoe', chappal: 'shoe', footwear: 'shoe', shoes: 'shoe', tshirt: 'tee', tshirts: 'tee', t: 'tee', shirts: 'shirt' }
const categoryNames = ['electronics', 'fashion', 'home', 'books', 'sports']
function termsFor(text: string) {
  return text.toLowerCase().replace(/₹/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).map(term => aliases[term] ?? term).filter(term => term.length > 1 && !stopWords.has(term) && !/^\d+$/.test(term))
}
function siteHelp(text: string, context: ChatContext): ChatResponse | null {
  if (/^(hi|hello|hey|hiya|good morning|good afternoon|good evening|thanks|thank you)[!.\s]*$/i.test(text)) return { reply: 'Hi! I can look up products and their listed details, find options by category, budget, rating or city, compare nearby stores, and help with your cart or orders. What are you looking for?', actions: [actions.search, actions.compare], via: 'fallback' }
  if (/what can you do|how can you help|help me|site features|what is this (site|store)|what products (do you have|do you sell|are available)|what do you sell|show me the catalogue/i.test(text)) return { reply: 'I can search the full product catalogue, explain a product’s listed price, description, stock and delivery details, compare nearby stores, and point you to your cart, wishlist or order history. I can’t place an order in chat.', actions: [actions.search, actions.compare, actions.cart, actions.orders, actions.wishlist], via: 'fallback' }
  if (/how (do i|can i|to) (search|find)|search (for|the) products|browse (products|categories)/i.test(text)) return { reply: 'Use the search box at the top of the store, or browse Electronics, Fashion, Home, Books and Sports from the home page. You can narrow results by category, city, price and delivery options.', actions: [actions.search, actions.home], via: 'fallback' }
  if (/compare (stores|shops|prices)|nearby stores|store comparison|which store/i.test(text)) return { reply: 'Open Compare stores to compare availability, price, delivery fee and estimated arrival for your selected location and basket. Estimates can vary by address and stock.', actions: [actions.compare], via: 'fallback' }
  if (/how (do i|can i|to) (track|check)|track (an? )?order|where.*order|order.*status|delivery.*order/i.test(text)) return { reply: 'Open My orders to see your recent purchases and follow an order’s status. If you share the order number, I can try to look it up here too.', actions: [actions.orders, actions.login], via: 'fallback' }
  if (/where.*(cart|basket)|what.*(cart|basket)|view.*(cart|basket)|checkout/i.test(text)) return { reply: 'Your cart is available from the Cart link in the store header. Review the basket there and continue to checkout to confirm your order.', actions: [actions.cart], via: 'fallback' }
  if (/wishlist|saved products|save (a )?product/i.test(text)) return { reply: 'Use the heart button on a product card or product page to save it, then open Wishlist from your account menu.', actions: [actions.wishlist, actions.login], via: 'fallback' }
  if (/delivery fee|delivery charge|shipping fee|how much.*deliver|delivery.*cost|how long.*deliver|delivery time|eta|arrive|delivery area/i.test(text)) return { reply: `Delivery options for ${context.city || 'your location'} depend on the selected store, basket and address. Compare stores or review the estimate in your cart before checkout.`, actions: [actions.compare, actions.cart], via: 'fallback' }
  if (/return|refund|warranty|payment method|cash on delivery|cod/i.test(text)) return { reply: 'I can’t confirm a returns, refund, warranty or payment policy from the store information available to me, so I don’t want to guess. Please check the checkout details or contact the store team before placing an order.', actions: [actions.cart], via: 'fallback' }
  if (/login|sign.?up|account|register/i.test(text)) return { reply: 'Sign in to view your orders and saved items, or create an account if you’re new to Inventory Hub.', actions: [actions.login], via: 'fallback' }
  return null
}
function productScore(product: Product, terms: string[]) {
  if (!terms.length) return 0
  const name = termsFor(product.name)
  const details = termsFor(`${product.category} ${product.city} ${product.description} ${(product.tags ?? []).join(' ')}`)
  return terms.reduce((score, term) => score + (name.includes(term) ? 5 : details.includes(term) ? 2 : 0), 0)
}
function productDetails(product: Product, question = '') {
  const price = new Intl.NumberFormat('en-IN', { style: 'currency', currency: product.currency }).format(product.priceCents / 100)
  const availability = product.inStock && product.availableCount > 0 ? `${product.availableCount} in stock` : 'currently out of stock'
  const details = [product.description, `Price: ${price}.`, `Category: ${product.category}. Listed in ${product.city}.`, `SKU: ${product.sku}.`, `Availability: ${availability}.`]
  if (product.rating) details.push(`Rating: ${product.rating} out of 5.`)
  if (product.delivery_time_mins != null) details.push(`Listed delivery estimate: about ${product.delivery_time_mins} minutes${product.delivery_fee != null ? `, with a ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: product.currency }).format(product.delivery_fee)} delivery fee` : ''}.`)
  if (product.expiry_status && product.expiry_status !== 'none' && product.days_to_expiry != null) details.push(`Expiry: ${product.days_to_expiry} ${product.days_to_expiry === 1 ? 'day' : 'days'} remaining (${product.expiry_status.replace('_', ' ')}).`)
  const requestedSpec = question.match(/\b(waterproof|water resistant|battery|material|color|colour|size|dimensions|capacity|warranty|compatibility|weight|washable|ingredients?)\b/i)?.[0]
  const listedInfo = `${product.name} ${product.description} ${(product.tags ?? []).join(' ')}`.toLowerCase()
  const caveat = requestedSpec && !listedInfo.includes(requestedSpec.toLowerCase()) ? `The listing doesn’t specify ${requestedSpec} for ${product.name}. ` : ''
  return `${caveat}${details.join(' ')}`
}
export async function mockChatReply(messages: ChatMessage[], context: ChatContext): Promise<ChatResponse> {
  await new Promise(resolve => setTimeout(resolve, 250))
  const rawText = messages.at(-1)?.content.trim() ?? ''
  const text = rawText.toLowerCase()
  if (!text) return { reply: 'What would you like to find?', actions: [actions.search], via: 'fallback' }
  if (/\b(?:place|make|submit)\s+(?:an?\s+)?order\b|\b(?:order|purchase|checkout)\b.{0,30}\b(?:through|via|in)\s+(?:chat|assistant)\b/i.test(text)) return { reply: 'I can help you choose products, but chat can’t place orders. Add an item to your cart and complete checkout there.', actions: [actions.cart], via: 'fallback' }
  const help = siteHelp(text, context)
  if (help) {
    if (/track|order.*status|where.*order/i.test(text)) {
      const recent = getOrders()[0]
      const orderId = context.lastOrderId ?? recent?.orderId
      if (orderId) {
        try {
          const order = await getOrder(orderId)
          return { ...help, reply: `Your recent order ${order.orderId} is currently ${order.status.toLowerCase()}. Open My orders to follow its updates.`, actions: [actions.orders] }
        } catch {
          if (recent) return { ...help, reply: `Your recent order ${recent.orderId} is currently ${recent.status.toLowerCase()}. Open My orders to follow its updates.`, actions: [actions.orders] }
        }
      }
    }
    return help
  }

  const all = await catalog()
  const cityMatch = text.match(/\b(coimbatore|bengaluru|mumbai|delhi|chennai|hyderabad)\b/i)?.[0]
  const city = cityMatch?.toLowerCase()
  const limit = priceLimit(text)
  const queryTerms = termsFor(rawText)
  const asksCart = /\b(cart|basket)\b/.test(text)
  const cartProducts = context.cartProductIds.map(id => all.find(product => product.productId === id)).filter((product): product is Product => !!product)
  const isFollowUp = /^(what about|and|how about|its|their|more|price|availability|is it|does it|can it)\b/i.test(text)
  const lastProduct = isFollowUp ? context.lastProductIds?.map(id => all.find(product => product.productId === id)).find((product): product is Product => !!product) : undefined
  if (lastProduct && /price|cost|stock|availability|delivery|tell me|details|more|it\b|waterproof|battery|material|color|colour|size|dimensions|capacity|warranty|compatibility|weight|washable|ingredients?/.test(text)) return { reply: productDetails(lastProduct, text), products: [lastProduct], actions: [{ label: 'View product', href: `/product/${lastProduct.productId}` }], via: 'fallback' }
  if (asksCart) return cartProducts.length ? { reply: `Your cart has ${cartProducts.length} ${cartProducts.length === 1 ? 'product' : 'products'}: ${cartProducts.map(product => product.name).join(', ')}. Open your cart to review quantities and totals.`, products: cartProducts, actions: [actions.cart], via: 'fallback' } : { reply: 'Your cart is empty right now. Browse the catalogue and add a product to get started.', actions: [actions.search], via: 'fallback' }

  const asksDetails = /\b(tell me about|details?|description|specs?|specifications|features|how much is|price of|is .* available|available stock|availability|in stock|fresh|expiry|expire|expired|waterproof|water resistant|battery|material|color|colour|size|dimensions|capacity|warranty|compatibility|weight|washable|ingredients?)\b|\bwhat does\b|\bwhat is the\b/i.test(text)
  const asksRecommendation = /\b(recommend|suggest|best|top|cheapest|lowest|under|below|less than|upto|up to|show|find|looking for|available|in stock|rating|rated)\b/i.test(text)
  const hasCategory = categoryNames.some(category => text.includes(category))
  const isFreshnessQuestion = /fresh|expiry|expire|expired|milk/.test(text)
  if (isFreshnessQuestion && !asksDetails && !queryTerms.some(term => !['fresh', 'expiry', 'expire', 'expired'].includes(term))) {
    const milk = mockExpiryProduct(1001)
    const days = milk?.days_to_expiry
    const reply = milk?.expiry_status === 'near_expiry' ? `${milk.name} is still within its date, but it expires in ${days} ${days === 1 ? 'day' : 'days'}. Check the date on the pack before use.` : milk?.expiry_status === 'fresh' ? `${milk.name} is fresh, with ${days} days remaining before expiry.` : 'I couldn’t confirm the expiry details for that item.'
    return { ...withProducts(reply, milk ? [milk] : []), actions: milk ? [{ label: 'Open product', href: `/product/${milk.productId}` }] : [actions.search] }
  }

  const scored = all.map(product => ({ product, score: productScore(product, queryTerms) })).filter(({ product, score }) => {
    const categoryMatch = categoryNames.includes(queryTerms.join(' ')) && product.category.toLowerCase() === queryTerms.join(' ')
    return (score > 0 || categoryMatch || (!queryTerms.length && asksRecommendation)) && (asksDetails || (product.inStock && product.expiry_status !== 'expired')) && (!city || product.city.toLowerCase() === city) && (!limit || product.priceCents <= limit)
  }).sort((a, b) => b.score - a.score || (b.product.rating ?? 0) - (a.product.rating ?? 0) || a.product.priceCents - b.product.priceCents)
  const wantsRating = /better rating|highest rated|best rated|ratings?|rating/.test(text)
  const wantsCheapest = /cheapest|lowest price|least expensive/.test(text)
  if (wantsRating) scored.sort((a, b) => (b.product.rating ?? 0) - (a.product.rating ?? 0) || a.product.priceCents - b.product.priceCents)
  else if (wantsCheapest) scored.sort((a, b) => a.product.priceCents - b.product.priceCents)
  const matches = scored.map(entry => entry.product)
  const isProductRequest = asksDetails || asksRecommendation || hasCategory || !!city || !!limit || queryTerms.length > 0
  if (!matches.length && isProductRequest) return { reply: `I couldn’t find a matching in-stock product${cityMatch ? ` in ${cityMatch}` : ''}${limit ? ` under ₹${limit / 100}` : ''}. Try a product name or browse the catalogue by category.`, actions: [actions.search], via: 'fallback' }
  if (!matches.length) return { reply: 'I’m not sure which product or store question you mean. Ask me about a product name, price, stock, delivery estimate, or use the store links below.', actions: [actions.search, actions.compare, actions.orders], via: 'fallback' }

  const exactNameMatch = matches.find(product => termsFor(product.name).every(term => queryTerms.includes(term)))
  const detailProduct = exactNameMatch ?? (asksDetails && scored[0]?.score >= 5 ? matches[0] : null)
  if (detailProduct && (asksDetails || exactNameMatch)) return { reply: productDetails(detailProduct), products: [detailProduct], actions: [{ label: 'View product', href: `/product/${detailProduct.productId}` }], via: 'fallback' }
  const products = matches.slice(0, 4)
  const reply = wantsRating ? `${products[0].name} is the highest-rated match${products[0].rating ? ` at ${products[0].rating} out of 5` : ''}.` : wantsCheapest ? `${products[0].name} is the lowest-priced match at ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: products[0].currency }).format(products[0].priceCents / 100)}.` : limit ? `Here are in-stock matches under ₹${limit / 100}${cityMatch ? ` in ${cityMatch}` : ''}, ranked by relevance and rating.` : `Here are the closest in-stock matches${cityMatch ? ` in ${cityMatch}` : ''}, ranked by relevance and rating.`
  return { reply, products, actions: [{ label: 'Browse all products', href: `/search${queryTerms.length ? `?q=${encodeURIComponent(queryTerms.join(' '))}` : ''}` }], via: 'fallback' }
}
