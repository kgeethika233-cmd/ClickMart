'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AlertCircle, ArrowRight, Check, CircleCheck, Clock3, LoaderCircle } from 'lucide-react'
import { ApiError, getOrder } from '@/lib/api'
import { formatINR } from '@/lib/format'
import type { Order } from '@/types/contract'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function OrderSkeleton() {
  return <div className="order-skeleton" aria-label="Loading order"><div /><div /><div /></div>
}

function OrderNotFound() {
  return <main className="wrap commerce-page"><div className="state-card"><span className="state-icon">?</span><h1>Order not found</h1><p>We couldn&apos;t find that order. Check the link or return to the store.</p><Link className="primary-action" href="/">Continue shopping <ArrowRight size={17} /></Link></div></main>
}

function OrderDetails({ order, reconnecting, timedOut, onRefresh }: { order: Order; reconnecting: boolean; timedOut: boolean; onRefresh: () => void }) {
  const confirmed = order.status === 'CONFIRMED'
  const canceled = order.status === 'CANCELLED'
  return <main className="wrap commerce-page order-page">
    <div className={`order-banner ${confirmed ? 'order-banner-success' : canceled ? 'order-banner-cancelled' : ''}`}>
      <div className="order-banner-icon">{confirmed ? <CircleCheck /> : canceled ? <AlertCircle /> : <LoaderCircle className="spin" />}</div>
      <div className="order-banner-copy"><p className="eyebrow">ORDER STATUS</p><h1>{confirmed ? 'Your order is confirmed' : canceled ? 'This order was cancelled' : 'Order placed successfully'}</h1><p>{confirmed ? `A confirmation email is on its way to ${order.customerEmail}.` : canceled ? 'This order was cancelled. Please contact support if you need help.' : 'We’re getting your order ready.'}</p></div>
      <span className={`order-status-badge ${confirmed ? 'confirmed' : canceled ? 'cancelled' : ''}`}>{order.status}</span>
    </div>
    <div className="order-progress" aria-label="Order progress"><div className="progress-step complete"><span><Check size={16} /></span><div><strong>Order placed</strong><small>We received your order</small></div></div><div className={`progress-connector ${confirmed ? 'complete' : ''}`} /><div className={`progress-step ${confirmed ? 'complete' : ''}`}><span>{confirmed ? <Check size={16} /> : <span className="progress-dot" />}</span><div><strong>Confirmed</strong><small>{confirmed ? 'Your order is confirmed' : 'Awaiting confirmation'}</small></div></div></div>
    {!confirmed && !canceled && <div className="processing-note" role="status">{timedOut ? <><p>Still processing. You&apos;ll get an email once it&apos;s confirmed.</p><button type="button" className="secondary-action" onClick={onRefresh}><Clock3 size={15} /> Refresh</button></> : <p><span className="processing-pulse" /> Processing your order...</p>}{reconnecting && <small className="reconnecting-note">Reconnecting...</small>}</div>}
    <section className="order-card"><div className="order-card-heading"><div><h2>Order details</h2><p>Order ID <code>{order.orderId}</code></p></div><span className={`order-status-badge ${confirmed ? 'confirmed' : canceled ? 'cancelled' : ''}`}>{order.status}</span></div><div className="order-metadata"><div><small>Placed</small><strong>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt))}</strong></div><div><small>Email</small><strong>{order.customerEmail}</strong></div></div><div className="order-lines">{order.items.map(item => <div className="order-line" key={item.productId}><div><strong>{item.name}</strong><span>Quantity {item.quantity} · {formatINR(item.unitPriceCents, order.currency)} each</span></div><b>{formatINR(item.unitPriceCents * item.quantity, order.currency)}</b></div>)}</div><div className="order-total"><span>Total</span><strong>{formatINR(order.totalCents, order.currency)}</strong></div></section>
    <Link href="/" className="primary-action order-continue">Continue shopping <ArrowRight size={17} /></Link>
  </main>
}

export default function OrderStatusPage() {
  const params = useParams<{ orderId: string }>()
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId
  const validId = UUID_PATTERN.test(orderId ?? '')
  const [timedOut, setTimedOut] = useState(false)
  const [pollCycle, setPollCycle] = useState(0)
  const query = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(orderId),
    enabled: validId,
    retry: false,
    refetchInterval: current => current.state.data?.status === 'CONFIRMED' || current.state.data?.status === 'CANCELLED' || timedOut ? false : 2000,
    refetchOnWindowFocus: false,
  })
  const confirmed = query.data?.status === 'CONFIRMED'

  useEffect(() => {
    document.title = query.data ? `Order ${query.data.orderId.slice(0, 8)} | Inventory Hub` : 'Order status | Inventory Hub'
  }, [query.data])
  useEffect(() => {
    if (!validId || confirmed) return
    const timer = window.setTimeout(() => setTimedOut(true), 60_000)
    return () => window.clearTimeout(timer)
  }, [validId, confirmed, pollCycle])

  const refreshOrder = () => { setTimedOut(false); setPollCycle(cycle => cycle + 1); void query.refetch() }
  if (!validId || (query.error instanceof ApiError && query.error.code === 'NOT_FOUND')) return <OrderNotFound />
  if (query.data) return <OrderDetails order={query.data} reconnecting={query.isError} timedOut={timedOut} onRefresh={refreshOrder} />
  return <main className="wrap commerce-page">{timedOut ? <div className="processing-note timeout-note" role="status"><p>Still processing. You&apos;ll get an email once it&apos;s confirmed.</p><button type="button" className="secondary-action" onClick={refreshOrder}><Clock3 size={15} /> Refresh</button></div> : <>{query.isError && <p className="reconnecting-note initial-reconnect">Reconnecting...</p>}<OrderSkeleton /></>}</main>
}
