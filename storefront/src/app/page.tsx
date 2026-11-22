'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { searchProducts } from '../lib/api';
import { ProductCard } from '../components/ProductCard';

export default function HomePage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => searchProducts({ pageSize: 8 }),
  });

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
          <span className="inline-block rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20 mb-4">
            Zero Overselling • ACID Concurrency • Event-Driven Kafka
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
            Real-Time Catalog &{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Typo-Tolerant
            </span>{' '}
            Search
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400 sm:text-lg">
            Experience lightning fast product discovery powered by OpenSearch, backed by PostgreSQL row locking
            and asynchronous Kafka order processing.
          </p>

          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/search"
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500"
            >
              Explore Full Catalog
            </Link>
            <Link
              href="/search?q=bluetoth"
              className="rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              Try Typo Search ('bluetoth')
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Featured In-Stock Products</h2>
            <p className="text-sm text-slate-400 mt-1">Live inventory updated in real-time as orders are placed.</p>
          </div>
          <Link href="/search" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300">
            View All →
          </Link>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
            <p className="text-sm text-red-400">Failed to load featured products: {(error as Error)?.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Retry
            </button>
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {data.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

