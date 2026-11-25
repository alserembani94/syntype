/**
 * The edge cache's key for answers that are the same for everyone: boards,
 * language overviews and replays (worker/index.ts). Built only from the
 * parameters the routes accept, so extra or reordered query strings can't
 * miss the cache and reach the database.
 */
import { validAids } from './boards'

export function sharedCacheKey(request: Request): string | null {
  if (request.method !== 'GET') return null
  const url = new URL(request.url)
  const base = `${url.origin}${url.pathname}`
  if (url.pathname === '/api/boards') {
    const lang = url.searchParams.get('lang') ?? ''
    return /^[a-z0-9-]{1,40}$/.test(lang) ? `${base}?lang=${lang}` : null
  }
  if (/^\/api\/boards\/[0-9a-f]{64}$/.test(url.pathname)) return `${base}?aids=${validAids(url.searchParams.get('aids'))}`
  if (/^\/api\/replays\/[\w-]{1,64}$/.test(url.pathname)) return base
  return null
}
