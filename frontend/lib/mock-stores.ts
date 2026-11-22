import type { Product } from '@/types/contract'
import type { SampleArea } from '@/lib/mock-locations'

export type MockStore = {
  id: string
  name: string
  area: string
  city: string
  address: string
  lat: number
  lng: number
  maxDeliveryRadiusKm: number
  prepMinutes: number
  stock: Record<number, number>
}

export type MockStoreItem = {
  productId: number
  name: string
  quantity: number
  priceCents: number
  currency: string
  availableQuantity: number
  inStock: boolean
  unavailable: boolean
}

export type MockStoreComparison = {
  storeId: string
  name: string
  area: string
  city: string
  address: string
  distanceKm: number
  deliverable: boolean
  notDeliverableReason: string | null
  subtotal: number
  deliveryFee: number | null
  total: number | null
  etaMinutes: number | null
  inStockCount: number
  totalCount: number
  missingItems: MockStoreItem[]
  unavailableItems: MockStoreItem[]
  items: MockStoreItem[]
  badges: string[]
}

const STORE_LOCATIONS: Omit<MockStore, 'stock'>[] = [
  { id: 'blr-indiranagar', name: 'Fresh Basket Indiranagar', area: 'Indiranagar', city: 'Bengaluru', address: '100 Feet Road, Indiranagar', lat: 12.9784, lng: 77.6408, maxDeliveryRadiusKm: 8, prepMinutes: 14 },
  { id: 'blr-koramangala', name: 'Fresh Basket Koramangala', area: 'Koramangala', city: 'Bengaluru', address: '80 Feet Road, Koramangala', lat: 12.9352, lng: 77.6245, maxDeliveryRadiusKm: 7, prepMinutes: 18 },
  { id: 'blr-malleshwaram', name: 'Fresh Basket Malleshwaram', area: 'Malleshwaram', city: 'Bengaluru', address: 'Sampige Road, Malleshwaram', lat: 13.0035, lng: 77.5643, maxDeliveryRadiusKm: 9, prepMinutes: 12 },
  { id: 'blr-whitefield', name: 'Fresh Basket Whitefield', area: 'Whitefield', city: 'Bengaluru', address: 'ITPL Main Road, Whitefield', lat: 12.9698, lng: 77.75, maxDeliveryRadiusKm: 6, prepMinutes: 20 },
  { id: 'blr-jayanagar', name: 'Fresh Basket Jayanagar', area: 'Jayanagar', city: 'Bengaluru', address: '4th Block, Jayanagar', lat: 12.925, lng: 77.5838, maxDeliveryRadiusKm: 10, prepMinutes: 16 },
  { id: 'mum-bandra', name: 'Fresh Basket Bandra', area: 'Bandra West', city: 'Mumbai', address: 'Hill Road, Bandra West', lat: 19.0607, lng: 72.8362, maxDeliveryRadiusKm: 8, prepMinutes: 13 },
  { id: 'mum-andheri', name: 'Fresh Basket Andheri', area: 'Andheri East', city: 'Mumbai', address: 'Mahakali Caves Road, Andheri East', lat: 19.1136, lng: 72.8697, maxDeliveryRadiusKm: 7, prepMinutes: 17 },
  { id: 'mum-dadar', name: 'Fresh Basket Dadar', area: 'Dadar', city: 'Mumbai', address: 'Ranade Road, Dadar West', lat: 19.0178, lng: 72.8478, maxDeliveryRadiusKm: 9, prepMinutes: 11 },
  { id: 'mum-powai', name: 'Fresh Basket Powai', area: 'Powai', city: 'Mumbai', address: 'Hiranandani Gardens, Powai', lat: 19.1176, lng: 72.906, maxDeliveryRadiusKm: 6, prepMinutes: 22 },
  { id: 'mum-colaba', name: 'Fresh Basket Colaba', area: 'Colaba', city: 'Mumbai', address: 'Shahid Bhagat Singh Road, Colaba', lat: 18.9067, lng: 72.8147, maxDeliveryRadiusKm: 10, prepMinutes: 15 },
]

function hashStock(storeId: string, productId: number) {
  let hash = 2166136261
  const input = `${storeId}:${productId}`
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const value = hash >>> 0
  if (value % 13 === 0) return 0
  if (value % 4 === 0) return 1 + (value % 2)
  return 6 + (value % 15)
}

function createStores(products: Product[]): MockStore[] {
  return STORE_LOCATIONS.map(store => ({
    ...store,
    stock: Object.fromEntries(products.map(product => [product.productId, hashStock(store.id, product.productId)])),
  }))
}

export function distanceBetween(a: Pick<SampleArea, 'lat' | 'lng'>, b: Pick<MockStore, 'lat' | 'lng'>) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latDifference = radians(b.lat - a.lat)
  const lngDifference = radians(b.lng - a.lng)
  const value = Math.sin(latDifference / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lngDifference / 2) ** 2
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)) * 10) / 10
}

export function buildMockStoreComparisons(
  products: Product[],
  requestedItems: { productId: number; quantity: number }[],
  location: SampleArea & { city: string },
  feeForDistance: (distanceKm: number, subtotal: number) => number,
): MockStoreComparison[] {
  const productById = new Map(products.map(product => [product.productId, product]))
  const stores = createStores(products).filter(store => store.city === location.city)

  const comparisons: MockStoreComparison[] = stores.map(store => {
    const distanceKm = distanceBetween(location, store)
    const deliverable = distanceKm <= store.maxDeliveryRadiusKm
    const items = requestedItems.map(request => {
      const product = productById.get(request.productId)
      if (!product) {
        return { productId: request.productId, name: 'Unavailable', quantity: request.quantity, priceCents: 0, currency: 'INR', availableQuantity: 0, inStock: false, unavailable: true }
      }
      const availableQuantity = store.stock[product.productId] ?? 0
      return {
        productId: product.productId,
        name: product.name,
        quantity: request.quantity,
        priceCents: product.priceCents,
        currency: product.currency,
        availableQuantity,
        inStock: availableQuantity >= request.quantity,
        unavailable: false,
      }
    })
    const activeItems = items.filter(item => !item.unavailable)
    const subtotal = activeItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0) / 100
    const deliveryFee = deliverable ? feeForDistance(distanceKm, subtotal) : null
    const etaMinutes = deliverable ? store.prepMinutes + Math.round(distanceKm * 4) : null
    const missingItems = activeItems.filter(item => !item.inStock)
    const unavailableItems = items.filter(item => item.unavailable)

    return {
      storeId: store.id,
      name: store.name,
      area: store.area,
      city: store.city,
      address: store.address,
      distanceKm,
      deliverable,
      notDeliverableReason: deliverable ? null : `Not deliverable to your location: ${distanceKm.toFixed(1)} km away, this store delivers within ${store.maxDeliveryRadiusKm} km.`,
      subtotal,
      deliveryFee,
      total: deliveryFee === null ? null : subtotal + deliveryFee,
      etaMinutes,
      inStockCount: activeItems.filter(item => item.inStock).length,
      totalCount: activeItems.length,
      missingItems,
      unavailableItems,
      items,
      badges: [],
    }
  }).sort((a, b) => Number(b.deliverable) - Number(a.deliverable) || a.distanceKm - b.distanceKm || a.storeId.localeCompare(b.storeId))

  const deliverable = comparisons.filter(store => store.deliverable)
  const addBadge = (storeId: string | undefined, label: string) => {
    const store = deliverable.find(candidate => candidate.storeId === storeId)
    if (store && !store.badges.includes(label)) store.badges.push(label)
  }
  const byDistance = [...deliverable].sort((a, b) => a.distanceKm - b.distanceKm || a.storeId.localeCompare(b.storeId))
  const byEta = [...deliverable].sort((a, b) => (a.etaMinutes ?? 0) - (b.etaMinutes ?? 0) || a.storeId.localeCompare(b.storeId))
  addBadge(byDistance[0]?.storeId, 'Nearest')
  addBadge(byEta[0]?.storeId, 'Fastest')

  const lowestFee = Math.min(...deliverable.map(store => store.deliveryFee ?? Number.POSITIVE_INFINITY))
  deliverable.filter(store => store.deliveryFee === lowestFee).forEach(store => addBadge(store.storeId, 'Lowest fee'))

  const completeBaskets = deliverable.filter(store => store.inStockCount === store.totalCount && store.unavailableItems.length === 0)
  addBadge([...completeBaskets].sort((a, b) => (a.total ?? 0) - (b.total ?? 0) || (a.etaMinutes ?? 0) - (b.etaMinutes ?? 0) || a.storeId.localeCompare(b.storeId))[0]?.storeId, 'Best value')

  return comparisons
}
