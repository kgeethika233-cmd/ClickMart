'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getProduct } from '../../../lib/api';
import { formatINR } from '../../../lib/format';
import { useCart } from '../../../context/CartContext';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = parseInt(String(params.id), 10);
  const { add } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const { data: product, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProduct(productId),
    enabled: !isNaN(productId) && productId > 0,
    refetchOnWindowFocus: true,
  });

  if (isNaN(productId) || productId <= 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-white">Invalid Product ID</h1>
        <p className="mt-2 text-sm text-slate-400">Please browse our catalogue to find what you are looking for.</p>
        <Link href="/search" className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white">
          Back to Catalog
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-2xl bg-slate-900 border border-slate-800" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded-xl bg-slate-900" />
            <div className="h-6 w-1/4 animate-pulse rounded-xl bg-slate-900" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-slate-900" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    const is404 = (error as any)?.code === 'NOT_FOUND' || (error as any)?.status === 404;
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-white">{is404 ? 'Product Not Found' : 'Error Loading Product'}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {is404 ? 'The product you are looking for does not exist or has been removed.' : (error as Error)?.message}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/search" className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white">
            Back to Catalog
          </Link>
          {!is404 && (
            <button onClick={() => refetch()} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const isOutOfStock = !product.inStock || product.availableCount <= 0;
  const maxAvailable = Math.min(10, product.availableCount);

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    add({
      productId: product.id,
      name: product.name,
      priceCents: product.priceCents,
      currency: product.currency,
      imageUrl: product.imageUrl,
      maxQuantity: product.availableCount,
    }, quantity);

    setToastMsg(`Added ${quantity} unit(s) to cart!`);
    setTimeout(() => setToastMsg(''), 3000);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        {/* Product Image */}
        <div className="aspect-square w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          {!imgError && product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500">
              No Image Available
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <span className="rounded bg-slate-800 px-2 py-0.5 font-medium text-slate-300">
                {product.category}
              </span>
              <span>•</span>
              <span>{product.city} Warehouse</span>
              <span>•</span>
              <span className="font-mono text-slate-500">{product.sku}</span>
            </div>

            <h1 className="text-3xl font-extrabold text-white">{product.name}</h1>

            <div className="mt-4 text-2xl font-black text-indigo-400">
              {formatINR(product.priceCents, product.currency)}
            </div>

            <div className="mt-4">
              {product.inStock && product.availableCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {product.availableCount <= 5 ? `Only ${product.availableCount} left in stock!` : `${product.availableCount} units in stock`}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400 border border-red-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  Out of Stock
                </span>
              )}
            </div>

            <p className="mt-6 text-sm leading-relaxed text-slate-300">
              {product.description || 'Premium catalog item backed by automated warehouse inventory.'}
            </p>
          </div>

          <div className="mt-8 border-t border-slate-800/80 pt-6">
            {!isOutOfStock ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-xs font-semibold uppercase text-slate-400">Quantity:</label>
                  <select
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none"
                  >
                    {Array.from({ length: maxAvailable }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500 active:scale-95"
                  >
                    Add to Cart
                  </button>
                  <Link
                    href="/cart"
                    className="rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
                  >
                    View Cart
                  </Link>
                </div>

                {toastMsg && (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-center text-xs font-semibold text-emerald-400">
                    {toastMsg}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 text-center">
                <p className="text-sm font-medium text-slate-400">This item is currently sold out.</p>
                <Link href="/search" className="mt-2 inline-block text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                  Explore other products in {product.category} →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
