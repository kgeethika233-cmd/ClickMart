'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Heart, ShoppingCart, X } from 'lucide-react'
import type { AppNotice } from '@/lib/notify-store'
import { subscribeToNotices } from '@/lib/notify-store'
import { formatINR } from '@/lib/format'
import OrderPlacedDialog from '@/components/order-placed-dialog'
import styles from './notify.module.css'

type ToastNotice = Extract<AppNotice, { type: 'cart' | 'wishlist' }>

export default function Notify() {
  const [notices, setNotices] = useState<ToastNotice[]>([])
  const [orderNotice, setOrderNotice] = useState<Extract<AppNotice, { type: 'order' }> | null>(null)
  const timers = useRef(new Map<string, number>())
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => subscribeToNotices(notice => {
    if (notice.type === 'order') { setOrderNotice(notice); return }
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setNotices(current => [...current, notice].slice(-3))
  }), [])
  useEffect(() => {
    const activeIds = new Set(notices.map(notice => notice.id))
    timers.current.forEach((timer, id) => { if (!activeIds.has(id)) { window.clearTimeout(timer); timers.current.delete(id) } })
    notices.forEach(notice => {
      if (timers.current.has(notice.id)) return
      timers.current.set(notice.id, window.setTimeout(() => dismiss(notice), 4000))
    })
  }, [notices])
  useEffect(() => () => { timers.current.forEach(timer => window.clearTimeout(timer)); timers.current.clear() }, [])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !notices.length) return
      event.preventDefault()
      const latest = notices[notices.length - 1]
      setNotices(current => current.filter(notice => notice.id !== latest.id))
      if (latest && document.activeElement instanceof HTMLElement && document.activeElement.closest(`[data-notice="${latest.id}"]`)) returnFocus.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [notices])
  const dismiss = (notice: ToastNotice) => {
    const timer = timers.current.get(notice.id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(notice.id)
    if (document.activeElement instanceof HTMLElement && document.activeElement.closest(`[data-notice="${notice.id}"]`)) returnFocus.current?.focus()
    setNotices(current => current.filter(item => item.id !== notice.id))
  }

  return <>
    <div className={styles.stack} aria-label="Notifications">
      {notices.map(notice => notice.type === 'cart' ? <section className={`${styles.toast} ${styles.cartToast}`} role="status" key={notice.id} data-notice={notice.id}>
        {notice.product.imageUrl ? <img src={notice.product.imageUrl} alt="" /> : <span className={styles.imageFallback}><ShoppingCart size={17} /></span>}
        <div className={styles.copy}><strong>Added to cart</strong><span>{notice.product.name} · Qty {notice.quantity}</span></div>
        <Link href="/cart" className={styles.action}>View cart</Link>
        <button className={styles.undo} onClick={() => { notice.undo(); dismiss(notice) }}>Undo</button>
        <button className={styles.close} aria-label="Dismiss notification" onClick={() => dismiss(notice)}><X size={15} /></button>
      </section> : <section className={`${styles.toast} ${styles.wishToast}`} role="status" key={notice.id} data-notice={notice.id}>
        <Heart className={styles.heart} fill="currentColor" aria-hidden="true" />
        <div className={styles.copy}><strong>{notice.saved ? 'Saved to wishlist' : 'Removed from wishlist'}</strong><span>{notice.product.name}</span></div>
        {notice.saved && <Link href="/wishlist" className={styles.action}>View wishlist</Link>}
        <button className={styles.undo} onClick={() => { notice.undo(); dismiss(notice) }}>Undo</button>
        <button className={styles.close} aria-label="Dismiss notification" onClick={() => dismiss(notice)}><X size={15} /></button>
      </section>)}
    </div>
    {orderNotice && <OrderPlacedDialog
      open
      orderId={orderNotice.order.orderId}
      totalCents={orderNotice.order.totalCents}
      currency={orderNotice.order.currency}
      items={orderNotice.order.items}
      storeName={orderNotice.storeName}
      deliveryStatus={orderNotice.order.status}
      title={orderNotice.title}
      message={orderNotice.message}
      onOpenChange={open => { orderNotice.onClose?.(open); if (!open) setOrderNotice(null) }}
    />}
  </>
}
