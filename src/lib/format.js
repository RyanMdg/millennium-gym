const TZ = 'Asia/Manila'

export const peso = (n) =>
  n == null ? '—' : `₱${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PH', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-PH', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }) : '—'

export const fmtDateTime = (d) => (d ? `${fmtDate(d)} · ${fmtTime(d)}` : '—')

export function timeAgo(d) {
  const s = Math.round((Date.now() - new Date(d)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// Start of a Manila calendar day as a real Date (Manila is UTC+8, no DST).
export function manilaDayStart(offsetDays = 0) {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
    .split('-')
    .map(Number)
  return new Date(Date.UTC(y, m - 1, d + offsetDays) - 8 * 3600 * 1000)
}

// Today's date in Manila as YYYY-MM-DD (the value format of <input type="date">).
export const manilaToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

// [start, end) of the day / week (Mon–Sun) / month containing `dateStr`, in Manila time.
export function manilaRange(unit, dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const at = (yy, mm, dd) => new Date(Date.UTC(yy, mm - 1, dd) - 8 * 3600 * 1000)
  if (unit === 'month') return [at(y, m, 1), at(y, m + 1, 1)]
  if (unit === 'week') {
    const sinceMonday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
    return [at(y, m, d - sinceMonday), at(y, m, d - sinceMonday + 7)]
  }
  return [at(y, m, d), at(y, m, d + 1)]
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export const daysLeft = (expires) => Math.ceil((new Date(expires) - Date.now()) / 86_400_000)

export function memberState(p) {
  if (!p) return null
  if (p.status === 'disabled') return 'disabled'
  if (p.status === 'pending') return 'pending'
  if (p.status === 'rejected') return 'rejected'
  if (!p.expires_at || new Date(p.expires_at) <= new Date()) return 'expired'
  if (daysLeft(p.expires_at) <= 7) return 'expiring'
  return 'active'
}

export const STATE_BADGE = {
  active: ['Active', 'green'],
  expiring: ['Expiring', 'amber'],
  expired: ['Expired', 'red'],
  pending: ['Pending', 'amber'],
  rejected: ['Rejected', 'red'],
  disabled: ['Disabled', 'gray'],
}

export const methodLabel = (m) => (m === 'gcash' ? 'GCash' : 'Counter')
