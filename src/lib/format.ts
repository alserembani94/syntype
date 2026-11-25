/**
 * Numbers, times and dates as players read them, in one place, so every
 * view says them the same way. Pure functions (format.test.ts).
 */

/** "72 wpm · 98%": a run's speed and accuracy. */
export const speed = (r: { wpm: number; accuracy: number }) => `${Math.round(r.wpm)} wpm · ${Math.round(r.accuracy)}%`

/** "25 Nov 2026, 14:02": an exact moment (the admin page). */
export const dateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** "25 Nov 2026". */
export const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** "1h 42m", "12m", "45s". */
export function duration(seconds: number): string {
  const s = Math.round(seconds)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/** "today", "yesterday", "3 days ago", "last week", or a date, as seen on `now`'s calendar day. */
export function whenPlayed(iso: string, now = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const then = new Date(iso)
  const days = Math.round((day(now) - day(then)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'last week'
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: then.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
}

/** "today 14:02", "yesterday 21:10", "22 Nov 20:31": a run's moment, for its row. */
export function runTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const when = whenPlayed(iso, now)
  const day = when === 'today' || when === 'yesterday' ? when : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return `${day} ${time}`
}
