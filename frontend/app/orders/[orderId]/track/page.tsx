import type { Metadata } from 'next'
import OrderTracking from '@/components/order-tracking'

export const metadata: Metadata = {
  title: 'Track your order | Inventory Hub',
  description: 'Follow the latest status of your Inventory Hub order.',
}

export default function OrderTrackingPage() {
  return <OrderTracking />
}
