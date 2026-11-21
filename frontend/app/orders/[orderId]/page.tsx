import type { Metadata } from 'next'
import OrderStatusPage from '@/components/order-status'

export const metadata: Metadata = { title: 'Order status | Inventory Hub', description: 'Track your Inventory Hub order.' }

export default function OrderPage() {
  return <OrderStatusPage />
}
