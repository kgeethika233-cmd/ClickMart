'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, GitCompareArrows, RotateCcw } from 'lucide-react'
import type { Product } from '@/types/contract'
import { getStoreComparison } from '@/lib/compare'
import { loadUserLocation, subscribeToLocation, type StoredUserLocation } from '@/lib/location'
import styles from './product-compare-inline.module.css'

const OPEN_EVENT = 'product-compare:open'
function badges(labels: string[]) { return labels.length ? <div className={styles.badges}>{labels.map(label => <span className={styles.badge} key={label}>{label}</span>)}</div> : null }
export default function ProductCompareInline({ product, compact = false }: { product: Product; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [location, setLocation] = useState<StoredUserLocation | null>(null)
  const panelId = `product-compare-${product.productId}`
  useEffect(() => { setLocation(loadUserLocation()); return subscribeToLocation(setLocation) }, [])
  useEffect(() => {
    const handler = (event: Event) => setOpen((event as CustomEvent<number>).detail === product.productId)
    window.addEventListener(OPEN_EVENT, handler)
    return () => window.removeEventListener(OPEN_EVENT, handler)
  }, [product.productId])
  const query = useQuery({ queryKey: ['product-inline-comparison', product.productId, location], queryFn: () => getStoreComparison([{ productId: product.productId, quantity: 1 }], location!), enabled: open && !!location, retry: false })
  const toggle = () => {
    const next = !open
    if (next) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: product.productId }))
    else setOpen(false)
  }
  return <div className={`${styles.root} ${compact ? styles.compact : ''}`}>
    <button type="button" className={styles.trigger} aria-expanded={open} aria-controls={panelId} onClick={toggle}><GitCompareArrows aria-hidden="true" />Compare {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</button>
    {open && <section className={styles.panel} id={panelId} aria-label={`Store comparison for ${product.name}`}>
      <div className={styles.heading}><div><strong>Compare nearby stores</strong><span>{location ? `Delivery options near ${location.name}, ${location.city}` : 'Compare prices, delivery and stock by store.'}</span></div><Link href="/compare">Compare full basket</Link></div>
      {!location && <div className={styles.state}>Set your location to compare. <Link href="/compare#locationPanel">Choose a location</Link></div>}
      {location && query.isPending && <div className={styles.loading} role="status" aria-label="Loading comparisons"><span/><span/><span/></div>}
      {location && query.isError && <div className={styles.state} role="alert">We couldn&apos;t load store options. <button type="button" onClick={() => void query.refetch()}><RotateCcw aria-hidden="true"/>Retry</button></div>}
      {location && query.data && query.data.length === 0 && <p className={styles.state}>No store options are available for this product.</p>}
      {location && query.data && query.data.length > 0 && <>
        <div className={styles.desktopTable}><table><thead><tr><th scope="col">Store / channel</th><th scope="col">Price</th><th scope="col">Distance</th><th scope="col">Delivery time</th><th scope="col">Delivery fee</th><th scope="col">Stock</th><th scope="col">Delivery status</th></tr></thead><tbody>{query.data.slice(0, 4).map(store => <tr className={!store.deliverable ? styles.unavailable : ''} key={store.storeId}><th scope="row">{store.name}{badges(store.badges)}</th><td>₹{((store.items[0]?.priceCents ?? product.priceCents) / 100).toLocaleString('en-IN')}</td><td>{store.distanceKm.toFixed(1)} km</td><td>{store.etaMinutes === null ? '—' : `${store.etaMinutes}–${store.etaMinutes + 10} min`}</td><td>{store.deliveryFee === null ? '—' : `₹${store.deliveryFee}`}</td><td>{store.items[0]?.availableQuantity ?? 0} available</td><td>{store.deliverable ? store.items[0]?.inStock ? 'Can deliver' : 'Out of stock' : 'Not deliverable to your location'}</td></tr>)}</tbody></table></div>
        <div className={styles.mobileRows}>{query.data.slice(0, 4).map(store => <article className={`${styles.storeRow} ${!store.deliverable ? styles.unavailable : ''}`} key={store.storeId}><header><strong>{store.name}</strong>{badges(store.badges)}</header><dl><div><dt>Price</dt><dd>₹{((store.items[0]?.priceCents ?? product.priceCents) / 100).toLocaleString('en-IN')}</dd></div><div><dt>Distance</dt><dd>{store.distanceKm.toFixed(1)} km</dd></div><div><dt>Delivery time</dt><dd>{store.etaMinutes === null ? '—' : `${store.etaMinutes}–${store.etaMinutes + 10} min`}</dd></div><div><dt>Delivery fee</dt><dd>{store.deliveryFee === null ? '—' : `₹${store.deliveryFee}`}</dd></div><div><dt>Stock</dt><dd>{store.items[0]?.availableQuantity ?? 0} available</dd></div></dl><p>{store.deliverable ? store.items[0]?.inStock ? 'Can deliver' : 'Out of stock' : 'Not deliverable to your location'}</p></article>)}</div>
      </>}
    </section>}
  </div>
}
