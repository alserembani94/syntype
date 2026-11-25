/**
 * Calls to Syntype's own API, in one place: same-origin cookies, JSON both
 * ways, and failures turned into words a player can act on rather than
 * thrown. Every answer the API sends is JSON; anything else (the artifact's
 * page, Cloudflare Access's login page) is a failure with no body.
 */

export const OFFLINE = 'Couldn’t reach Syntype. Check your connection and try again.'
export const TRY_AGAIN = 'That didn’t work. Please try again.'

/** The error body the API sends with a failure (`reason` on a rejected run). */
type ErrorBody = { error?: string; reason?: string }

export type Reply<T> =
  | { ok: true; status: number; body: T }
  /** `status` is 0 when the server couldn't be reached; `body` is null when the answer wasn't JSON. */
  | { ok: false; status: number; error: string; body: (Partial<T> & ErrorBody) | null }

/** GET, or POST when there is a body. `fallback` words a failure the server didn't explain. */
export async function api<T>(path: string, opts: { body?: unknown; method?: 'GET' | 'POST'; fallback?: string } = {}): Promise<Reply<T>> {
  const post = opts.method === 'POST' || opts.body !== undefined
  let res: Response
  try {
    res = await fetch(path, {
      method: post ? 'POST' : 'GET',
      credentials: 'same-origin',
      headers: post ? { Accept: 'application/json', 'Content-Type': 'application/json' } : { Accept: 'application/json' },
      body: post ? JSON.stringify(opts.body ?? {}) : undefined,
    })
  } catch {
    return { ok: false, status: 0, error: OFFLINE, body: null }
  }
  const json = res.headers.get('Content-Type')?.includes('json')
  const body = json ? ((await res.json().catch(() => null)) as (T & ErrorBody) | null) : null
  if (res.ok && body) return { ok: true, status: res.status, body }
  return { ok: false, status: res.status, error: body?.error ?? opts.fallback ?? TRY_AGAIN, body }
}
