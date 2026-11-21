import type { Metadata } from 'next'
import WishlistPage from '@/components/wishlist-page'

export const metadata: Metadata = {
  title: 'Wishlist | Inventory Hub',
  description: 'Save your favorite finds in your Inventory Hub wishlist.',
}

export default function WishlistRoute() {
  return <WishlistPage />
}
