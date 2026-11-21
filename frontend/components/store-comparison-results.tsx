'use client'

import { ArrowRight, Clock3, MapPin, PackageCheck, Store as StoreIcon } from 'lucide-react'
import { formatINR } from '@/lib/format'
import type { StoreComparison } from '@/lib/compare'
import styles from './store-comparison.module.css'

type Props = {
  stores: StoreComparison[]
  onChoose: (store: StoreComparison) => void
}

function formatRupees(amount: number | null) {
  return amount === null ? '—' : formatINR(Math.round(amount * 100), 'INR')
}

function StoreBadges({ labels }: { labels: string[] }) {
  if (!labels.length) return null
  return <div className={styles.badges}>{labels.map(label => <span key={label} className={`${styles.badge} ${label === 'Best value' ? styles.bestBadge : ''}`}>{label}</span>)}</div>
}

function ItemBreakdown({ store }: { store: StoreComparison }) {
  return <ul className={styles.itemList}>
    {store.items.map(item => <li key={item.productId} className={!item.inStock ? styles.unavailable : ''}>
      <span className={styles.itemName}>{item.name}<small>Qty {item.quantity}</small></span>
      <span className={styles.itemPrice}>{item.unavailable ? 'Unavailable' : formatINR(item.priceCents * item.quantity, item.currency)}</span>
      {!item.unavailable && !item.inStock && <span className={styles.outOfStock}>Out of stock</span>}
      {!item.unavailable && item.availableQuantity > 0 && item.availableQuantity < item.quantity && <span className={styles.stockNote}>{item.availableQuantity} available</span>}
    </li>)}
  </ul>
}

function StoreHeading({ store }: { store: StoreComparison }) {
  return <div className={styles.storeHeading}>
    <span className={styles.storeIcon}><StoreIcon size={18} aria-hidden="true" /></span>
    <div className={styles.storeTitle}>
      <strong>{store.name}</strong>
      <span><MapPin size={13} aria-hidden="true" />{store.area}, {store.city}</span>
      <small>{store.address}</small>
    </div>
    <StoreBadges labels={store.badges} />
  </div>
}

function DeliveryStatus({ store }: { store: StoreComparison }) {
  return store.deliverable
    ? <span className={styles.deliverableStatus}>Can deliver</span>
    : <span className={styles.notDeliverableReason}>{store.notDeliverableReason}</span>
}

function ChooseButton({ store, onChoose }: { store: StoreComparison; onChoose: (store: StoreComparison) => void }) {
  return <button type="button" className={styles.chooseButton} disabled={!store.deliverable} onClick={() => onChoose(store)}>
    Choose this store <ArrowRight size={16} aria-hidden="true" />
  </button>
}

export function StoreComparisonResults({ stores, onChoose }: Props) {
  const deliverableCount = stores.filter(store => store.deliverable).length
  return <>
    {deliverableCount === 0 && <p className={styles.availabilityNotice} role="status"><PackageCheck size={17} aria-hidden="true" /> None of the stores can deliver to this location. Choose another area to compare nearby options.</p>}
    <div className={styles.desktopTableWrap}>
      <table className={styles.table}>
        <thead><tr><th scope="col" className={styles.rowHeader}>Compare stores</th>{stores.map(store => <th scope="col" key={store.storeId} className={!store.deliverable ? styles.unavailableStore : ''}><StoreHeading store={store} /></th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Distance</th>{stores.map(store => <td key={store.storeId} className={!store.deliverable ? styles.unavailableCell : ''}>{store.distanceKm.toFixed(1)} km</td>)}</tr>
          <tr><th scope="row">Delivery time</th>{stores.map(store => <td key={store.storeId} className={!store.deliverable ? styles.unavailableCell : ''}>{store.etaMinutes === null ? '—' : <span className={styles.eta}><Clock3 size={15} aria-hidden="true" />about {store.etaMinutes} min <small>({store.etaMinutes} to {store.etaMinutes + 10} min)</small></span>}</td>)}</tr>
          <tr><th scope="row">Item subtotal</th>{stores.map(store => <td key={store.storeId} className={!store.deliverable ? styles.unavailableCell : ''}>{formatRupees(store.subtotal)}</td>)}</tr>
          <tr><th scope="row">Delivery fee</th>{stores.map(store => <td key={store.storeId} className={!store.deliverable ? styles.unavailableCell : ''}>{formatRupees(store.deliveryFee)}</td>)}</tr>
          <tr className={styles.totalRow}><th scope="row">Total</th>{stores.map(store => <td key={store.storeId} className={!store.deliverable ? styles.unavailableCell : ''}>{formatRupees(store.total)}</td>)}</tr>
          <tr><th scope="row">Stock</th>{stores.map(store => <td key={store.storeId} className={!store.deliverable ? styles.unavailableCell : ''}><span className={store.inStockCount === store.totalCount && store.unavailableItems.length === 0 ? styles.stockComplete : styles.stockPartial}>{store.inStockCount} of {store.totalCount}</span>{store.unavailableItems.length > 0 && <small className={styles.unavailableNote}>{store.unavailableItems.length} unavailable</small>}</td>)}</tr>
          <tr><th scope="row">Status</th>{stores.map(store => <td key={store.storeId} className={!store.deliverable ? styles.unavailableCell : ''}><DeliveryStatus store={store} /></td>)}</tr>
          <tr><th scope="row">Basket items</th>{stores.map(store => <td key={store.storeId} className={!store.deliverable ? styles.unavailableCell : ''}><ItemBreakdown store={store} /></td>)}</tr>
        </tbody>
        <tfoot><tr><th scope="row">Choose</th>{stores.map(store => <td key={store.storeId} className={!store.deliverable ? styles.unavailableCell : ''}><ChooseButton store={store} onChoose={onChoose} /></td>)}</tr></tfoot>
      </table>
    </div>
    <div className={styles.mobileCards} aria-label="Store comparisons">
      {stores.map(store => <article className={`${styles.storeCard} ${!store.deliverable ? styles.unavailableCard : ''}`} key={store.storeId}>
        <StoreHeading store={store} />
        <DeliveryStatus store={store} />
        <dl className={styles.costs}>
          <div><dt>Distance</dt><dd>{store.distanceKm.toFixed(1)} km</dd></div>
          <div><dt>Delivery time</dt><dd>{store.etaMinutes === null ? '—' : `about ${store.etaMinutes} min (${store.etaMinutes} to ${store.etaMinutes + 10} min)`}</dd></div>
          <div><dt>Item subtotal</dt><dd>{formatRupees(store.subtotal)}</dd></div>
          <div><dt>Delivery fee</dt><dd>{formatRupees(store.deliveryFee)}</dd></div>
          <div className={styles.cardTotal}><dt>Total</dt><dd>{formatRupees(store.total)}</dd></div>
          <div><dt>Stock</dt><dd>{store.inStockCount} of {store.totalCount}{store.unavailableItems.length > 0 ? ` · ${store.unavailableItems.length} unavailable` : ''}</dd></div>
        </dl>
        <ItemBreakdown store={store} />
        <ChooseButton store={store} onChoose={onChoose} />
      </article>)}
    </div>
  </>
}

export function StoreComparisonSkeleton() {
  return <div className={styles.skeletonGrid} aria-label="Loading store comparisons" role="status">
    {[0, 1, 2].map(key => <div className={styles.skeletonCard} key={key}><span /><span /><span /><span /><span /></div>)}
  </div>
}
