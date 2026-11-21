'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LoaderCircle, LockKeyhole, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, createOrder } from '@/lib/api'
import { useCart } from '@/context/CartContext'
import { formatINR } from '@/lib/format'
import { generateId } from '@/lib/id'
import { addOrder } from '@/lib/orders-local'
import { notifyOrderPlaced } from '@/lib/notify-store'

type FormField = 'customerName' | 'customerEmail'
type FieldErrors = Partial<Record<FormField, string>>
const nameError = (value: string) => !value.trim() ? 'Enter your full name.' : value.length > 100 ? 'Name must be 100 characters or fewer.' : ''
const emailError = (value: string) => !value.trim() ? 'Enter your email address.' : value.length > 254 ? 'Email must be 254 characters or fewer.' : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? 'Enter a valid email address.' : ''

export default function CheckoutForm() {
  const router = useRouter()
  const { items, clearCart, setQuantity, removeItem, updateAvailability, isReady } = useCart()
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [requestError, setRequestError] = useState('')
  const [expiredItemId, setExpiredItemId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [placedOrder, setPlacedOrder] = useState<{ orderId: string; totalCents: number; currency: string } | null>(null)
  const lastCartSignature = useRef<string | null>(null)
  const succeeded = useRef(false)
  const submitting = useRef(false)
  const cartSignature = items.map(item => `${item.productId}:${item.quantity}`).join('|')

  useEffect(() => { document.title = 'Checkout | Inventory Hub' }, [])

  useEffect(() => {
    if (!isReady || succeeded.current || lastCartSignature.current === cartSignature) return
    let storedKey = ''
    let storedSignature = ''
    try {
      storedKey = sessionStorage.getItem('checkout:idemKey') ?? ''
      storedSignature = sessionStorage.getItem('checkout:cartSignature') ?? ''
    } catch { /* sessionStorage can be unavailable in private browsing. */ }
    const key = storedKey && storedSignature === cartSignature ? storedKey : generateId()
    setIdempotencyKey(key)
    lastCartSignature.current = cartSignature
    try {
      sessionStorage.setItem('checkout:idemKey', key)
      sessionStorage.setItem('checkout:cartSignature', cartSignature)
    } catch { /* The in-memory key still protects retries during this visit. */ }
  }, [cartSignature, isReady])

  useEffect(() => {
    if (isReady && items.length === 0 && !succeeded.current) router.replace('/cart')
  }, [isReady, items.length, router])

  const validate = (field: FormField, value: string) => field === 'customerName' ? nameError(value) : emailError(value)
  const validateAll = () => {
    const next = { customerName: nameError(customerName), customerEmail: emailError(customerEmail) }
    setFieldErrors(next)
    return !next.customerName && !next.customerEmail
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRequestError('')
    if (!validateAll() || !idempotencyKey || submitting.current || !items.length) return
    submitting.current = true
    setIsSubmitting(true)
    try {
      const result = await createOrder({
        customerEmail: customerEmail.trim(),
        customerName: customerName.trim(),
        idempotencyKey,
        items: items.map(({ productId, quantity }) => ({ productId, quantity })),
      })
      addOrder({
        orderId: result.order.orderId,
        placedAt: result.order.createdAt,
        total: result.order.totalCents,
        status: result.order.status,
        itemCount: result.order.items.reduce((count, item) => count + item.quantity, 0),
        storeName: 'Inventory Hub',
        city: '',
        items: result.order.items.map(({ productId, quantity }) => ({ productId, quantity })),
      })
      succeeded.current = true
      clearCart()
      try {
        sessionStorage.removeItem('checkout:idemKey')
        sessionStorage.removeItem('checkout:cartSignature')
      } catch { /* The order is already placed; storage cleanup is best-effort. */ }
      setPlacedOrder({
        orderId: result.order.orderId,
        totalCents: result.order.totalCents,
        currency: result.order.currency,
      })
      notifyOrderPlaced(result.order, open => { if (!open) router.replace(`/orders/${encodeURIComponent(result.order.orderId)}`) })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409 && error.message === 'Item is expired or out of stock') {
          const productId = Number(error.details?.productId) || items[0]?.productId
          setExpiredItemId(productId ?? null)
          const message = 'This item just expired or sold out'
          setRequestError(message)
          toast.error(message)
        } else if (error.code === 'OUT_OF_STOCK') {
          const productId = Number(error.details?.productId)
          const available = Math.max(0, Math.floor(Number(error.details?.available) || 0))
          const item = items.find(line => line.productId === productId)
          if (item) {
            if (available === 0) {
              removeItem(productId)
              setRequestError(`Sorry, ${item.name} is sold out.`)
            } else {
              updateAvailability(productId, available)
              setQuantity(productId, available)
              setRequestError(`Sorry, ${item.name} only has ${available} left.`)
            }
          } else setRequestError(error.message)
        } else if (error.code === 'VALIDATION_ERROR') {
          const fields = error.details?.fields
          const next: FieldErrors = {}
          if (fields && typeof fields === 'object') {
            for (const [key, value] of Object.entries(fields)) {
              const message = typeof value === 'string' ? value : ''
              if (key === 'customerName' || key === 'name') next.customerName = message || error.message
              else if (key === 'customerEmail' || key === 'email') next.customerEmail = message || error.message
            }
          }
          if (Object.keys(next).length) setFieldErrors(current => ({ ...current, ...next }))
          else setRequestError(error.message)
        } else if (error.code === 'NETWORK_ERROR') setRequestError("Can't reach the server. Check your connection and try again.")
        else if (error.code === 'RATE_LIMITED') setRequestError('Too many attempts. Please wait a few seconds and try again.')
        else setRequestError(error.message)
      } else setRequestError('Something went wrong. Please try again.')
    } finally {
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  if (placedOrder) return <main className="wrap commerce-page">
    <div className="checkout-heading"><div><p className="eyebrow">ORDER CONFIRMED</p><h1>Yay! Your order is placed</h1><p>We&apos;re getting it ready for you.</p></div></div>
  </main>

  if (!isReady || !idempotencyKey || items.length === 0) return <main className="wrap commerce-page"><div className="checkout-skeleton"><div /><div /></div></main>

  const subtotal = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
  const genericError = !!requestError && !requestError.startsWith('Sorry,') && !requestError.startsWith("Can't reach") && !requestError.startsWith('Too many')
  return <main className="wrap commerce-page checkout-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span aria-current="page">Checkout</span></nav>
    <div className="checkout-heading"><div><p className="eyebrow">ALMOST THERE</p><h1>Checkout</h1><p>Enter your details to place your order.</p></div><span className="secure-label"><LockKeyhole size={15} /> Secure checkout</span></div>
    <div className="checkout-layout"><form className="checkout-form" noValidate onSubmit={submit}>
      <section className="checkout-panel"><div className="checkout-panel-heading"><span>01</span><div><h2>Your details</h2><p>We&apos;ll use these to send your order confirmation.</p></div></div>
        <div className="checkout-fields"><label className="checkout-field" htmlFor="customerName">Full name<input id="customerName" name="customerName" autoComplete="name" maxLength={100} value={customerName} aria-invalid={!!fieldErrors.customerName} aria-describedby={fieldErrors.customerName ? 'customerName-error' : undefined} onChange={event => { setCustomerName(event.target.value); setRequestError('') }} onBlur={() => setFieldErrors(current => ({ ...current, customerName: validate('customerName', customerName) }))} />{fieldErrors.customerName && <span id="customerName-error" className="field-error">{fieldErrors.customerName}</span>}</label>
          <label className="checkout-field" htmlFor="customerEmail">Email address<input id="customerEmail" name="customerEmail" type="email" autoComplete="email" maxLength={254} value={customerEmail} aria-invalid={!!fieldErrors.customerEmail} aria-describedby={fieldErrors.customerEmail ? 'customerEmail-error' : undefined} onChange={event => { setCustomerEmail(event.target.value); setRequestError('') }} onBlur={() => setFieldErrors(current => ({ ...current, customerEmail: validate('customerEmail', customerEmail) }))} />{fieldErrors.customerEmail && <span id="customerEmail-error" className="field-error">{fieldErrors.customerEmail}</span>}</label></div>
      </section>
      {requestError && <div className={`checkout-error ${genericError ? 'checkout-error-retry' : ''}`} role="alert"><span>{requestError}</span>{genericError && <button type="submit" disabled={isSubmitting} className="text-retry">Retry</button>}</div>}
      <button className="primary-action place-order" type="submit" disabled={isSubmitting || !idempotencyKey}>{isSubmitting ? <><LoaderCircle className="spin" size={17} /> Placing order…</> : <><ShoppingBag size={17} /> {genericError ? 'Retry' : 'Place order'} · {formatINR(subtotal, items[0]?.currency ?? 'INR')}</>}</button>
      <p className="checkout-demo-note">Payment is simulated in this demo</p>
    </form>
    <aside className="checkout-summary"><h2>Order summary <span>{items.length} {items.length === 1 ? 'item' : 'items'}</span></h2><div className="checkout-lines">{items.map(item => <div className="checkout-line" key={item.productId}><div><strong>{item.name}</strong><span>Qty {item.quantity} × {formatINR(item.priceCents, item.currency)}</span>{expiredItemId===item.productId&&<span role="alert" className="field-error">This item just expired or sold out</span>}</div><b>{formatINR(item.priceCents * item.quantity, item.currency)}</b></div>)}</div><div className="checkout-total"><span>Total</span><strong>{formatINR(subtotal, items[0]?.currency ?? 'INR')}</strong></div></aside></div>
  </main>
}
