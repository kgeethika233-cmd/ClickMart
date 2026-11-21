'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { useWishlist } from '@/context/WishlistContext'
import { notifyWishlistChanged } from '@/lib/notify-store'
import type { Product } from '@/types/contract'
import styles from './wishlist-button.module.css'

type WishlistButtonProps = {
  productId: number
  product: Product
  placement?: 'card' | 'detail'
}

export default function WishlistButton({ productId, product, placement = 'card' }: WishlistButtonProps) {
  const { isWishlisted, toggle } = useWishlist()
  const [pulsing, setPulsing] = useState(false)
  const saved = isWishlisted(productId)

  return <button
    type="button"
    className={`${styles.button} ${placement === 'card' ? styles.card : styles.detail}`}
    aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
    aria-pressed={saved}
    onClick={event => {
      event.preventDefault()
      event.stopPropagation()
      toggle(productId)
      notifyWishlistChanged(product, !saved, () => toggle(productId))
      setPulsing(true)
      window.setTimeout(() => setPulsing(false), 260)
    }}
  >
    <Heart className={pulsing ? styles.pop : undefined} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
  </button>
}
