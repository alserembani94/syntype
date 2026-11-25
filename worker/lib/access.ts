/**
 * Who is using the admin page, from Cloudflare Access.
 *
 * Access sits in front of /admin and /api/admin: Cloudflare's own login runs
 * first, and every request it lets through carries a signed token in the
 * Cf-Access-Jwt-Assertion header. A Worker with static assets isn't handed the
 * verified identity, so this checks the token itself, as Cloudflare's docs
 * describe ("Validate JWTs"): an RS256 signature by one of the team's keys
 * (published at <team domain>/cdn-cgi/access/certs), issued by the team
 * domain, for this application's audience (AUD) tag, and not expired.
 *
 * That check, not Access's redirect, is what protects the admin API: a
 * request that reaches the Worker some other way (the workers.dev address,
 * say) has no valid token and gets nothing.
 */
import { fromBase64url } from './crypto'

export interface AccessConfig {
  /** https://<team>.cloudflareaccess.com */
  ACCESS_TEAM_DOMAIN: string
  /** The Access application's audience tag. */
  ACCESS_AUD: string
  /**
   * Local development only (.dev.vars): treat requests to localhost as this
   * admin, since Access doesn't run there. Ignored for any other host.
   */
  ADMIN_DEV_EMAIL?: string
}

export const ACCESS_HEADER = 'Cf-Access-Jwt-Assertion'

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

interface Jwk extends JsonWebKey {
  kid?: string
}

/** The team's signing keys, by key ID, kept for the life of the isolate. */
const keyCache = new Map<string, { keys: Map<string, CryptoKey>; fetchedAt: number }>()
/** Keys rotate: an unknown key ID refetches them, but at most once a minute. */
const REFETCH_MS = 60_000

async function fetchKeys(team: string, fetchImpl: Fetch): Promise<Map<string, CryptoKey>> {
  const res = await fetchImpl(`${team}/cdn-cgi/access/certs`)
  if (!res.ok) throw new Error(`Access keys: HTTP ${res.status}`)
  const body = (await res.json()) as { keys?: Jwk[] }
  const keys = new Map<string, CryptoKey>()
  for (const jwk of body.keys ?? []) {
    if (!jwk.kid || jwk.kty !== 'RSA') continue
    const { kid, ...key } = jwk
    keys.set(kid, await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']))
  }
  return keys
}

async function keyFor(team: string, kid: string, fetchImpl: Fetch, now: number): Promise<CryptoKey | undefined> {
  let cached = keyCache.get(team)
  if (!cached || (!cached.keys.has(kid) && now - cached.fetchedAt > REFETCH_MS)) {
    cached = { keys: await fetchKeys(team, fetchImpl), fetchedAt: now }
    keyCache.set(team, cached)
  }
  return cached.keys.get(kid)
}

/** Forget the cached keys (tests). */
export const clearAccessKeys = () => keyCache.clear()

const decode = <T>(part: string): T | null => {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64url(part))) as T
  } catch {
    return null
  }
}

const isLocal = (url: string) => ['localhost', '127.0.0.1'].includes(new URL(url).hostname)

/**
 * The email of the admin making this request, or null if Access didn't let it
 * through: no token, a forged or expired one, or one for another application.
 */
export async function accessEmail(request: Request, config: AccessConfig, fetchImpl: Fetch, now: number): Promise<string | null> {
  if (config.ADMIN_DEV_EMAIL && isLocal(request.url)) return config.ADMIN_DEV_EMAIL
  const team = config.ACCESS_TEAM_DOMAIN?.replace(/\/+$/, '')
  if (!team || !config.ACCESS_AUD) return null

  const token = request.headers.get(ACCESS_HEADER)
  const parts = token?.split('.')
  if (!parts || parts.length !== 3) return null
  const header = decode<{ alg?: string; kid?: string }>(parts[0])
  const claims = decode<{ iss?: string; aud?: string | string[]; exp?: number; nbf?: number; email?: unknown }>(parts[1])
  if (!header || !claims || header.alg !== 'RS256' || !header.kid) return null

  let key: CryptoKey | undefined
  try {
    key = await keyFor(team, header.kid, fetchImpl, now)
  } catch (err) {
    console.warn(err instanceof Error ? err.message : err)
    return null
  }
  if (!key) return null
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  let genuine = false
  try {
    genuine = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64url(parts[2]), signed)
  } catch {
    return null
  }
  if (!genuine) return null

  const seconds = now / 1000
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (claims.iss !== team || !audiences.includes(config.ACCESS_AUD)) return null
  if (typeof claims.exp !== 'number' || claims.exp <= seconds) return null
  if (typeof claims.nbf === 'number' && claims.nbf > seconds + 60) return null
  // Service tokens carry no email; only people use the admin page.
  return typeof claims.email === 'string' && claims.email ? claims.email : null
}
