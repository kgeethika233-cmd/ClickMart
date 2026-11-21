'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../../context/CartContext';
import { createOrder, ApiError } from '../../lib/api';
import { generateId } from '../../lib/id';
import { formatINR } from '../../lib/format';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotalCents, clear, setQuantity } = useCart();

  const [name, setName] = useState('Alice Johnson');
  const [email, setEmail] = useState('shopper@example.com');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Setup idempotency key once in sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let key = sessionStorage.getItem('checkout:idemKey');
    if (!key) {
      key = generateId();
      sessionStorage.setItem('checkout:idemKey', key);
    }
    setIdempotencyKey(key);
  }, []);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      router.replace('/cart');
    }
  }, [items, router]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim() || name.length > 100) {
      errors.name = 'Please provide a name (1 - 100 characters).';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      errors.email = 'Please provide a valid email address.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const orderPayload = {
        customerEmail: email.trim(),
        customerName: name.trim(),
        idempotencyKey: idempotencyKey || generateId(),
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      };

      const { order } = await createOrder(orderPayload);

      // Clean up cart and idempotency key
      clear();
      sessionStorage.removeItem('checkout:idemKey');

      router.push(`/orders/${order.id}`);
    } catch (err: any) {
      setIsSubmitting(false);

      if (err instanceof ApiError) {
        if (err.code === 'OUT_OF_STOCK') {
          const prodId = err.details?.productId as number;
          const available = (err.details?.available as number) || 0;
          setGeneralError(err.message || 'One of the items in your cart is no longer available in this quantity.');
          if (prodId) {
            setQuantity(prodId, available);
          }
        } else if (err.code === 'VALIDATION_ERROR' && err.details?.fields) {
          setFieldErrors(err.details.fields as Record<string, string>);
        } else if (err.code === 'NETWORK_ERROR') {
          setGeneralError("Can't reach the server. Check your connection and try again (your order was not charged).");
        } else if (err.code === 'RATE_LIMITED') {
          setGeneralError('Too many attempts. Please wait a few seconds before trying again.');
        } else {
          setGeneralError(err.message || 'Failed to place order.');
        }
      } else {
        setGeneralError(err.message || 'An unexpected error occurred.');
      }
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="border-b border-slate-800 pb-6 mb-8">
        <h1 className="text-3xl font-extrabold text-white">Checkout</h1>
        <p className="text-xs text-slate-400 mt-1">Review your order details and customer contact.</p>
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        {/* Contact Form */}
        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                1. Customer Details
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={validate}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                  required
                />
                {fieldErrors.name && <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={validate}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                  required
                />
                {fieldErrors.email && <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>}
                <p className="mt-1 text-[11px] text-slate-500">Order confirmation will be sent here.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3">
                2. Payment Method
              </h2>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-400">
                ⚡ <strong>Simulated Sandbox Payment:</strong> No card required. Orders are atomically locked in PostgreSQL and routed through Kafka.
              </div>
            </div>

            {generalError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-semibold text-red-400">
                {generalError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 disabled:opacity-50 active:scale-95 transition"
            >
              {isSubmitting ? 'Placing Order...' : `Place Order (${formatINR(subtotalCents)})`}
            </button>
          </form>
        </div>

        {/* Order Summary Column */}
        <div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Order Items ({items.length})
            </h2>

            <div className="divide-y divide-slate-800/80 max-h-80 overflow-y-auto">
              {items.map((i) => (
                <div key={i.productId} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-slate-200">{i.name}</div>
                    <div className="text-slate-500">Qty: {i.quantity} × {formatINR(i.priceCents, i.currency)}</div>
                  </div>
                  <div className="font-mono font-semibold text-slate-100">
                    {formatINR(i.priceCents * i.quantity, i.currency)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatINR(subtotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="text-emerald-400">FREE</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-bold text-white">
                <span>Total Amount</span>
                <span>{formatINR(subtotalCents)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
