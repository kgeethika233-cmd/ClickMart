'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { getProduct } from '@/lib/api'
import { formatINR } from '@/lib/format'
import StockBadge from '@/components/stock-badge'
import ExpiryIndicator from '@/components/expiry-indicator'
import { useLiveStock } from '@/hooks/use-live-stock'
import { useUserLocation } from '@/hooks/use-user-location'
import { getProductStoreOptions, haversineKm } from '@/lib/compare'
import { getAreasForCity } from '@/lib/mock-locations'

function CartImage({ src, name }: { src: string | null; name: string }) {
  return <div className="cart-image">{src ? <img src={src} alt={name} onError={e => { e.currentTarget.style.display = 'none' }} /> : <ShoppingBag size={22} aria-hidden="true" />}</div>
}

export default function CartPage() {
  const location = useUserLocation()
  const { items, setQuantity, removeItem, updateAvailability, subtotalCents, isReady } = useCart()
  const products = useQueries({ queries: items.map(item => ({ queryKey: ['product', item.productId], queryFn: () => getProduct(item.productId), staleTime: 0, refetchOnMount: 'always' as const })) })
  const readStock = useLiveStock(items.map((item, index) => { const product = products[index]?.data; const storeItem = location && product ? getProductStoreOptions(product, location)[0]?.items[0] : undefined; return { productId: item.productId, availableCount: storeItem?.availableQuantity ?? product?.availableCount ?? item.maxQuantity, inStock: storeItem?.inStock ?? product?.inStock ?? item.maxQuantity > 0 } }))
  const [adjustedStock, setAdjustedStock] = useState<Record<number, number>>({})

  useEffect(() => { document.title = 'Cart | Inventory Hub' }, [])
  useEffect(() => {
    items.forEach((item, index) => {
      const product = products[index]?.data
      if (!product) return
      const stock = readStock(item.productId)
      if (stock.availableCount < item.quantity) setAdjustedStock(current => current[item.productId] === stock.availableCount ? current : { ...current, [item.productId]: stock.availableCount })
      updateAvailability(item.productId, stock.inStock ? stock.availableCount : 0)
    })
  }, [items, products, readStock, updateAvailability])

  if (!isReady) return <main className="wrap commerce-page"><div className="cart-skeleton" aria-label="Loading cart"><div /><div /></div></main>
  if (!items.length) return <main className="wrap commerce-page"><div className="state-card empty-cart"><span className="state-icon"><ShoppingBag /></span><h1>Your cart is empty</h1><p>Looks like you haven&apos;t added anything to your cart yet.</p><Link className="primary-action" href="/">Continue shopping <ArrowRight size={17} /></Link></div></main>

  const hasUnavailable = items.some((item, index) => { const product = products[index]?.data; return !readStock(item.productId).inStock || product?.expiry_status === 'expired' })
  return <main className="wrap commerce-page"><div className="cart-heading"><div><p className="eyebrow">YOUR BASKET</p><h1>Shopping cart <span>({items.reduce((sum, item) => sum + item.quantity, 0)} items)</span></h1></div><Link href="/" className="back-link"><ArrowRight size={16} /> Continue shopping</Link></div>
    <div className="cart-layout"><section className="cart-list" aria-label="Cart items">{items.map((item, index) => {
      const refresh = products[index]
      const fresh = refresh?.data
      const store = location && fresh ? getProductStoreOptions(fresh, location)[0] : undefined
      const storeArea = store && getAreasForCity(store.city).find(area => area.name === store.area)
      const distanceKm = location && storeArea ? haversineKm(location, storeArea) : store?.distanceKm
      const stock = readStock(item.productId)
      const outOfStock = !stock.inStock
      const expired = fresh?.expiry_status === 'expired'
      const maxQuantity = Math.max(1, Math.min(10, stock.availableCount))
      const reduced = adjustedStock[item.productId] !== undefined
      return <article className="cart-item" key={item.productId}><CartImage src={item.imageUrl} name={item.name} /><div className="cart-item-main"><div className="cart-item-title"><div><Link href={`/product/${item.productId}`} className="cart-product-name">{item.name}</Link><p>{formatINR(item.priceCents, item.currency)} <span>per item</span></p>{location && store && <p className="product-delivery-note">{distanceKm?.toFixed(1)} km · {store.etaMinutes ?? '—'} min · {store.deliveryFee === null ? '—' : `₹${store.deliveryFee}`} delivery{!store.deliverable ? ' · Not deliverable to your location' : ''}</p>}</div><button className="icon-button remove-button" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.productId)}><Trash2 size={17} /></button></div>
        <div className="flex flex-wrap items-center gap-2"><StockBadge availableCount={stock.availableCount} inStock={stock.inStock} highlighted={stock.highlighted} />{outOfStock && <span className="text-xs text-muted-foreground">Remove to continue</span>}</div>
        <ExpiryIndicator expiryDate={fresh?.expiry_date} showExpired />
        {expired && <p className="quantity-notice" role="status">This item has expired and can&apos;t be checked out.</p>}
        {reduced && <p className="quantity-notice" role="status">{adjustedStock[item.productId] === 0 ? 'Stock is now unavailable. Remove this item to continue.' : `Quantity adjusted to ${adjustedStock[item.productId]} because stock changed.`}</p>}
        {refresh?.isError && <p className="refresh-error">Could not refresh availability</p>}
        <div className="cart-item-bottom"><div className="quantity-control" aria-label={`Quantity for ${item.name}`}><button aria-label="Decrease quantity" onClick={() => { setQuantity(item.productId, item.quantity - 1); setAdjustedStock(current => { const next = { ...current }; delete next[item.productId]; return next }) }} disabled={item.quantity <= 1}><Minus size={15} /></button><span>{item.quantity}</span><button aria-label="Increase quantity" onClick={() => setQuantity(item.productId, item.quantity + 1)} disabled={item.quantity >= maxQuantity || outOfStock || expired}><Plus size={15} /></button></div><strong className="line-total">{formatINR(item.priceCents * item.quantity, item.currency)}</strong></div></div></article>
    })}</section>
    <aside className="order-summary"><h2>Order summary</h2><div className="summary-row"><span>Subtotal</span><strong>{formatINR(subtotalCents, items[0]?.currency ?? 'INR')}</strong></div><p className="demo-note">Shipping and payment are simulated in this demo</p><Link className="summary-continue" href="/">Continue shopping</Link><Link className={`primary-action checkout-action ${hasUnavailable ? 'is-disabled' : ''}`} aria-disabled={hasUnavailable} href={hasUnavailable ? '#' : '/checkout'} onClick={e => { if (hasUnavailable) e.preventDefault() }}>Proceed to checkout <ArrowRight size={17} /></Link>{hasUnavailable && <p className="checkout-warning"><AlertTriangle size={15} /> Remove expired or out-of-stock items to continue.</p>}<Link className="summary-continue" href="/compare">Compare stores</Link></aside></div>
  </main>
}
