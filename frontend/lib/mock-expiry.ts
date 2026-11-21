import type { Product } from '@/types/contract'
import { expiryDateInDays, expiryInfo } from './expiry'

const records: Array<[string, string, string, number, number, number | null]> = [
  ['Organic Milk', 'Groceries', 'Coimbatore', 89, 30, 2],
  ['Masala Oats', 'Groceries', 'Coimbatore', 149, 24, 45],
  ['Expired Test Curd', 'Groceries', 'Coimbatore', 65, 8, -3],
  ['Bluetooth Earphones', 'Electronics', 'Bengaluru', 1299, 18, null],
  ['boAt Airdopes TWS', 'Electronics', 'Coimbatore', 1799, 22, null],
  ['Silk Saree', 'Fashion', 'Chennai', 4999, 7, null],
  ['Kolhapuri Chappal', 'Fashion', 'Mumbai', 899, 12, null],
  ['Coimbatore Walking Sandals', 'Footwear', 'Coimbatore', 999, 12, null],
]

export const mockExpiryProducts: Product[] = records.map(([name, category, city, price, availableCount, offset], index) => {
  const expiry_date = offset === null ? null : expiryDateInDays(offset)
  const sku = `EXP-${String(index + 1).padStart(3, '0')}`
  return {
    productId: 1001 + index,
    sku,
    name,
    description: `Shop ${name} from our ${category.toLowerCase()} collection. Available in ${city}.`,
    category,
    city,
    priceCents: price * 100,
    currency: 'INR',
    imageUrl: null,
    inStock: availableCount > 0,
    availableCount,
    ...expiryInfo(expiry_date),
    ...(name === 'Coimbatore Walking Sandals' ? { rating: 4.6, tags: ['footwear', 'sandals', 'shoes'] } : {}),
  }
})

export function mockExpiryProduct(id: number): Product | undefined {
  const product = mockExpiryProducts.find(item => item.productId === id)
  return product ? { ...product, ...expiryInfo(product.expiry_date) } : undefined
}

export function decrementMockExpiryStock(id: number, quantity: number): void {
  const product = mockExpiryProducts.find(item => item.productId === id)
  if (!product || product.availableCount < quantity) throw new Error('Item is expired or out of stock')
  product.availableCount -= quantity
  product.inStock = product.availableCount > 0
}
