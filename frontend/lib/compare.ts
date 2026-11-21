import { ApiError, getProduct } from '@/lib/api'
import type { Product } from '@/types/contract'
import { buildMockStoreComparisons, distanceBetween, type MockStoreComparison } from '@/lib/mock-stores'
import type { SampleArea } from '@/lib/mock-locations'

export const DELIVERY_FEE_TIERS = [
  { maxDistanceKm: 2, feeRupees: 0 },
  { maxDistanceKm: 5, feeRupees: 29 },
  { maxDistanceKm: 8, feeRupees: 49 },
  { maxDistanceKm: Number.POSITIVE_INFINITY, feeRupees: 79 },
] as const
export const FREE_DELIVERY_SUBTOTAL_RUPEES = 999
export const ETA_MINUTES_PER_KM = 4
export const ETA_RANGE_EXTRA_MINUTES = 10

export type ComparisonInputItem = { productId: number; quantity: number }
export type UserLocation = SampleArea & { city: string }
export type StoreComparison = MockStoreComparison

function getDeliveryFee(distanceKm: number, subtotal: number) {
  if (subtotal > FREE_DELIVERY_SUBTOTAL_RUPEES) return 0
  return DELIVERY_FEE_TIERS.find(tier => distanceKm <= tier.maxDistanceKm)?.feeRupees ?? 79
}

export function haversineKm(a: Pick<UserLocation, 'lat' | 'lng'>, b: Pick<UserLocation, 'lat' | 'lng'>) {
  return distanceBetween(a, b)
}

export function getProductStoreOptions(product: Product, location: UserLocation): StoreComparison[] {
  return buildMockStoreComparisons([product], [{ productId: product.productId, quantity: 1 }], location, getDeliveryFee)
}

export async function getStoreComparison(items: ComparisonInputItem[], userLocation: UserLocation): Promise<StoreComparison[]> {
  const quantities = new Map<number, number>()
  for (const item of items) {
    if (!Number.isInteger(item.productId) || item.productId < 1 || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error('Choose valid products and quantities to compare.')
    }
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)
  }
  if (!quantities.size) return []

  const requestedItems = [...quantities].map(([productId, quantity]) => ({ productId, quantity }))
  const products = await Promise.all(requestedItems.map(async item => {
    try {
      return await getProduct(item.productId)
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.code === 'NOT_FOUND')) return null
      throw error
    }
  }))
  const availableProducts = products.filter((product): product is NonNullable<typeof product> => product !== null)

  return buildMockStoreComparisons(availableProducts, requestedItems, userLocation, getDeliveryFee)
}
