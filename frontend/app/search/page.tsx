import type { Metadata } from 'next'
import SearchResults from '@/components/search-results'

export const metadata: Metadata = { title: 'Search products | Inventory Hub' }

export default function SearchPage() {
  return <SearchResults />
}
