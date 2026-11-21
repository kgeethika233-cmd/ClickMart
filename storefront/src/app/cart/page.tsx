'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '../../context/CartContext';
import { formatINR } from '../../lib/format';
import { getProduct } from '../../lib/api';

export default function CartPage() {
  const { items, setQuantity, remove, subtotalCents, clear } = useCart();
  const [warnings, setWarnings] = useState<Record<number, string>>({});
  const [checkingStock, setCheckingStock] = useState(false);

  // Refresh live stock on page load
  useEffect(() => {
    async function verifyStock() {
      if (items.length === 0) return;
      setCheckingStock(true);
      const newWarnings: Record<number, string> = {};

      for (const item of items) {
        try {
          const fresh = await getProduct(item.productId);
          if (!fresh.inStock || fresh.availableCount <= 0) {
            newWarnings[item.productId] = 'This item is now OUT OF STOCK. Please remove it to proceed.';
          } else if (fresh.availableCount < item.quantity) {
            newWarnings[item.productId] = `Only ${fresh.availableCount} unit(s) remaining. Quantity has been adjusted.`;
            setQuantity(item.productId, fresh.availableCount);
          }
        } catch (err) {
          // If 404 or product removed
          newWarnings[item.productId] = 'Unable to verify current stock level.';
        }
      }
      setWarnings(newWarnings);
      setCheckingStock(false);
    }

    verifyStock();
  }, []);

  const hasBlockingErrors = Object.values(warnings).some((w) => w.includes('OUT OF STOCK'));

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-white">Your Cart is Empty</h1>
        <p className="mt-2 text-sm text-slate-400">Discover great products and add them to your cart.</p>
        <Link
          href="/search"
          className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Shopping Cart</h1>
          <p className="text-xs text-slate-400 mt-1">
            {items.length} item type(s) • Live stock verified
          </p>
        </div>
        <button
          onClick={clear}
          className="text-xs font-semibold text-slate-400 hover:text-red-400 transition"
        >
          Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {/* Item List */}
        <div className="md:col-span-2 space-y-4">
          {items.map((item) => {
            const warning = warnings[item.productId];

            return (
              <div
                key={item.productId}
                className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-800">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                        No Image
                      </div>
                    )}
                  </div>

                  <div>
                    <Link
                      href={`/product/${item.productId}`}
                      className="font-semibold text-slate-200 hover:text-indigo-400 text-sm line-clamp-1"
                    >
                      {item.name}
                    </Link>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {formatINR(item.priceCents, item.currency)} each
                    </div>
                    {warning && (
                      <p className="mt-1 text-xs font-semibold text-amber-400">{warning}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-slate-800/80 pt-3 sm:border-0 sm:pt-0">
                  {/* Stepper */}
                  <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950 p-1">
                    <button
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      className="h-6 w-6 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white flex items-center justify-center text-xs"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-semibold text-slate-200">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= Math.min(10, item.maxQuantity)}
                      className="h-6 w-6 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white flex items-center justify-center text-xs disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-sm font-bold text-slate-100 min-w-[5rem] text-right">
                    {formatINR(item.priceCents * item.quantity, item.currency)}
                  </div>

                  <button
                    onClick={() => remove(item.productId)}
                    className="text-xs text-slate-500 hover:text-red-400"
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 h-fit space-y-6">
          <h2 className="text-lg font-bold text-white">Order Summary</h2>

          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-100">{formatINR(subtotalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Standard Delivery</span>
              <span className="text-emerald-400 font-semibold">FREE</span>
            </div>
            <div className="border-t border-slate-800 pt-3 flex justify-between text-sm font-bold text-white">
              <span>Total</span>
              <span>{formatINR(subtotalCents)}</span>
            </div>
          </div>

          {hasBlockingErrors ? (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
              Please remove the sold-out items to proceed to checkout.
            </div>
          ) : (
            <Link
              href="/checkout"
              className="block w-full text-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 active:scale-95 transition"
            >
              Proceed to Checkout
            </Link>
          )}

          <Link
            href="/search"
            className="block text-center text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            ← Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
