'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadWishlist, saveWishlist } from '@/lib/wishlist'

type Wishlist = {
  items: number[]
  isWishlisted: (id: number) => boolean
  toggle: (id: number) => void
  remove: (id: number) => void
  clear: () => void
  isReady: boolean
}

const Context = createContext<Wishlist | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<number[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setItems(loadWishlist())
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) saveWishlist(items)
  }, [items, ready])

  const isWishlisted = useCallback((id: number) => items.includes(id), [items])
  const toggle = useCallback((id: number) => {
    if (!Number.isSafeInteger(id) || id < 1) return
    setItems(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }, [])
  const remove = useCallback((id: number) => setItems(current => current.filter(item => item !== id)), [])
  const clear = useCallback(() => setItems([]), [])

  return <Context.Provider value={{ items, isWishlisted, toggle, remove, clear, isReady: ready }}>{children}</Context.Provider>
}

export function useWishlist() {
  const value = useContext(Context)
  if (!value) throw new Error('WishlistProvider is missing')
  return value
}
