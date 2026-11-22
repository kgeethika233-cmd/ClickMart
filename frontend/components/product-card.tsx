'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ImageOff, MapPin, ShoppingCart, CheckCircle2 } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { notifyCartAdded } from '@/lib/notify-store'
import type { Product } from '@/types/contract'
import { formatINR } from '@/lib/format'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import WishlistButton from './wishlist-button'
import ExpiryIndicator from './expiry-indicator'
import StockBadge from './stock-badge'
import ProductCompareInline from './product-compare-inline'
import { useLiveStock } from '@/hooks/use-live-stock'
import { useUserLocation } from '@/hooks/use-user-location'
import { getProductStoreOptions, haversineKm } from '@/lib/compare'
import { getAreasForCity } from '@/lib/mock-locations'
import styles from './wishlist-button.module.css'
export default function ProductCard({ product: p, showCartAction = true }: { product: Product; showCartAction?: boolean }) {
  const [failed, setFailed] = useState(false)
  const { addItem, items, setQuantity, removeItem } = useCart()
  const location = useUserLocation()
  const nearbyStores = location ? getProductStoreOptions(p, location) : []
  const nearestStore = nearbyStores[0]
  const storeArea = nearestStore && getAreasForCity(nearestStore.city).find(area => area.name === nearestStore.area)
  const distanceKm = location && storeArea ? haversineKm(location, storeArea) : nearestStore?.distanceKm
  const storeAvailability = nearestStore?.items[0]
  const initialCount = storeAvailability?.availableQuantity ?? p.availableCount
  const initialInStock = storeAvailability?.inStock ?? p.inStock
  const currentStock = useLiveStock([{ productId: p.productId, availableCount: initialCount, inStock: initialInStock }])(p.productId)
  if (p.expiry_status === 'expired') return null
  const cartQuantity = items.find(item => item.productId === p.productId)?.quantity ?? 0
  const full = !currentStock.inStock || cartQuantity >= Math.min(currentStock.availableCount, 10)
  const displayProduct = { ...p, distance_km: distanceKm, delivery_fee: nearestStore?.deliveryFee ?? p.delivery_fee, delivery_time_mins: nearestStore?.etaMinutes ?? p.delivery_time_mins, delivery_status: nearestStore ? nearestStore.deliverable ? 'deliverable' : 'not_deliverable' : p.delivery_status }
  const addableProduct = { ...displayProduct, availableCount: currentStock.availableCount, inStock: currentStock.inStock }
  return <article className="product"><div className={styles.cardPhoto}><Link href={'/product/' + p.productId} className="photo" aria-label={`View ${p.name}`}>{p.imageUrl && !failed ? <picture><img src={p.imageUrl} alt={p.name} onError={() => setFailed(true)} /></picture> : <span className="fallback" role="img" aria-label="Image unavailable"><ImageOff /></span>}<Badge className="category-tag" data-category={p.category}>{p.category}</Badge></Link><WishlistButton productId={p.productId} product={p} /></div><div className="product-body"><StockBadge availableCount={currentStock.availableCount} inStock={currentStock.inStock} highlighted={currentStock.highlighted} /><h3><Link href={'/product/' + p.productId}>{p.name}</Link></h3><p className="city"><MapPin size={14} />{p.city}</p>{location && nearestStore && <p className="product-delivery-note">{distanceKm?.toFixed(1)} km · {displayProduct.delivery_time_mins === undefined || displayProduct.delivery_time_mins === null ? '—' : `${displayProduct.delivery_time_mins} min`} · {displayProduct.delivery_fee === undefined || displayProduct.delivery_fee === null ? '—' : `₹${displayProduct.delivery_fee}`} delivery{!nearestStore.deliverable ? ' · Not deliverable to your location' : ''}</p>}<ExpiryIndicator expiryDate={p.expiry_date} /><div className="buy"><strong>{formatINR(p.priceCents, p.currency)}</strong>{showCartAction && <Button size="sm" variant="outline" disabled={full} onClick={() => { const previous = cartQuantity; addItem(addableProduct); notifyCartAdded(addableProduct, previous + 1, () => previous ? setQuantity(p.productId, previous) : removeItem(p.productId)) }}>{full ? <CheckCircle2 data-icon="inline-start" aria-hidden="true" /> : <ShoppingCart data-icon="inline-start" />}{full ? 'Limit reached' : 'Add to cart'}</Button>}</div><ProductCompareInline product={p} /></div></article>
}
