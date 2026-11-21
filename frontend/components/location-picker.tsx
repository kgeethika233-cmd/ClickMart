'use client'

import { useEffect, useState } from 'react'
import { MapPin, X } from 'lucide-react'
import { getAreasForCity, MOCK_LOCATIONS } from '@/lib/mock-locations'
import { loadUserLocation, saveUserLocation, subscribeToLocation, type StoredUserLocation } from '@/lib/location'
import { getAuthToken, updateLocation } from '@/lib/api'

export default function LocationPicker() {
  const [open, setOpen] = useState(false)
  const [location, setLocation] = useState<StoredUserLocation | null>(null)
  const [city, setCity] = useState(MOCK_LOCATIONS[0].city)
  const [pincode, setPincode] = useState('')
  useEffect(() => {
    const update = (saved: StoredUserLocation | null) => { setLocation(saved); if (saved) { setCity(saved.city); setPincode(saved.pincode) } }
    update(loadUserLocation())
    return subscribeToLocation(update)
  }, [])
  const areas = getAreasForCity(city)
  const choose = () => {
    const area = areas.find(candidate => candidate.pincode === pincode)
    if (!area) return
    const next = { ...area, city }
    saveUserLocation(next)
    if (getAuthToken()) void updateLocation({ city, lat: next.lat, lng: next.lng }).catch(() => {})
    setLocation(next)
    setOpen(false)
  }
  return <>
    <div className="location-chip"><MapPin aria-hidden="true"/><span>{location?.city ?? 'Set location'}</span><button type="button" onClick={() => setOpen(true)}>Change</button></div>
    {open && <div className="auth-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false) }}><section className="location-dialog" role="dialog" aria-modal="true" aria-labelledby="location-picker-title"><button type="button" className="location-close" aria-label="Close location picker" onClick={() => setOpen(false)}><X aria-hidden="true"/></button><h2 id="location-picker-title">Choose your delivery location</h2><p>Compare nearby delivery times, fees, and availability.</p><label className="auth-field">City<select value={city} onChange={event => { setCity(event.target.value); setPincode('') }}>{MOCK_LOCATIONS.map(item => <option key={item.city} value={item.city}>{item.city}</option>)}</select></label><label className="auth-field">Area<select value={pincode} onChange={event => setPincode(event.target.value)}><option value="">Choose an area</option>{areas.map(area => <option key={area.pincode} value={area.pincode}>{area.name} · {area.pincode}</option>)}</select></label><div className="auth-actions"><button type="button" disabled={!pincode} onClick={choose}>Save location</button><button type="button" className="auth-secondary" onClick={() => setOpen(false)}>Cancel</button></div></section></div>}
  </>
}
