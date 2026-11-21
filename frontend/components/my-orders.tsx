'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { ArrowRight, ClipboardList, LoaderCircle, MapPin, PackageCheck, Search, Store } from 'lucide-react'
import { toast } from 'sonner'
import { useCart } from '@/context/CartContext'
import { ApiError, getOrder, getProduct } from '@/lib/api'
import { getOrders, updateStatus, type LocalOrder } from '@/lib/orders-local'
import { notifyCartAdded } from '@/lib/notify-store'
import { formatINR } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { OrderStatus } from '@/types/contract'
import styles from './my-orders.module.css'
import ExpiryIndicator from '@/components/expiry-indicator'
import { useAuth } from '@/context/AuthContext'

type Filter = 'All' | 'Active' | 'Delivered' | 'Cancelled'
const filters: Filter[] = ['All', 'Active', 'Delivered', 'Cancelled']
const isFinal = (status: OrderStatus) => status === 'CONFIRMED' || status === 'CANCELLED'

function OrderSkeleton() {
  return <div className={styles.skeletonCard} aria-hidden="true">
    <Skeleton className={styles.skeletonHeading} />
    <Skeleton className={styles.skeletonLine} />
    <Skeleton className={styles.skeletonLineShort} />
    <Skeleton className={styles.skeletonActions} />
  </div>
}

function matchesFilter(order: LocalOrder, filter: Filter) {
  if (filter === 'Active') return order.status === 'PLACED'
  if (filter === 'Delivered') return order.status === 'CONFIRMED'
  if (filter === 'Cancelled') return order.status === 'CANCELLED'
  return true
}

function statusLabel(status: OrderStatus) {
  if (status === 'PLACED') return 'Placed'
  if (status === 'CONFIRMED') return 'Confirmed'
  return 'Cancelled'
}

export default function MyOrders() {
  const { user, ready: authReady } = useAuth()
  const { addItem, items: cartItems, setQuantity, removeItem } = useCart()
  const [orders, setOrders] = useState<LocalOrder[]>([])
  const [isReady, setIsReady] = useState(false)
  const [filter, setFilter] = useState<Filter>('All')
  const [search, setSearch] = useState('')
  const [reordering, setReordering] = useState<string | null>(null)

  useEffect(() => {
    if (authReady && user) setOrders(getOrders())
    else if (authReady) setOrders([])
    if (authReady) setIsReady(true)
  }, [authReady, user])

  const statusQueries = useQueries({
    queries: orders.filter(order => !isFinal(order.status)).map(order => ({
      queryKey: ['order', order.orderId],
      queryFn: () => getOrder(order.orderId),
      enabled: !!user,
      retry: false,
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: false,
    })),
  })
  const productIds = useMemo(() => [...new Set(orders.flatMap(order => order.items ?? []).map(item => item.productId))], [orders])
  const orderProductQueries = useQueries({ queries: productIds.map(productId => ({ queryKey: ['order-product', productId], queryFn: () => getProduct(productId), enabled: !!user, retry: false })) })
  const orderProducts = new Map(productIds.map((productId, index) => [productId, orderProductQueries[index]?.data]))

  useEffect(() => {
    let changed = false
    statusQueries.forEach(query => {
      const freshOrder = query.data
      if (freshOrder && orders.some(order => order.orderId === freshOrder.orderId && order.status !== freshOrder.status)) {
        updateStatus(freshOrder.orderId, freshOrder.status)
        changed = true
      }
    })
    if (changed) setOrders(getOrders())
  }, [statusQueries, orders])

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()
    return orders.filter(order => matchesFilter(order, filter) && (!query || order.orderId.toLowerCase().includes(query)))
  }, [filter, orders, search])

  const reorder = async (order: LocalOrder) => {
    setReordering(order.orderId)
    try {
      const details = await getOrder(order.orderId)
      const products = await Promise.all(details.items.map(item => getProduct(item.productId)))
      let added = 0
      let unavailable = 0
      products.forEach((product, index) => {
        const item = details.items[index]
        if (!product.inStock || product.availableCount < 1) {
          unavailable += 1
          return
        }
        const previous = cartItems.find(line => line.productId === product.productId)?.quantity ?? 0
        for (let quantity = 0; quantity < item.quantity; quantity += 1) addItem(product)
        notifyCartAdded(product, Math.min(previous + item.quantity, product.availableCount, 10), () => previous ? setQuantity(product.productId, previous) : removeItem(product.productId))
        added += 1
      })
      if (!added) toast(unavailable ? 'These items are currently unavailable.' : 'No items could be added to your cart.')
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Could not reorder this order. Please try again.')
    } finally {
      setReordering(null)
    }
  }

  if (!authReady || !isReady) return <main className={`wrap commerce-page ${styles.page}`}><div className={styles.list} aria-label="Loading your orders"><OrderSkeleton /><OrderSkeleton /><OrderSkeleton /></div></main>
  if (!user) return <main className={`wrap commerce-page ${styles.page}`}><section className="protected-state"><h1>Please log in</h1><p>Sign in to view your order history.</p><Link href="/login">Log in</Link></section></main>

  return <main className={`wrap commerce-page ${styles.page}`}>
    <div className={styles.heading}>
      <div>
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>My Orders</h1>
        <p>Keep an eye on everything you&apos;ve ordered.</p>
      </div>
      {isReady && orders.length > 0 && <span className={styles.orderCount}>{orders.length} {orders.length === 1 ? 'order' : 'orders'}</span>}
    </div>

    {!isReady ? <div className={styles.list} aria-label="Loading your orders"><OrderSkeleton /><OrderSkeleton /><OrderSkeleton /></div> : orders.length === 0 ? <section className={styles.emptyState}>
      <span className={styles.emptyIcon}><PackageCheck size={32} /></span>
      <h2>No orders yet</h2>
      <p>Your orders will appear here after you check out.</p>
      <Link href="/" className="primary-action">Start shopping <ArrowRight size={17} /></Link>
    </section> : <>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Filter orders">
          {filters.map(option => <button key={option} type="button" className={`${styles.filter} ${filter === option ? styles.filterActive : ''}`} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>)}
        </div>
        <label className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search by order ID</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search order ID" />
        </label>
      </div>

      {filteredOrders.length ? <div className={styles.list}>
        {filteredOrders.map(order => <article className={styles.orderCard} key={order.orderId}>
          <div className={styles.cardTop}>
            <div>
              <p className={styles.orderLabel}>ORDER <span>#{order.orderId.slice(0, 8).toUpperCase()}</span></p>
              <p className={styles.placedAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.placedAt))}</p>
            </div>
            <Badge variant="outline" className={`${styles.status} ${styles[order.status.toLowerCase()]}`}>{statusLabel(order.status)}</Badge>
          </div>
          <div className={styles.cardDetails}>
            <span><PackageCheck size={16} />{order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}</span>
            <strong>{formatINR(order.total, 'INR')}</strong>
          </div>
          {!!order.items?.length && <div className="order-items-list">{order.items.map(item => { const product = orderProducts.get(item.productId); return <div key={item.productId}><span>{product?.name ?? `Product ${item.productId}`} × {item.quantity}</span><ExpiryIndicator expiryDate={product?.expiry_date} showExpired /></div> })}</div>}
          {(order.storeName || order.city) && <div className={styles.storeDetails}>
            {order.storeName && <span><Store size={15} />{order.storeName}</span>}
            {order.city && <span><MapPin size={15} />{order.city}</span>}
          </div>}
          <div className={styles.cardActions}>
            <Link className={styles.trackButton} href={`/orders/${encodeURIComponent(order.orderId)}/track`}>Track order <ArrowRight size={15} /></Link>
            <Link className={styles.secondaryButton} href={`/orders/${encodeURIComponent(order.orderId)}`}>View details</Link>
            <button className={styles.secondaryButton} type="button" disabled={reordering === order.orderId} onClick={() => void reorder(order)}>{reordering === order.orderId && <LoaderCircle className={styles.spin} size={15} />}Reorder</button>
          </div>
        </article>)}
      </div> : <div className={styles.noMatches}><ClipboardList size={24} /><p>No orders match your search.</p><button type="button" onClick={() => { setSearch(''); setFilter('All') }}>Clear filters</button></div>}
    </>}
  </main>
}
