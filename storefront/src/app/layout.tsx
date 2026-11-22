import './globals.css';
import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { Providers } from './providers';
import { Header } from '../components/Header';
import { USE_MOCK, API_BASE } from '../lib/config';

export const metadata: Metadata = {
  title: 'Inventory Hub - Modern Real-Time Storefront',
  description: 'Event-driven real-time inventory management with typo-tolerant OpenSearch.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100 antialiased">
        <Providers>
          <Suspense fallback={<div className="h-16 border-b border-slate-800 bg-slate-900" />}>
            <Header />
          </Suspense>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
              <p>© 2026 Inventory Hub. High-concurrency distributed order pipeline.</p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${USE_MOCK ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  Mode: <strong className="text-slate-200">{USE_MOCK ? 'MOCK' : 'LIVE'}</strong> ({API_BASE})
                </span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

