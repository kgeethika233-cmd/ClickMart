'use client'

import { expiryInfo } from '@/lib/expiry'

export default function ExpiryIndicator({ expiryDate, showExpired = false }: { expiryDate?: string | null; showExpired?: boolean }) {
  const info = expiryInfo(expiryDate)
  if (info.expiry_status === 'none') return null
  if (info.expiry_status === 'expired') return showExpired ? <span className="expiry-expired" role="status">Expired</span> : null
  const date = new Date(`${info.expiry_date}T00:00:00`)
  const formatted = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
  return <div className="expiry-details">{info.expiry_status === 'near_expiry' && <span className="expiry-badge">{info.badge}</span>}<span className="expiry-date">Best before {formatted}</span></div>
}
