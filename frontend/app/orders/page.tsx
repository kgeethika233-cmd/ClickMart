import type { Metadata } from 'next'
import MyOrders from '@/components/my-orders'

export const metadata: Metadata = {
  title: 'My Orders | Inventory Hub',
  description: 'Review and track your Inventory Hub orders.',
}

export default function OrdersPage() {
  return <MyOrders />
}
