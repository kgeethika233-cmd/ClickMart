'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getOrder, ApiError } from '../../../lib/api';
import { Order } from '../../../types/contract';
import { formatINR } from '../../../lib/format';

export default function OrderStatusPage() {
  const params = useParams();
  const orderId = String(params.orderId || '');

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [reconnecting, setReconnecting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isUuid) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let timer: NodeJS.Timeout;

    async function fetchStatus() {
      try {
        const data = await getOrder(orderId);
        if (!isMounted) return;
        setOrder(data);
        setErrorMsg('');
        setReconnecting(false);

        // If still PLACED and under 60 seconds, keep polling every 2s
        if (data.status === 'PLACED' && elapsedSeconds < 60) {
          timer = setTimeout(() => {
            setElapsedSeconds((s) => s + 2);
            fetchStatus();
          }, 2000);
        }
      } catch (err: any) {
        if (!isMounted) return;
        if (err instanceof ApiError && err.code === 'NETWORK_ERROR') {
          setReconnecting(true);
          timer = setTimeout(() => fetchStatus(), 2000);
        } else {
          setErrorMsg(err.message || 'Could not load order.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchStatus();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [orderId, isUuid, elapsedSeconds]);

  if (!isUuid) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-white">Invalid Order ID</h1>
        <p className="mt-2 text-sm text-slate-400">Order references must be valid UUID identifiers.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white">
          Return Home
        </Link>
      </div>
    );
  }

  if (loading && !order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mb-4" />
        <h1 className="text-lg font-bold text-white">Loading Order Details...</h1>
      </div>
    );
  }

  if (errorMsg && !order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-white">Order Not Found</h1>
        <p className="mt-2 text-sm text-slate-400">{errorMsg}</p>
        <Link href="/search" className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white">
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (!order) return null;

  const isConfirmed = order.status === 'CONFIRMED';

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {reconnecting && (
        <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-center text-xs text-amber-400">
          Reconnecting to backend...
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <div className="flex flex-col gap-2 border-b border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Order Receipt</span>
            <h1 className="text-xl font-bold text-white font-mono break-all sm:text-2xl">{order.id}</h1>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              isConfirmed
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isConfirmed ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
            {order.status}
          </span>
        </div>

        {/* Visual Stepper */}
        <div className="py-8">
          <div className="flex items-center justify-between relative">
            <div className="flex flex-col items-center z-10">
              <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                ✓
              </div>
              <span className="text-xs font-semibold text-slate-200 mt-2">Order Placed</span>
            </div>

            <div className={`flex-1 h-1 mx-4 transition-all duration-500 ${isConfirmed ? 'bg-indigo-600' : 'bg-slate-800'}`} />

            <div className="flex flex-col items-center z-10">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isConfirmed ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isConfirmed ? '✓' : '2'}
              </div>
              <span className={`text-xs font-semibold mt-2 ${isConfirmed ? 'text-emerald-400' : 'text-slate-500'}`}>
                {isConfirmed ? 'Confirmed' : 'Inventory Deduction'}
              </span>
            </div>
          </div>

          {!isConfirmed && (
            <div className="mt-6 rounded-xl bg-slate-950 border border-slate-800 p-4 text-center">
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent mr-2 align-middle" />
              <span className="text-xs text-slate-400">
                Processing Kafka message & updating inventory...
              </span>
            </div>
          )}

          {isConfirmed && (
            <div className="mt-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
              <p className="text-xs font-semibold text-emerald-400">
                Order confirmed! Confirmation email dispatched to{' '}
                <strong className="text-white">{order.customerEmail}</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="border-t border-slate-800 pt-6 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Purchased Items</h2>

          <div className="divide-y divide-slate-800/80">
            {order.items.map((item) => (
              <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-slate-200">{item.productName}</span>
                  <span className="text-slate-500 ml-2">× {item.quantity}</span>
                </div>
                <div className="font-mono text-slate-100">
                  {formatINR(item.priceCents * item.quantity, order.currency)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 pt-3 flex justify-between text-sm font-bold text-white">
            <span>Total Paid</span>
            <span>{formatINR(order.totalCents, order.currency)}</span>
          </div>

          <div className="text-[11px] text-slate-500 flex justify-between pt-2">
            <span>Placed on:</span>
            <span>{new Date(order.createdAt).toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <Link
            href="/search"
            className="inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500"
          >
            ← Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
