'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, LocateFixed, MapPin, RotateCcw, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { useCart } from '@/context/CartContext'
import { getStoreComparison, type StoreComparison, type UserLocation } from '@/lib/compare'
import { getOrder } from '@/lib/api'
import { USE_MOCK } from '@/lib/config'
import { getAreasForCity, MOCK_LOCATIONS } from '@/lib/mock-locations'
import { loadUserLocation, saveUserLocation, subscribeToLocation } from '@/lib/location'
import { getAuthToken, updateLocation } from '@/lib/api'
import { getOrders, type LocalOrder } from '@/lib/orders-local'
import { formatINR } from '@/lib/format'
import { StoreComparisonResults, StoreComparisonSkeleton } from '@/components/store-comparison-results'
import styles from './store-comparison.module.css'

type Source = 'cart' | 'order'
const PREFERRED_STORE_KEY = 'preferred-store:v1'

type StoredLocation = UserLocation

function getDistanceKm(lat: number, lng: number, otherLat: number, otherLng: number) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latDiff = radians(otherLat - lat)
  const lngDiff = radians(otherLng - lng)
  const a = Math.sin(latDiff / 2) ** 2 + Math.cos(radians(lat)) * Math.cos(radians(otherLat)) * Math.sin(lngDiff / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function nearestSampleLocation(lat: number, lng: number): StoredLocation {
  const candidates = MOCK_LOCATIONS.flatMap(entry => entry.areas.map(area => ({ ...area, city: entry.city })))
  const nearest = candidates.reduce((best, area) => getDistanceKm(lat, lng, area.lat, area.lng) < getDistanceKm(lat, lng, best.lat, best.lng) ? area : best)
  return { ...nearest, name: 'Current location' , lat, lng }
}

function PageSkeleton() {
  return <main className={`wrap commerce-page ${styles.page}`}><div className={styles.skeletonTitle}><span /><span /></div><StoreComparisonSkeleton /></main>
}

export default function StoreComparisonPage() {
  const { items: cartItems, isReady: cartReady } = useCart()
  const [source, setSource] = useState<Source>('cart')
  const [orders, setOrders] = useState<LocalOrder[]>([])
  const [ordersReady, setOrdersReady] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [city, setCity] = useState(MOCK_LOCATIONS[0].city)
  const [areaPincode, setAreaPincode] = useState('')
  const [location, setLocation] = useState<StoredLocation | null>(null)
  const [locationReady, setLocationReady] = useState(false)
  const [locationError, setLocationError] = useState('')

  useEffect(() => {
    setOrders(getOrders())
    setOrdersReady(true)
    const saved = loadUserLocation()
    if (saved) {
      setLocation(saved)
      setCity(saved.city)
      setAreaPincode(saved.name === 'Current location' ? 'current' : saved.pincode)
    }
    setLocationReady(true)
    return subscribeToLocation(next => {
      setLocation(next)
      if (next) { setCity(next.city); setAreaPincode(next.name === 'Current location' ? 'current' : next.pincode) }
    })
  }, [])

  useEffect(() => {
    if (orders.length && !selectedOrderId) setSelectedOrderId(orders[0].orderId)
  }, [orders, selectedOrderId])

  const saveLocation = (next: StoredLocation | null) => {
    setLocation(next)
    setLocationError('')
    if (!saveUserLocation(next) && next) setLocationError('Your browser could not save this location. You can still compare stores for this visit.')
    if (next && getAuthToken()) void updateLocation({ city: next.city, lat: next.lat, lng: next.lng }).catch(() => {})
  }

  const selectArea = (pincode: string) => {
    setAreaPincode(pincode)
    const area = getAreasForCity(city).find(candidate => candidate.pincode === pincode)
    if (area) saveLocation({ ...area, city })
    else if (!pincode) saveLocation(null)
  }

  const changeCity = (nextCity: string) => {
    setCity(nextCity)
    setAreaPincode('')
    saveLocation(null)
  }

  const useCurrentLocation = () => {
    setLocationError('')
    if (!navigator.geolocation) {
      setLocationError('Location access is not available in this browser. Choose a city and area instead.')
      return
    }
    navigator.geolocation.getCurrentPosition(position => {
      const next = nearestSampleLocation(position.coords.latitude, position.coords.longitude)
      setCity(next.city)
      setAreaPincode('current')
      saveLocation(next)
    }, () => {
      setLocationError('We could not access your location. Check browser permission or choose a city and area instead.')
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 })
  }

  const orderQuery = useQuery({
    queryKey: ['comparison-order', selectedOrderId],
    queryFn: async () => {
      const savedItems = orders.find(order => order.orderId === selectedOrderId)?.items
      if (savedItems?.length) return { items: savedItems }
      return getOrder(selectedOrderId)
    },
    enabled: source === 'order' && !!selectedOrderId,
    retry: false,
  })

  const comparisonItems = useMemo(() => {
    if (source === 'cart') return cartItems.map(({ productId, quantity }) => ({ productId, quantity }))
    return orderQuery.data?.items.map(({ productId, quantity }) => ({ productId, quantity })) ?? []
  }, [cartItems, orderQuery.data, source])

  const comparisonQuery = useQuery({
    queryKey: ['store-comparison', source, source === 'order' ? selectedOrderId : 'cart', comparisonItems, location],
    queryFn: () => getStoreComparison(comparisonItems, location!),
    enabled: !!location && comparisonItems.length > 0 && (source === 'cart' ? cartReady : !!orderQuery.data),
    retry: false,
  })

  const isLoading = !cartReady || !ordersReady || !locationReady || (!!location && comparisonItems.length > 0 && comparisonQuery.isLoading) ||
    (source === 'order' && !!selectedOrderId && orderQuery.isLoading)

  const chooseStore = (store: StoreComparison) => {
    if (!store.deliverable) return
    if (store.missingItems.length) {
      const count = store.missingItems.length
      const message = `${count} ${count === 1 ? 'item is' : 'items are'} out of stock at this store. Choose it anyway?`
      if (!window.confirm(message)) return
    }
    try {
      window.localStorage.setItem(PREFERRED_STORE_KEY, JSON.stringify({ storeId: store.storeId, name: store.name, etaMinutes: store.etaMinutes, deliveryFee: store.deliveryFee }))
      toast(`${store.name} selected`, { description: 'Your preferred store is saved.' })
    } catch {
      toast('Could not save your preferred store', { description: 'Browser storage is unavailable.' })
    }
  }

  if (!cartReady || !ordersReady || !locationReady) return <PageSkeleton />

  const selectedOrder = orders.find(order => order.orderId === selectedOrderId)
  const sourceLabel = source === 'cart' ? 'Your current cart' : selectedOrder ? `Order #${selectedOrder.orderId.slice(0, 8).toUpperCase()}` : 'A past order'
  const areas = getAreasForCity(city)
  const allUndeliverable = !!comparisonQuery.data?.length && comparisonQuery.data.every(store => !store.deliverable)

  return <main className={`wrap commerce-page ${styles.page}`}>
    <div className={styles.heading}>
      <div><p className="eyebrow">COMPARE STORES FOR MY BASKET</p><h1>Find the best nearby store</h1><p>Compare delivery coverage, time, fees, and stock for the same basket.</p></div>
      <span className={styles.headingIcon}><MapPin size={23} aria-hidden="true" /></span>
    </div>

    <section id="locationPanel" className={styles.locationPanel} aria-label="Choose delivery location">
      <div className={styles.locationPanelHeading}><div><h2>Your delivery location</h2><p>Choose a city and area to see which stores can reach you.</p></div><button type="button" className={styles.gpsButton} onClick={useCurrentLocation}><LocateFixed size={16} aria-hidden="true" />Use my current location</button></div>
      <div className={styles.locationControls}>
        <label className={styles.sourceField}><span>City</span><select value={city} onChange={event => changeCity(event.target.value)}>
          {MOCK_LOCATIONS.map(entry => <option key={entry.city} value={entry.city}>{entry.city}</option>)}
        </select></label>
        <label className={styles.sourceField}><span>Area or pincode</span><select value={areaPincode} onChange={event => selectArea(event.target.value)}>
          <option value="">Choose an area</option>
          {areas.map(area => <option key={area.pincode} value={area.pincode}>{area.name} · {area.pincode}</option>)}
          {location?.name === 'Current location' && <option value="current">Current GPS location · {location.pincode}</option>}
        </select></label>
        {location && <p className={styles.selectedLocation}><MapPin size={15} aria-hidden="true" />Comparing near {location.name}{location.pincode ? `, ${location.pincode}` : ''}</p>}
      </div>
      {locationError && <p className={styles.locationError} role="status">{locationError}</p>}
    </section>

    {!location && <section className={styles.locationPrompt}><MapPin size={20} aria-hidden="true" /><p>Select an area or use your current location to see stores that deliver to you.</p></section>}

    <section className={styles.sourcePanel} aria-label="Choose items to compare">
      <label className={styles.sourceField}><span>Basket source</span><select value={source} onChange={event => setSource(event.target.value as Source)}>
        <option value="cart">Current cart</option>
        <option value="order" disabled={!orders.length}>A past order</option>
      </select></label>
      {source === 'order' && orders.length > 0 && <label className={styles.sourceField}><span>Choose an order</span><select value={selectedOrderId} onChange={event => setSelectedOrderId(event.target.value)}>
        {orders.map(order => <option key={order.orderId} value={order.orderId}>Order #{order.orderId.slice(0, 8).toUpperCase()} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(order.placedAt))} · {formatINR(order.total, 'INR')}</option>)}
      </select></label>}
      <p className={styles.sourceNote}>{sourceLabel}{comparisonItems.length ? ` · ${comparisonItems.reduce((sum, item) => sum + item.quantity, 0)} ${comparisonItems.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'}` : ''}</p>
    </section>

    {source === 'order' && !orders.length && <section className={styles.emptyState}><h2>No past orders yet</h2><p>Place an order first, or compare your current cart.</p><Link href="/orders" className={styles.secondaryLink}>Go to My Orders <ArrowRight size={16} /></Link></section>}
    {source === 'order' && orders.length > 0 && orderQuery.isError && <section className={styles.errorState} role="alert"><h2>We couldn&apos;t load this order</h2><p>{orderQuery.error instanceof Error ? orderQuery.error.message : 'Please try again.'}</p><button type="button" onClick={() => void orderQuery.refetch()}><RotateCcw size={15} /> Retry</button></section>}
    {source === 'order' && orders.length > 0 && !selectedOrderId && <section className={styles.emptyState}><h2>Choose an order to compare</h2></section>}

    {location && isLoading && comparisonItems.length > 0 && <StoreComparisonSkeleton />}
    {location && !isLoading && comparisonItems.length === 0 && source === 'cart' && <section className={styles.emptyState}><span className={styles.emptyIcon}><ShoppingCart size={25} /></span><h2>Your cart is empty</h2><p>Add a few items to your cart to compare delivery and stock.</p><Link href="/" className={styles.primaryLink}>Browse the marketplace <ArrowRight size={16} /></Link></section>}
    {location && !isLoading && comparisonItems.length > 0 && comparisonQuery.isError && <section className={styles.errorState} role="alert"><h2>We couldn&apos;t compare stores</h2><p>{comparisonQuery.error instanceof Error ? comparisonQuery.error.message : 'Please try again.'}</p><button type="button" onClick={() => void comparisonQuery.refetch()}><RotateCcw size={15} /> Retry</button></section>}

    {location && !isLoading && allUndeliverable && <section className={styles.noDeliveryState}><span className={styles.emptyIcon}><MapPin size={25} /></span><h2>None of the stores in {location.city} deliver to {location.name} yet</h2><p>Try a different delivery area or return to your basket.</p><div><button type="button" className={styles.secondaryLink} onClick={() => saveLocation(null)}>Change location</button><Link href="/cart" className={styles.primaryLink}>Go back to cart <ArrowRight size={16} /></Link></div></section>}

    {location && !isLoading && !allUndeliverable && comparisonQuery.data && comparisonQuery.data.length > 0 && <>
      {!USE_MOCK && <p className={styles.demoNote}>Demo data: store locations, delivery estimates, and stock are sample data.</p>}
      <p className={styles.priceNote}>Item prices are the same at every store in {location.city}; only delivery fee, time, and stock differ.</p>
      <p className={styles.resultsCaption}>Showing stores near {location.name}{location.pincode ? ` · ${location.pincode}` : ''} for {sourceLabel}.</p>
      <StoreComparisonResults stores={comparisonQuery.data} onChoose={chooseStore} />
    </>}
  </main>
}
