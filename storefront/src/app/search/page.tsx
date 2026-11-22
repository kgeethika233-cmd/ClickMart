'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { searchProducts } from '../../lib/api';
import { Category, City, PriceRangeKey, SearchParams } from '../../types/contract';
import { ProductCard } from '../../components/ProductCard';

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') || '';
  const categories = searchParams.getAll('category') as Category[];
  const cities = searchParams.getAll('city') as City[];
  const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
  const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
  const sort = (searchParams.get('sort') || 'relevance') as 'relevance' | 'price_asc' | 'price_desc';
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;

  const queryParams: SearchParams = {
    q: q || undefined,
    category: categories.length > 0 ? categories : undefined,
    city: cities.length > 0 ? cities : undefined,
    minPrice,
    maxPrice,
    sort,
    page,
    pageSize: 12,
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['search', queryParams],
    queryFn: () => searchProducts(queryParams),
    placeholderData: (previousData) => previousData,
  });

  const updateUrl = (updates: Record<string, string | string[] | null>) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    for (const [key, val] of Object.entries(updates)) {
      nextParams.delete(key);
      if (val === null || val === undefined) {
        continue;
      }
      if (Array.isArray(val)) {
        for (const v of val) nextParams.append(key, v);
      } else {
        nextParams.set(key, val);
      }
    }

    // Changing any filter resets to page 1 unless specifically page is set
    if (!('page' in updates)) {
      nextParams.delete('page');
    }

    router.push(`/search?${nextParams.toString()}`);
  };

  const toggleCategory = (cat: Category) => {
    const exists = categories.includes(cat);
    const next = exists ? categories.filter((c) => c !== cat) : [...categories, cat];
    updateUrl({ category: next.length > 0 ? next : null });
  };

  const toggleCity = (city: City) => {
    const exists = cities.includes(city);
    const next = exists ? cities.filter((c) => c !== city) : [...cities, city];
    updateUrl({ city: next.length > 0 ? next : null });
  };

  const setPriceBucket = (key: PriceRangeKey) => {
    if (key === 'under-500') updateUrl({ minPrice: null, maxPrice: '50000' });
    else if (key === '500-1500') updateUrl({ minPrice: '50000', maxPrice: '150000' });
    else if (key === '1500-5000') updateUrl({ minPrice: '150000', maxPrice: '500000' });
    else if (key === 'above-5000') updateUrl({ minPrice: '500000', maxPrice: null });
  };

  const clearAllFilters = () => {
    router.push('/search');
  };

  const facets = data?.facets;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Search Header */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {q ? (
              <span>
                Search results for <span className="text-indigo-400">"{q}"</span>
              </span>
            ) : (
              'All Products'
            )}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {data ? `${data.total} item(s) found in stock` : 'Searching catalogue...'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400">Sort by:</label>
          <select
            value={sort}
            onChange={(e) => updateUrl({ sort: e.target.value })}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
          >
            <option value="relevance">Relevance</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Sidebar Filters */}
        <aside className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Filters</h2>
            <button
              onClick={clearAllFilters}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            >
              Clear all
            </button>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-400 mb-3">Category</h3>
            <div className="space-y-2">
              {facets?.categories.map((c) => (
                <label key={c.value} className="flex cursor-pointer items-center justify-between text-xs text-slate-300 hover:text-white">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={categories.includes(c.value)}
                      onChange={() => toggleCategory(c.value)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    <span>{c.value}</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">{c.count}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Price Ranges */}
          <div className="border-t border-slate-800/80 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase text-slate-400">Price</h3>
              {(minPrice !== undefined || maxPrice !== undefined) && (
                <button
                  onClick={() => updateUrl({ minPrice: null, maxPrice: null })}
                  className="text-[11px] text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-2">
              {facets?.priceRanges.map((p) => {
                const isChecked =
                  (p.key === 'under-500' && maxPrice === 50000 && minPrice === undefined) ||
                  (p.key === '500-1500' && minPrice === 50000 && maxPrice === 150000) ||
                  (p.key === '1500-5000' && minPrice === 150000 && maxPrice === 500000) ||
                  (p.key === 'above-5000' && minPrice === 500000 && maxPrice === undefined);

                return (
                  <label key={p.key} className="flex cursor-pointer items-center justify-between text-xs text-slate-300 hover:text-white">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="price_bucket"
                        checked={isChecked}
                        onChange={() => setPriceBucket(p.key)}
                        className="border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                      />
                      <span>{p.label}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px]">{p.count}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Cities */}
          <div className="border-t border-slate-800/80 pt-6">
            <h3 className="text-xs font-semibold uppercase text-slate-400 mb-3">Warehouse City</h3>
            <div className="space-y-2">
              {facets?.cities.map((c) => (
                <label key={c.value} className="flex cursor-pointer items-center justify-between text-xs text-slate-300 hover:text-white">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cities.includes(c.value)}
                      onChange={() => toggleCity(c.value)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    <span>{c.value}</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">{c.count}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Product Grid & Pagination */}
        <div className="lg:col-span-3">
          {isLoading && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-80 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
              ))}
            </div>
          )}

          {isError && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
              <p className="text-sm text-red-400">Search request failed: {(error as Error)?.message}</p>
              <button
                onClick={() => refetch()}
                className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Retry
              </button>
            </div>
          )}

          {data && data.products.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center">
              <h3 className="text-lg font-bold text-white">No products found</h3>
              <p className="mt-2 text-sm text-slate-400">
                Try fewer filters, a different spelling, or check back later. (Sold-out items are automatically removed from search results).
              </p>
              <button
                onClick={clearAllFilters}
                className="mt-6 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Reset All Filters
              </button>
            </div>
          )}

          {data && data.products.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {data.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="mt-12 flex items-center justify-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => updateUrl({ page: String(page - 1) })}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <div className="flex gap-1">
                    {Array.from({ length: data.totalPages }).map((_, i) => {
                      const pNum = i + 1;
                      return (
                        <button
                          key={pNum}
                          onClick={() => updateUrl({ page: String(pNum) })}
                          className={`h-8 w-8 rounded-xl text-xs font-semibold transition ${
                            page === pNum
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          {pNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    disabled={page >= data.totalPages}
                    onClick={() => updateUrl({ page: String(page + 1) })}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}

