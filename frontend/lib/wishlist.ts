const KEY = 'wishlist:v1'

export function loadWishlist(): number[] {
  try {
    if (typeof window === 'undefined') return []
    const value: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return Array.from(new Set(value.filter((id): id is number => Number.isSafeInteger(id) && id > 0)))
  } catch {
    return []
  }
}

export function saveWishlist(items: number[]) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // Storage can be unavailable in private browsing or when browser storage is disabled.
  }
}
