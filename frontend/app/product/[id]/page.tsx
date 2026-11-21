'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingCart } from 'lucide-react'
import { ApiError, getProduct } from '@/lib/api'
import { notifyCartAdded } from '@/lib/notify-store'
import { formatINR } from '@/lib/format'
import { useCart } from '@/context/CartContext'
import type { Product } from '@/types/contract'
import WishlistButton from '@/components/wishlist-button'
import ExpiryIndicator from '@/components/expiry-indicator'
import StockBadge from '@/components/stock-badge'
import { useLiveStock } from '@/hooks/use-live-stock'
import { useUserLocation } from '@/hooks/use-user-location'
import { getProductStoreOptions, haversineKm } from '@/lib/compare'
import { getAreasForCity } from '@/lib/mock-locations'

function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false)
  return <div className="detail-image">{product.imageUrl && !failed ? <img src={product.imageUrl} alt={product.name} onError={() => setFailed(true)} /> : <div className="image-placeholder" aria-label="Product image unavailable"><ShoppingCart size={42} /></div>}</div>
}

export default function ProductPage() {
  const params = useParams<{ id: string }>()
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id
  const id = /^\d+$/.test(rawId ?? '') ? Number(rawId) : NaN
  const validId = Number.isSafeInteger(id) && id > 0
  const { addItem, items, setQuantity: setCartQuantity, removeItem } = useCart()
  const location = useUserLocation()
  const [quantity, setQuantity] = useState(1)
  const query = useQuery({ queryKey: ['product', id], queryFn: () => getProduct(id), enabled: validId, refetchOnWindowFocus: true })
  const nearbyStores = location && query.data ? getProductStoreOptions(query.data, location) : []
  const nearestStore = nearbyStores[0]
  const storeArea = nearestStore && getAreasForCity(nearestStore.city).find(area => area.name === nearestStore.area)
  const distanceKm = location && storeArea ? haversineKm(location, storeArea) : nearestStore?.distanceKm
  const storeAvailability = nearestStore?.items[0]
  const readStock = useLiveStock([{ productId: validId ? id : 0, availableCount: storeAvailability?.availableQuantity ?? query.data?.availableCount ?? 0, inStock: storeAvailability?.inStock ?? query.data?.inStock ?? false }])
  const currentStock = readStock(validId ? id : 0)
  useEffect(() => { document.title = query.data ? `${query.data.name} | Inventory Hub` : 'Product | Inventory Hub' }, [query.data])
  useEffect(() => { if (currentStock.availableCount > 0) setQuantity(value => Math.min(value, currentStock.availableCount, 10)) }, [currentStock.availableCount])

  if (!validId || (query.error instanceof ApiError && query.error.code === 'NOT_FOUND')) return <main className="wrap commerce-page"><div className="state-card"><span className="state-icon">?</span><h1>Product not found</h1><p>We couldn&apos;t find that product. It may have been removed or the link may be incorrect.</p><Link className="primary-action" href="/">Continue shopping <ArrowRight size={17} /></Link></div></main>
  if (query.isPending) return <main className="wrap commerce-page"><div className="detail-skeleton"><div /><div /></div></main>
  if (query.isError) return <main className="wrap commerce-page"><div className="state-card"><h1>We couldn&apos;t load this product</h1><p>{query.error.message}</p><button className="primary-action" onClick={() => void query.refetch()}>Retry</button></div></main>

  const product = query.data
  const displayProduct = { ...product, distance_km: distanceKm, delivery_fee: nearestStore?.deliveryFee ?? product.delivery_fee, delivery_time_mins: nearestStore?.etaMinutes ?? product.delivery_time_mins, delivery_status: nearestStore ? nearestStore.deliverable ? 'deliverable' : 'not_deliverable' : product.delivery_status }
  const addableProduct = { ...displayProduct, availableCount: currentStock.availableCount, inStock: currentStock.inStock }
  const max = Math.max(1, Math.min(10, currentStock.availableCount))
  return <main className="wrap commerce-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href={`/search?category=${encodeURIComponent(product.category)}`}>{product.category}</Link><span>/</span><span aria-current="page">{product.name}</span></nav>
    <section className="product-detail"><ProductImage product={product} /><div className="product-info"><div className="badge-row"><span className="soft-badge">{product.category}</span><span className="soft-badge">{product.city}</span><StockBadge availableCount={currentStock.availableCount} inStock={currentStock.inStock} highlighted={currentStock.highlighted} /></div><p className="product-sku">SKU {product.sku}</p><h1>{product.name}</h1><p className="product-description">{product.description}</p>{location && nearestStore && <p className="product-delivery-note">{distanceKm?.toFixed(1)} km · {displayProduct.delivery_time_mins ?? '—'} min · {displayProduct.delivery_fee === undefined || displayProduct.delivery_fee === null ? '—' : `₹${displayProduct.delivery_fee}`} delivery{!nearestStore.deliverable ? ' · Not deliverable to your location' : ''}</p>}<ExpiryIndicator expiryDate={product.expiry_date} showExpired/><div className="detail-price">{formatINR(product.priceCents, product.currency)}</div><div className="detail-buy"><div className="quantity-control" aria-label="Quantity"><button aria-label="Decrease quantity" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}><Minus size={16} /></button><span aria-live="polite">{quantity}</span><button aria-label="Increase quantity" onClick={() => setQuantity(q => Math.min(max, q + 1))} disabled={quantity >= max}><Plus size={16} /></button></div><WishlistButton productId={product.productId} product={product} placement="detail"/><button className="primary-action add-action" disabled={!currentStock.inStock || currentStock.availableCount < 1 || product.expiry_status === 'expired'} onClick={() => { const previous = items.find(item => item.productId === product.productId)?.quantity ?? 0; for (let i = 0; i < quantity; i++) addItem(addableProduct); notifyCartAdded(addableProduct, Math.min(previous + quantity, currentStock.availableCount, 10), () => previous ? setCartQuantity(product.productId, previous) : removeItem(product.productId)) }}><ShoppingCart size={18} />Add to cart</button></div><p className="stock-note">{currentStock.inStock ? 'Ready to ship from our local inventory.' : 'This item is currently unavailable.'}</p></div></section>
    <Link href="/" className="back-link"><ArrowLeft size={16} /> Back to shopping</Link>
  </main>
}
