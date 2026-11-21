import type { Product } from '@/types/contract'

export type ExpiryStatus = 'none' | 'fresh' | 'near_expiry' | 'expired'
export type ExpiryFields = {
  expiry_date: string | null
  days_to_expiry: number | null
  expiry_status: ExpiryStatus
  badge: string | null
}

export function expiryInfo(expiryDate: string | null | undefined): ExpiryFields {
  if (!expiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
    return { expiry_date: null, days_to_expiry: null, expiry_status: 'none', badge: null }
  }

  const [year, month, day] = expiryDate.split('-').map(Number)
  const expiryDateValue = new Date(Date.UTC(year, month - 1, day))
  if (expiryDateValue.getUTCFullYear() !== year || expiryDateValue.getUTCMonth() !== month - 1 || expiryDateValue.getUTCDate() !== day) {
    return { expiry_date: null, days_to_expiry: null, expiry_status: 'none', badge: null }
  }
  const expiry = expiryDateValue.getTime()
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.floor((expiry - today) / 86400000)
  const expiry_status = days <= 0 ? 'expired' : days <= 7 ? 'near_expiry' : 'fresh'
  const badge = expiry_status === 'near_expiry'
    ? `Expires in ${days} ${days === 1 ? 'day' : 'days'}`
    : expiry_status === 'expired' ? 'Expired' : null

  return { expiry_date: expiryDate, days_to_expiry: days, expiry_status, badge }
}

export function withCurrentExpiry<T extends Product>(product: T): T & ExpiryFields {
  return { ...product, ...expiryInfo(product.expiry_date) }
}

export function expiryDateInDays(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
