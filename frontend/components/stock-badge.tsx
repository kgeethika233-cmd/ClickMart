import { CheckCircle2, CircleAlert, XCircle } from 'lucide-react'

type Props = { availableCount: number; inStock?: boolean; highlighted?: boolean; className?: string }
export default function StockBadge({ availableCount, inStock = availableCount > 0, highlighted = false, className = '' }: Props) {
  const empty = !inStock || availableCount < 1
  const low = !empty && availableCount <= 5
  const quantity = `${availableCount} ${availableCount === 1 ? 'pc' : 'pcs'}`
  const label = empty ? `Out of stock · ${quantity}` : low ? `Only ${quantity} left` : `In stock · ${quantity}`
  const Icon = empty ? XCircle : low ? CircleAlert : CheckCircle2
  return <span className={`stock-badge ${empty ? 'stock-out' : low ? 'stock-low' : 'stock-in'} ${highlighted ? 'stock-updated' : ''} ${className}`} role="status"><Icon aria-hidden="true" />{label}</span>
}
