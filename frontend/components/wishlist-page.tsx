'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useQueries } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, Heart, ShoppingCart, Trash2 } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { notifyCartAdded, notifyWishlistChanged } from '@/lib/notify-store'
import { useWishlist } from '@/context/WishlistContext'
import { ApiError, getProduct } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import ProductCard from '@/components/product-card'
import styles from './wishlist-page.module.css'
import { useAuth } from '@/context/AuthContext'
import { useLiveStock } from '@/hooks/use-live-stock'

function WishlistSkeleton() {
  return <article className={styles.skeletonCard} aria-hidden="true">
    <Skeleton className={styles.skeletonImage} />
    <Skeleton className={styles.skeletonTitle} />
    <Skeleton className={styles.skeletonText} />
    <Skeleton className={styles.skeletonButton} />
  </article>
}

export default function WishlistPage() {
  const { user, ready: authReady } = useAuth()
  const { items, isReady, remove, clear, toggle } = useWishlist()
  const { items: cartItems, addItem, setQuantity, removeItem } = useCart()
  const products = useQueries({ queries: items.map(productId => ({
    queryKey: ['wishlist-product', productId],
    queryFn: () => getProduct(productId),
    retry: false,
  })) })
  const readStock = useLiveStock(items.map((productId, index) => ({ productId, availableCount: products[index]?.data?.availableCount ?? 0, inStock: products[index]?.data?.inStock ?? false })))

  useEffect(() => { document.title = 'Wishlist | Inventory Hub' }, [])
  const expiredKey = items.filter((_, index) => products[index]?.data?.expiry_status === 'expired').join(',')
  useEffect(() => { expiredKey.split(',').filter(Boolean).forEach(id => remove(Number(id))) }, [expiredKey, remove])

  if (!authReady || !isReady) return <main className={`wrap commerce-page ${styles.page}`}>
    <p className="sr-only" role="status">Loading your wishlist</p>
    <div className={styles.grid}>{Array.from({ length: 3 }, (_, index) => <WishlistSkeleton key={index} />)}</div>
  </main>

  if (!user) return <main className={`wrap commerce-page ${styles.page}`}><section className="protected-state"><h1>Please log in</h1><p>Sign in to view and manage your wishlist.</p><Link href="/login">Log in</Link></section></main>

  if (!items.length) return <main className={`wrap commerce-page ${styles.page}`}>
    <div className="state-card">
      <span className="state-icon"><Heart aria-hidden="true" /></span>
      <h1>Your wishlist is waiting</h1>
      <p>Save the things you love and they&apos;ll be easy to find here.</p>
      <Link className="primary-action" href="/">Explore the marketplace <ArrowRight size={17} /></Link>
    </div>
  </main>

  return <main className={`wrap commerce-page ${styles.page}`}>
    <div className={styles.heading}>
      <div>
        <p className="eyebrow">YOUR SAVED FINDS</p>
        <h1>Wishlist <span>({items.length})</span></h1>
        <p className={styles.description}>A little collection of things you love.</p>
      </div>
      <Button variant="outline" onClick={clear}><Trash2 data-icon="inline-start" />Clear all</Button>
    </div>
    <section className={styles.grid} aria-label="Wishlist products" aria-busy={products.some(product => product.isPending)}>
      {items.map((productId, index) => {
        const query = products[index]
        const product = query?.data
        if (product) {
          if (product.expiry_status === 'expired') return null
          const inCart = cartItems.find(item => item.productId === product.productId)?.quantity ?? 0
          const stock = readStock(product.productId)
          const outOfStock = !stock.inStock || stock.availableCount < 1
          const atLimit = !outOfStock && inCart >= Math.min(stock.availableCount, 10)
          return <div className={styles.item} key={productId}>
            <ProductCard product={product} showCartAction={false} />
            <div className={styles.actions}>
              <Button disabled={outOfStock || atLimit} onClick={() => {
                if (outOfStock || atLimit) return
                const previous = inCart
                addItem({ ...product, availableCount: stock.availableCount, inStock: stock.inStock })
                remove(product.productId)
                notifyCartAdded(product, previous + 1, () => previous ? setQuantity(product.productId, previous) : removeItem(product.productId))
                notifyWishlistChanged(product, false, () => toggle(product.productId))
              }}><ShoppingCart data-icon="inline-start" />{atLimit ? 'Limit reached' : 'Move to cart'}</Button>
              <Button variant="outline" aria-label={`Remove ${product.name}`} onClick={() => { remove(product.productId); notifyWishlistChanged(product, false, () => toggle(product.productId)) }}>Remove</Button>
            </div>
          </div>
        }
        if (query?.isPending) return <WishlistSkeleton key={productId} />
        const notFound = query?.error instanceof ApiError && query.error.code === 'NOT_FOUND'
        return <div className={styles.unavailable} key={productId}>
          <AlertCircle aria-hidden="true" />
          <p>{notFound ? 'This saved product is no longer available.' : 'We couldn’t load this saved product.'}</p>
          <div className={styles.actions}>
            {!notFound && <Button variant="outline" onClick={() => void query?.refetch()}>Retry</Button>}
            <Button variant="outline" onClick={() => remove(productId)}>Remove</Button>
          </div>
        </div>
      })}
    </section>
  </main>
}
