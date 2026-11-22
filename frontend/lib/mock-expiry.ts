import type { Product } from '@/types/contract'
import { expiryDateInDays, expiryInfo } from './expiry'

const records: Array<{ id: number; sku: string; name: string; category: string; city: string; price: number; stock: number; expiryDays: number | null; image: string }> = [
  { id: 1001, sku: 'EXP-001', name: 'Organic Farm Fresh Milk', category: 'Groceries', city: 'Coimbatore', price: 89, stock: 30, expiryDays: 2, image: '/products/organic-milk.webp' },
  { id: 1002, sku: 'EXP-002', name: 'Masala Rolled Oats', category: 'Groceries', city: 'Coimbatore', price: 149, stock: 24, expiryDays: 45, image: '/products/masala-oats.webp' },
  { id: 1003, sku: 'EXP-003', name: 'Expired Test Curd', category: 'Groceries', city: 'Coimbatore', price: 65, stock: 8, expiryDays: -3, image: '/products/curd.webp' },
  { id: 1004, sku: 'DEMO-ELEC-001', name: 'Bluetooth Earphones', category: 'Electronics', city: 'Bengaluru', price: 1299, stock: 18, expiryDays: null, image: '/products/bluetooth-earphones.webp' },
  { id: 1005, sku: 'DEMO-ELEC-002', name: 'boAt Airdopes TWS', category: 'Electronics', city: 'Coimbatore', price: 1799, stock: 22, expiryDays: null, image: '/products/boat-earbuds.webp' },
  { id: 1006, sku: 'DEMO-FASH-001', name: 'Silk Saree', category: 'Fashion', city: 'Chennai', price: 4999, stock: 7, expiryDays: null, image: '/products/silk-saree.webp' },
  { id: 1007, sku: 'DEMO-FOOT-001', name: 'Kolhapuri Chappal', category: 'Fashion', city: 'Mumbai', price: 899, stock: 12, expiryDays: null, image: '/products/kolhapuri-chappal.webp' },
  { id: 1008, sku: 'DEMO-FOOT-002', name: 'Coimbatore Walking Sandals', category: 'Footwear', city: 'Coimbatore', price: 999, stock: 12, expiryDays: null, image: '/products/walking-sandals.webp' },
  { id: 1009, sku: 'EXP-004', name: 'Fresh Malai Paneer', category: 'Groceries', city: 'Bengaluru', price: 120, stock: 15, expiryDays: 4, image: '/products/paneer.webp' },
  { id: 1010, sku: 'GROC-RIC-001', name: 'Premium Basmati Rice', category: 'Groceries', city: 'Bengaluru', price: 189, stock: 25, expiryDays: 180, image: '/products/basmati-rice.webp' },
  { id: 1011, sku: 'GROC-DAL-001', name: 'Unpolished Toor Dal', category: 'Groceries', city: 'Mumbai', price: 139, stock: 25, expiryDays: 150, image: '/products/toor-dal.webp' },
  { id: 1012, sku: 'GROC-ALM-001', name: 'California Almonds', category: 'Groceries', city: 'Delhi', price: 349, stock: 20, expiryDays: 120, image: '/products/almonds.webp' },
  { id: 1013, sku: 'GROC-CAS-001', name: 'Whole Cashews', category: 'Groceries', city: 'Chennai', price: 399, stock: 18, expiryDays: 120, image: '/products/cashews.webp' },
  { id: 1014, sku: 'GROC-GHE-001', name: 'Pure Cow Ghee', category: 'Groceries', city: 'Hyderabad', price: 299, stock: 22, expiryDays: 180, image: '/products/ghee.webp' },
  { id: 1015, sku: 'GROC-HON-001', name: 'Raw Forest Honey', category: 'Groceries', city: 'Bengaluru', price: 249, stock: 20, expiryDays: 180, image: '/products/honey.webp' },
  { id: 1016, sku: 'GROC-COF-001', name: 'South Indian Filter Coffee', category: 'Groceries', city: 'Chennai', price: 199, stock: 30, expiryDays: 120, image: '/products/filter-coffee.webp' },
  { id: 1017, sku: 'GROC-TEA-001', name: 'Nilgiri Green Tea', category: 'Groceries', city: 'Coimbatore', price: 179, stock: 28, expiryDays: 150, image: '/products/green-tea.webp' },
  { id: 1018, sku: 'GROC-OIL-001', name: 'Cold-Pressed Groundnut Oil', category: 'Groceries', city: 'Mumbai', price: 329, stock: 24, expiryDays: 180, image: '/products/groundnut-oil.webp' },
  { id: 1019, sku: 'GROC-JAG-001', name: 'Organic Jaggery Cubes', category: 'Groceries', city: 'Hyderabad', price: 99, stock: 25, expiryDays: 150, image: '/products/jaggery.webp' },
]

export const mockExpiryProducts: Product[] = records.map(({ id, sku, name, category, city, price, stock: availableCount, expiryDays, image }) => {
  const expiry_date = expiryDays === null ? null : expiryDateInDays(expiryDays)
  return {
    productId: id,
    sku,
    name,
    description: `Shop ${name} from our ${category.toLowerCase()} collection. Available in ${city}.`,
    category,
    city,
    priceCents: price * 100,
    currency: 'INR',
    imageUrl: image,
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
