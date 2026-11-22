'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Product } from '../types/contract';
import { formatINR } from '../lib/format';
import { useCart } from '../context/CartContext';

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [imgError, setImgError] = useState(false);
  const [addedToast, setAddedToast] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.inStock || product.availableCount <= 0) return;

    add({
      productId: product.id,
      name: product.name,
      priceCents: product.priceCents,
      currency: product.currency,
      imageUrl: product.imageUrl,
      maxQuantity: product.availableCount,
    }, 1);

    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2000);
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-slate-700 hover:shadow-xl hover:shadow-indigo-500/10">
      <Link href={`/product/${product.id}`} className="block">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-800">
          {!imgError && product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-500 text-xs">
              No Image
            </div>
          )}

          <div className="absolute top-2 right-2 flex gap-1">
            {product.inStock && product.availableCount > 0 ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                {product.availableCount <= 5 ? `Only ${product.availableCount} left!` : 'In Stock'}
              </span>
            ) : (
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400 border border-red-500/30">
                Out of Stock
              </span>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-medium text-slate-300">
              {product.category}
            </span>
            <span>•</span>
            <span>{product.city}</span>
          </div>

          <h3 className="line-clamp-1 font-semibold text-slate-100 group-hover:text-indigo-400">
            {product.name}
          </h3>

          <p className="mt-1 line-clamp-2 text-xs text-slate-400">
            {product.description || 'High quality catalog item.'}
          </p>
        </div>
      </Link>

      <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
        <div className="text-base font-bold text-slate-100">
          {formatINR(product.priceCents, product.currency)}
        </div>

        <button
          onClick={handleAddToCart}
          disabled={!product.inStock || product.availableCount <= 0}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
            product.inStock && product.availableCount > 0
              ? 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
              : 'cursor-not-allowed bg-slate-800 text-slate-500'
          }`}
        >
          {addedToast ? '✓ Added' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}

