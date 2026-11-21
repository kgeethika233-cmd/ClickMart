import type { Metadata } from 'next'
import CheckoutForm from '@/components/checkout-form'

export const metadata: Metadata = { title: 'Checkout | Inventory Hub', description: 'Review your order and place it with Inventory Hub.' }

export default function CheckoutPage() {
  return <CheckoutForm />
}
