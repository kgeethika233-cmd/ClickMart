import type { Metadata } from 'next'
import StoreComparisonPage from '@/components/store-comparison'

export const metadata: Metadata = {
  title: 'Compare Stores | Inventory Hub',
  description: 'Compare basket prices, stock, delivery fees, and arrival times across Inventory Hub stores.',
}

export default function ComparePage() {
  return <StoreComparisonPage />
}
