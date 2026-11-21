'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Check, Copy, X } from 'lucide-react'
import { Dialog } from '@base-ui/react/dialog'
import { formatINR } from '@/lib/format'
import type { OrderItem, OrderStatus } from '@/types/contract'
import styles from './order-placed-dialog.module.css'

type OrderPlacedDialogProps = {
  open: boolean
  orderId: string
  totalCents: number
  currency: string
  items?: OrderItem[]
  storeName?: string
  deliveryStatus?: OrderStatus
  title?: string
  message?: string
  onOpenChange: (open: boolean) => void
}

const confettiPieces = [
  { x: 5, y: 0, drift: '-94px', spin: '260deg', color: 'var(--primary)' },
  { x: 14, y: 5, drift: '-68px', spin: '-180deg', color: '#f5a65b' },
  { x: 24, y: -2, drift: '-42px', spin: '330deg', color: '#75b98b' },
  { x: 34, y: 6, drift: '-22px', spin: '-240deg', color: '#f2c94c' },
  { x: 43, y: -4, drift: '-10px', spin: '200deg', color: '#a78bfa' },
  { x: 55, y: 2, drift: '8px', spin: '-330deg', color: '#f5a65b' },
  { x: 65, y: -3, drift: '26px', spin: '210deg', color: '#75b98b' },
  { x: 75, y: 4, drift: '48px', spin: '-260deg', color: '#f2c94c' },
  { x: 86, y: -2, drift: '70px', spin: '300deg', color: 'var(--primary)' },
  { x: 95, y: 6, drift: '96px', spin: '-180deg', color: '#a78bfa' },
  { x: 8, y: 12, drift: '-112px', spin: '-210deg', color: '#75b98b' },
  { x: 18, y: 16, drift: '-76px', spin: '250deg', color: '#f2c94c' },
  { x: 29, y: 13, drift: '-51px', spin: '-320deg', color: 'var(--primary)' },
  { x: 39, y: 20, drift: '-30px', spin: '180deg', color: '#f5a65b' },
  { x: 61, y: 17, drift: '32px', spin: '-220deg', color: '#a78bfa' },
  { x: 71, y: 13, drift: '52px', spin: '320deg', color: '#75b98b' },
  { x: 82, y: 18, drift: '81px', spin: '-280deg', color: '#f2c94c' },
  { x: 92, y: 12, drift: '112px', spin: '200deg', color: '#f5a65b' },
] as const

export default function OrderPlacedDialog({ open, orderId, totalCents, currency, items = [], storeName = 'Inventory Hub', deliveryStatus = 'PLACED', title = 'Yay! Your order is placed', message = "We’re getting it ready for you.", onOpenChange }: OrderPlacedDialogProps) {
  const [copyMessage, setCopyMessage] = useState('')

  const copyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderId)
      setCopyMessage('Order ID copied.')
    } catch {
      setCopyMessage('Could not copy the order ID. Select and copy it manually.')
    }
  }

  const trackHref = `/orders/${encodeURIComponent(orderId)}/track`

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Backdrop className={styles.backdrop} />
      <Dialog.Popup className={styles.popup}>
        <Dialog.Close className={styles.closeButton} aria-label="Close order confirmation"><X aria-hidden="true" /></Dialog.Close>
        <div className={styles.confetti} aria-hidden="true">
          {confettiPieces.map((piece, index) => <span
            key={index}
            className={styles.confettiPiece}
            style={{
              left: `${piece.x}%`,
              top: `${piece.y}%`,
              backgroundColor: piece.color,
              '--drift': piece.drift,
              '--spin': piece.spin,
              '--delay': `${index % 6 * 35}ms`,
            } as CSSProperties}
          />)}
        </div>
        <div className={styles.checkWrap} aria-hidden="true">
          <svg className={styles.checkSvg} viewBox="0 0 88 88" fill="none">
            <circle className={styles.checkCircle} cx="44" cy="44" r="38" />
            <path className={styles.checkPath} d="m27 45 11 11 24-26" />
          </svg>
        </div>
        <div className={styles.heading} role="status" aria-live="polite">
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          <Dialog.Description className={styles.description}>{message}</Dialog.Description>
        </div>
        <div className={styles.orderDetails}>
          <div className={styles.detailRow}>
            <span>Order ID</span>
            <div className={styles.orderIdGroup}>
              <strong className={styles.orderId}>{orderId}</strong>
              <button className={styles.copyButton} type="button" onClick={() => void copyOrderId()} aria-label="Copy order ID">
                {copyMessage === 'Order ID copied.' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div className={styles.detailRow}><span>Total</span><strong>{formatINR(totalCents, currency)}</strong></div>
          <div className={styles.detailRow}><span>Store</span><strong>{storeName}</strong></div>
          <div className={styles.detailRow}><span>Delivery status</span><strong>{deliveryStatus === 'PLACED' ? 'Order placed' : deliveryStatus === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'}</strong></div>
          {!!items.length && <ul className={styles.orderItems}>{items.map(item => <li key={item.productId}><span>{item.name} × {item.quantity}</span><strong>{formatINR(item.unitPriceCents * item.quantity, currency)}</strong></li>)}</ul>}
          <span className={styles.copyStatus} aria-live="polite">{copyMessage}</span>
        </div>
        <ol className={styles.progress} aria-label="Order progress">
          <li className={`${styles.progressStep} ${styles.progressActive}`}><span className={styles.progressDot} /><span>Placed</span></li>
          <li className={styles.progressTrack} aria-hidden="true" />
          <li className={styles.progressStep}><span className={styles.progressDot} /><span>Packing</span></li>
          <li className={styles.progressTrack} aria-hidden="true" />
          <li className={styles.progressStep}><span className={styles.progressDot} /><span>On the way</span></li>
        </ol>
        <div className={styles.actions}>
          <Link className={styles.primaryAction} href={trackHref}><Check aria-hidden="true" />Track order</Link>
          <div className={styles.secondaryActions}>
            <Link className={styles.secondaryAction} href="/orders">View my orders</Link>
            <Link className={styles.secondaryAction} href="/">Keep shopping</Link>
          </div>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}
