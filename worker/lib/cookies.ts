/** Reading and writing cookies. */

export function readCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const name = part.slice(0, i).trim()
    if (!name) continue
    // A malformed value (any cookie on the host, not only ours) is skipped, not an error.
    try {
      out[name] = decodeURIComponent(part.slice(i + 1).trim())
    } catch {
      /* not ours to read */
    }
  }
  return out
}

export interface CookieOptions {
  /** Seconds; 0 deletes the cookie. */
  maxAge: number
  /** Only over HTTPS. Off for http://localhost during development. */
  secure: boolean
  path?: string
}

/** Always HttpOnly (scripts can't read it) and SameSite=Lax (not sent on other sites' requests). */
export function cookie(name: string, value: string, o: CookieOptions): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${o.path ?? '/'}`,
    `Max-Age=${o.maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    o.secure && 'Secure',
  ]
    .filter(Boolean)
    .join('; ')
}
