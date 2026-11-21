'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '../context/CartContext';
import { USE_MOCK } from '../lib/config';

export function Header() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { itemCount } = useCart();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');

  useEffect(() => {
    setSearchTerm(searchParams.get('q') || '');
  }, [searchParams]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim() && searchTerm !== (searchParams.get('q') || '')) {
        router.replace(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, router, searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tight text-white sm:text-2xl">
            Inventory<span className="text-indigo-400">Hub</span>
          </span>
        </Link>

        <form onSubmit={handleSubmit} className="flex-1 max-w-lg">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search with typo tolerance ('bluetoth', 'speeker')..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </form>

        <div className="flex items-center gap-3">
          <Link
            href="/cart"
            className="relative flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm font-semibold text-slate-200 hover:border-slate-700 transition"
          >
            <span>Cart</span>
            {itemCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
