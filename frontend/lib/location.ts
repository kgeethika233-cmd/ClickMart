import { MOCK_LOCATIONS, type SampleArea } from '@/lib/mock-locations'
import type { AuthLocation } from '@/lib/api'

export type StoredUserLocation = SampleArea & { city: string }
export const USER_LOCATION_KEY = 'user-location:v1'
const LOCATION_EVENT = 'user-location:changed'

export function locationForCoordinates(location: AuthLocation): StoredUserLocation {
  const cities = MOCK_LOCATIONS.flatMap(entry => entry.areas.map(area => ({ ...area, city: entry.city })))
  const cityMatch = cities.filter(area => area.city.toLowerCase() === location.city?.toLowerCase())
  const candidates = cityMatch.length ? cityMatch : cities
  const radians = (degrees: number) => degrees * Math.PI / 180
  const distance = (area: SampleArea) => {
    const dLat = radians(area.lat - location.lat)
    const dLng = radians(area.lng - location.lng)
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(location.lat)) * Math.cos(radians(area.lat)) * Math.sin(dLng / 2) ** 2
    return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
  }
  const nearest = candidates.reduce((best, area) => distance(area) < distance(best) ? area : best)
  return { ...nearest, name: 'Current location', lat: location.lat, lng: location.lng }
}

export function loadUserLocation(): StoredUserLocation | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(USER_LOCATION_KEY) ?? 'null')
    if (!value || typeof value !== 'object') return null
    const item = value as Record<string, unknown>
    if (typeof item.city !== 'string' || !MOCK_LOCATIONS.some(city => city.city === item.city) || typeof item.name !== 'string' || typeof item.pincode !== 'string' || typeof item.lat !== 'number' || !Number.isFinite(item.lat) || typeof item.lng !== 'number' || !Number.isFinite(item.lng)) return null
    return item as StoredUserLocation
  } catch { return null }
}

export function saveUserLocation(location: StoredUserLocation | null) {
  let saved = true
  try { if (location) localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(location)); else localStorage.removeItem(USER_LOCATION_KEY) } catch { saved = false }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(LOCATION_EVENT, { detail: location }))
  return saved
}
export function subscribeToLocation(callback: (location: StoredUserLocation | null) => void) {
  const handler = (event: Event) => callback((event as CustomEvent<StoredUserLocation | null>).detail)
  window.addEventListener(LOCATION_EVENT, handler)
  return () => window.removeEventListener(LOCATION_EVENT, handler)
}
