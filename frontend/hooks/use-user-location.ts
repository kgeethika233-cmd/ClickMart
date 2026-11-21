'use client'

import { useEffect, useState } from 'react'
import { loadUserLocation, subscribeToLocation, type StoredUserLocation } from '@/lib/location'
export function useUserLocation() {
  const [location, setLocation] = useState<StoredUserLocation | null>(null)
  useEffect(() => { setLocation(loadUserLocation()); return subscribeToLocation(setLocation) }, [])
  return location
}
