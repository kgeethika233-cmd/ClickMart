'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getMe, logOut, getLocationByIp, updateLocation, type AuthUser, type AuthLocation } from '@/lib/api'
import { locationForCoordinates, saveUserLocation } from '@/lib/location'

type AuthState = {
  user: AuthUser | null
  ready: boolean
  pendingLocation: boolean
  signIn: (user: AuthUser) => void
  signOut: () => Promise<void>
  askForLocation: () => void
}
const Context = createContext<AuthState | null>(null)

function LocationPrompt({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const resolveLocation = async (coords?: AuthLocation) => {
    setBusy(true)
    try {
      const location = coords ?? await getLocationByIp()
      const stored = locationForCoordinates(location)
      saveUserLocation(stored)
      try { await updateLocation({ city: stored.city, lat: stored.lat, lng: stored.lng }) } catch { /* Keep the local delivery estimate if the account service is unavailable. */ }
    } catch { /* Location is optional when the IP lookup is unavailable. */ }
    finally { setBusy(false); onDone() }
  }
  const allow = () => {
    if (!navigator.geolocation) { void resolveLocation(); return }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      position => { void resolveLocation({ city: '', lat: position.coords.latitude, lng: position.coords.longitude }) },
      () => { void resolveLocation() },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false },
    )
  }
  return <div className="auth-overlay" role="presentation"><section className="location-dialog" role="dialog" aria-modal="true" aria-labelledby="location-dialog-title"><h2 id="location-dialog-title">Allow location to see accurate delivery times?</h2><p>We use your approximate location to estimate nearby stores, delivery fees, and arrival times.</p><div className="auth-actions"><button type="button" disabled={busy} onClick={allow}>{busy ? 'Finding location…' : 'Allow'}</button><button type="button" className="auth-secondary" disabled={busy} onClick={() => void resolveLocation()}>Not now</button></div></section></div>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const meQuery = useQuery({ queryKey: ['auth-me'], queryFn: getMe, retry: false, staleTime: Infinity })
  const [sessionUser, setSessionUser] = useState<AuthUser | null | undefined>(undefined)
  const [pendingLocation, setPendingLocation] = useState(false)
  const user = sessionUser !== undefined ? sessionUser : meQuery.data ?? null
  const ready = meQuery.isFetched
  const router = useRouter()
  const signIn = useCallback((next: AuthUser) => { setSessionUser(next); setPendingLocation(true) }, [])
  const signOut = useCallback(async () => { await logOut(); setSessionUser(null); router.push('/') }, [router])
  const value = useMemo(() => ({ user, ready, pendingLocation, signIn, signOut, askForLocation: () => setPendingLocation(true) }), [user, ready, pendingLocation, signIn, signOut])
  return <Context.Provider value={value}>{children}{pendingLocation && <LocationPrompt onDone={() => setPendingLocation(false)} />}</Context.Provider>
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider is missing'); return value }
