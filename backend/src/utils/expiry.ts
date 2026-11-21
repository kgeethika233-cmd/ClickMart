export type ExpiryStatus = 'none' | 'fresh' | 'near_expiry' | 'expired';

export interface ExpiryFields {
  expiry_date: string | null;
  days_to_expiry: number | null;
  expiry_status: ExpiryStatus;
  badge: string | null;
}

export function computeExpiryInfo(expiryDate: string | Date | null | undefined): ExpiryFields {
  if (!expiryDate) {
    return { expiry_date: null, days_to_expiry: null, expiry_status: 'none', badge: null };
  }

  let dateStr: string;
  if (expiryDate instanceof Date) {
    const year = expiryDate.getFullYear();
    const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
    const day = String(expiryDate.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  } else {
    dateStr = String(expiryDate).slice(0, 10);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { expiry_date: null, days_to_expiry: null, expiry_status: 'none', badge: null };
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const expiryDateValue = new Date(Date.UTC(year, month - 1, day));
  if (
    expiryDateValue.getUTCFullYear() !== year ||
    expiryDateValue.getUTCMonth() !== month - 1 ||
    expiryDateValue.getUTCDate() !== day
  ) {
    return { expiry_date: null, days_to_expiry: null, expiry_status: 'none', badge: null };
  }

  const expiry = expiryDateValue.getTime();
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((expiry - today) / 86400000);
  const expiry_status: ExpiryStatus = days <= 0 ? 'expired' : days <= 7 ? 'near_expiry' : 'fresh';
  const badge =
    expiry_status === 'near_expiry'
      ? `Expires in ${days} ${days === 1 ? 'day' : 'days'}`
      : expiry_status === 'expired'
      ? 'Expired'
      : null;

  return { expiry_date: dateStr, days_to_expiry: days, expiry_status, badge };
}

