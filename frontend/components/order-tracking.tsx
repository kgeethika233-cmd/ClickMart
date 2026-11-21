'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, Clock3, Headphones, LoaderCircle, PackageCheck, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCart } from '@/context/CartContext'
import { ApiError, getOrder, getProduct } from '@/lib/api'
import { USE_MOCK } from '@/lib/config'
import { formatINR } from '@/lib/format'
import { updateStatus } from '@/lib/orders-local'
import { notifyCartAdded } from '@/lib/notify-store'
import type { Order, OrderStatus } from '@/types/contract'
import styles from './order-tracking.module.css'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const steps = ['Order placed', 'Payment confirmed', 'Packing', 'Out for delivery', 'Delivered']
const isFinal = (status: OrderStatus) => status === 'CONFIRMED' || status === 'CANCELLED'
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function LoadingState() {
  return <main className={`wrap commerce-page ${styles.page}`} aria-label="Loading order tracking">
    <div className={styles.loadingHead}><div /><div /><div /></div>
    <div className={styles.loadingGrid}><div /><div /></div>
  </main>
}

function NotFoundState() {
  return <main className={`wrap commerce-page ${styles.page}`}><section className={styles.stateCard}>
    <span className={styles.stateIcon}><PackageCheck aria-hidden="true" /></span><p className="eyebrow">ORDER TRACKING</p><h1>We couldn&apos;t find that order</h1>
    <p>Check the order link and try again, or return to your order history.</p><Link href="/orders" className={styles.primaryButton}><ArrowLeft aria-hidden="true" /> Back to My Orders</Link>
  </section></main>
}

function TrackingError({ retry }: { retry: () => void }) {
  return <main className={`wrap commerce-page ${styles.page}`}><section className={styles.stateCard}>
    <span className={styles.stateIcon}><Headphones aria-hidden="true" /></span><p className="eyebrow">CONNECTION ISSUE</p><h1>We can&apos;t load your tracking yet</h1>
    <p>Your order is safe. Check your connection and try again.</p><button type="button" className={styles.primaryButton} onClick={retry}><RotateCcw aria-hidden="true" /> Try again</button>
  </section></main>
}

function getProgress(order: Order, now: number) {
  if (order.status === 'CANCELLED') return -1
  if (order.status === 'PLACED') return 0
  if (USE_MOCK) return Math.min(4, Math.max(1, 1 + Math.floor(Math.max(0, now - Date.parse(order.createdAt) - 3000) / 8000)))
  return 1
}

function TrackingDetails({ order, lastUpdatedAt, onRetry }: { order: Order; lastUpdatedAt: number; onRetry: () => void }) {
  const { addItem, items: cartItems, setQuantity, removeItem } = useCart()
  const [now, setNow] = useState(() => Date.now())
  const [reordering, setReordering] = useState(false)
  const progress = getProgress(order, now)
  const cancelled = order.status === 'CANCELLED'
  const delivered = progress === 4
  const estimatedDelivery = new Date(Date.parse(order.createdAt) + 45 * 60 * 1000)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const reorder = async () => {
    setReordering(true)
    try {
      const products = await Promise.all(order.items.map(item => getProduct(item.productId)))
      let added = 0
      let unavailable = 0
      products.forEach((product, index) => {
        const item = order.items[index]
        if (!product.inStock || product.availableCount < 1) { unavailable += 1; return }
        const previous = cartItems.find(line => line.productId === product.productId)?.quantity ?? 0
        for (let quantity = 0; quantity < item.quantity; quantity += 1) addItem(product)
        notifyCartAdded(product, Math.min(previous + item.quantity, product.availableCount, 10), () => previous ? setQuantity(product.productId, previous) : removeItem(product.productId))
        added += 1
      })
      if (!added) toast(unavailable ? 'These items are currently unavailable.' : 'No items could be added to your cart.')
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'Could not reorder this order. Please try again.')
    } finally { setReordering(false) }
  }

  const secondsSinceUpdate = Math.max(0, Math.floor((now - lastUpdatedAt) / 1000))
  const relativeUpdated = secondsSinceUpdate < 2 ? 'just now' : `${secondsSinceUpdate}s ago`
  return <main className={`wrap commerce-page ${styles.page}`}>
    <Link href="/orders" className={styles.backLink}><ArrowLeft aria-hidden="true" /> Back to My Orders</Link>
    <header className={styles.heading}>
      <div><p className="eyebrow">ORDER TRACKING</p><h1>Order #{order.orderId.slice(0, 8).toUpperCase()}</h1><p>Placed {dateFormatter.format(new Date(order.createdAt))} <span aria-hidden="true">·</span> Total {formatINR(order.totalCents, order.currency)}</p></div>
      <span className={`${styles.statusBadge} ${cancelled ? styles.cancelled : delivered ? styles.delivered : ''}`}>{cancelled ? 'Cancelled' : delivered ? 'Delivered' : order.status === 'PLACED' ? 'Placed' : 'In progress'}</span>
    </header>

    <div className={styles.trackingGrid}>
      <section className={styles.progressCard} aria-labelledby="journey-title">
        <div className={styles.cardHeading}><div><p className="eyebrow">YOUR DELIVERY</p><h2 id="journey-title">{cancelled ? 'Order cancelled' : delivered ? 'Your order has arrived' : 'On its way to you'}</h2></div>
          {!cancelled && <span className={styles.live}><span aria-hidden="true" />LIVE</span>}
        </div>
        <p className={styles.updated}><span className={styles.greenDot} />Last updated {relativeUpdated}{order.status === 'PLACED' && <button type="button" onClick={onRetry} aria-label="Refresh tracking"><RotateCcw aria-hidden="true" /></button>}</p>
        <ol className={styles.timeline} aria-label="Delivery progress">
          {steps.map((step, index) => {
            const complete = !cancelled && index < progress
            const current = !cancelled && index === progress
            return <li key={step} className={`${styles.step} ${complete ? styles.complete : ''} ${current ? styles.current : ''} ${cancelled ? styles.muted : ''}`} aria-current={current ? 'step' : undefined}>
              <span className={styles.marker}>{complete ? <Check aria-hidden="true" /> : current ? <span /> : null}</span>
              <div><strong>{step}</strong><small>{current ? (index === 0 ? 'We received your order' : index === 1 ? 'Your payment was confirmed' : 'Your delivery is progressing') : complete ? 'Complete' : 'Coming up'}</small></div>
            </li>
          })}
        </ol>
        {!cancelled && <div className={styles.estimate}><Clock3 aria-hidden="true" /><span>Estimated delivery</span><strong>{delivered ? 'Delivered' : dateFormatter.format(estimatedDelivery)}</strong></div>}
      </section>

      <aside className={styles.summaryCard} aria-labelledby="summary-title">
        <div className={styles.cardHeading}><div><p className="eyebrow">THE DETAILS</p><h2 id="summary-title">Order summary</h2></div><strong className={styles.total}>{formatINR(order.totalCents, order.currency)}</strong></div>
        <ul className={styles.items}>{order.items.map(item => <li key={item.productId}><div><strong>{item.name}</strong><span>Qty {item.quantity} · {formatINR(item.unitPriceCents, order.currency)} each</span></div><b>{formatINR(item.unitPriceCents * item.quantity, order.currency)}</b></li>)}</ul>
        <div className={styles.grandTotal}><span>Total paid</span><strong>{formatINR(order.totalCents, order.currency)}</strong></div>
        <button type="button" className={styles.secondaryButton} onClick={() => void reorder()} disabled={reordering}>{reordering ? <LoaderCircle className={styles.spin} aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}{reordering ? 'Adding items…' : 'Reorder'}</button>
        <a className={styles.helpLink} href="mailto:support@inventoryhub.example?subject=Order%20help"><Headphones aria-hidden="true" />Need help?</a>
      </aside>
    </div>
    <p className={styles.footnote}>Order ID <code>{order.orderId}</code><span>Total <strong>{formatINR(order.totalCents, order.currency)}</strong></span></p>
  </main>
}

export default function OrderTracking() {
  const params = useParams<{ orderId: string }>()
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId
  const validId = UUID_PATTERN.test(orderId ?? '')
  const [visible, setVisible] = useState(true)
  const query = useQuery({
    queryKey: ['order-tracking', orderId],
    queryFn: () => getOrder(orderId),
    enabled: validId && visible,
    retry: (failureCount, error) => !(error instanceof ApiError && error.code === 'NOT_FOUND') && failureCount < 3,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 30000),
    refetchInterval: current => {
      if (!visible || current.state.data && isFinal(current.state.data.status)) return false
      return Math.min(3000 * 2 ** Math.min(current.state.fetchFailureCount, 4), 48000)
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const onVisibilityChange = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    if (query.data) updateStatus(query.data.orderId, query.data.status)
  }, [query.data])

  useEffect(() => {
    document.title = query.data ? `Track order ${query.data.orderId.slice(0, 8)} | Inventory Hub` : 'Track your order | Inventory Hub'
  }, [query.data])

  const retry = useCallback(() => { void query.refetch() }, [query])
  if (!validId || query.error instanceof ApiError && query.error.code === 'NOT_FOUND') return <NotFoundState />
  if (query.data) return <TrackingDetails order={query.data} lastUpdatedAt={query.dataUpdatedAt} onRetry={retry} />
  if (query.isError) return <TrackingError retry={retry} />
  return <LoadingState />
}
