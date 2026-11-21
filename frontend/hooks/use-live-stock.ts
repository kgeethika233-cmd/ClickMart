'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getStockStream, type StockUpdate } from '@/lib/api'

type StockMap = Record<number, StockUpdate & { highlighted: boolean }>
export function useLiveStock(initial: Array<{ productId: number; availableCount: number; inStock: boolean }>) {
  const ids = useMemo(() => [...new Set(initial.map(product => product.productId).filter(productId => Number.isSafeInteger(productId) && productId > 0))].sort((a, b) => a - b), [initial.map(product => product.productId).join(',')])
  const fallbackKey = initial.map(product => `${product.productId}:${product.availableCount}:${product.inStock}`).join('|')
  const fallback = useMemo(() => new Map<number, StockUpdate & { highlighted: boolean }>(initial.map(product => [product.productId, { ...product, highlighted: false }])), [fallbackKey])
  const [stock, setStock] = useState<StockMap>({})
  const stockRef = useRef<StockMap>({})
  const seen = useRef(new Set<number>())
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  useEffect(() => { stockRef.current = {}; seen.current.clear(); setStock({}) }, [fallbackKey])
  useEffect(() => {
    if (!ids.length) return
    const unsubscribe = getStockStream(ids, (update, source) => {
      const previous = stockRef.current[update.productId] ?? fallback.get(update.productId)
      const firstSnapshot = !seen.current.has(update.productId)
      seen.current.add(update.productId)
      const changed = source === 'event' || (!firstSnapshot && !!previous && (previous.availableCount !== update.availableCount || previous.inStock !== update.inStock))
      const next = { ...stockRef.current, [update.productId]: { ...update, highlighted: changed || !!previous?.highlighted } }
      stockRef.current = next
      setStock(next)
      if (!changed) return
      const timer = timers.current.get(update.productId)
      if (timer) clearTimeout(timer)
      timers.current.set(update.productId, setTimeout(() => {
        const current = stockRef.current[update.productId]
        if (current) {
          stockRef.current = { ...stockRef.current, [update.productId]: { ...current, highlighted: false } }
          setStock(stockRef.current)
        }
        timers.current.delete(update.productId)
      }, 1800))
    })
    return () => { unsubscribe(); timers.current.forEach(clearTimeout); timers.current.clear() }
  }, [ids, fallback])
  return useCallback((productId: number) => stock[productId] ?? fallback.get(productId) ?? { productId, availableCount: 0, inStock: false, highlighted: false }, [stock, fallback])
}
