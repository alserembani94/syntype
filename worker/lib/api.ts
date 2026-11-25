/**
 * The leaderboard API (docs/leaderboard.md). Plain functions of a Request,
 * so they run the same in the Worker and in tests.
 *
 *   GET  /api/health                      the Worker and database are up
 *   GET  /api/auth/:provider/start        begin signing in (?return=/path)
 *   GET  /api/auth/:provider/callback     the provider sends the player back here
 *   POST /api/auth/signout                sign out
 *   GET  /api/me                          the signed-in player, or { signedIn: false }
 *   POST /api/me/name                     set or change the leaderboard name
 */
import type { Db } from './db'
import { cookie, readCookies } from './cookies'
import { randomToken, sha256, sign, verify } from './crypto'
import { authorizeUrl, exchange, PROVIDERS, SignInError, type OAuthConfig, type Provider } from './oauth'
import { getPlayer, playerFor, publicPlayer, setName, touch, type PlayerRow } from './players'

export interface ApiConfig extends OAuthConfig {
  SITE_URL: string
  SESSION_SECRET: string
}

export interface Deps {
  db: Db
  config: ApiConfig
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  now?: () => Date
}

export const SESSION_COOKIE = 'syntype_session'
export const SIGNIN_COOKIE = 'syntype_signin'
/** Signed in for 30 days from the last sign-in. */
export const SESSION_DAYS = 30
const SIGNIN_MINUTES = 10

/** Development servers allowed alongside the site itself. */
const DEV_ORIGINS = ['http://localhost:8787', 'http://127.0.0.1:8787']

/**
 * The origin to build links on: this request's, if it's the site or a local
 * development server, otherwise the site's. Sign-in never redirects anywhere else.
 */
export function originOf(request: Request, config: ApiConfig): string {
  const origin = new URL(request.url).origin
  return origin === config.SITE_URL || DEV_ORIGINS.includes(origin) ? origin : config.SITE_URL
}

/** A path on this site to go back to after signing in; anything else becomes "/". */
export function safeReturn(path: string | null): string {
  return path && /^\/(?!\/)[^\\\s]*$/.test(path) ? path : '/'
}

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })

const redirect = (to: string, cookies: string[] = []) => {
  const headers = new Headers({ Location: to, 'Cache-Control': 'no-store' })
  for (const c of cookies) headers.append('Set-Cookie', c)
  return new Response(null, { status: 302, headers })
}

interface Session {
  p: string
  v: number
  exp: number
}

/** The signed-in player, if the session cookie is genuine and still current. */
async function signedIn(request: Request, deps: Deps): Promise<PlayerRow | null> {
  const token = readCookies(request.headers.get('Cookie'))[SESSION_COOKIE]
  const session = await verify<Session>(deps.config.SESSION_SECRET, token, (deps.now?.() ?? new Date()).getTime())
  if (!session) return null
  const player = await getPlayer(deps.db, session.p)
  // A deleted player, or one signed out everywhere since, no longer counts.
  return player && player.session_version === session.v ? player : null
}

/**
 * Requests that change something must come from the site's own pages: the
 * browser always sends Origin on a POST, and other sites can't fake it.
 */
function fromOurPages(request: Request, config: ApiConfig): boolean {
  return request.headers.get('Origin') === originOf(request, config)
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  const url = new URL(request.url)
  const { config, db } = deps
  const now = deps.now?.() ?? new Date()
  const secure = url.protocol === 'https:'
  const method = request.method

  if (url.pathname === '/api/health' && method === 'GET') {
    const row = await db.prepare('SELECT 1 AS up').first<{ up: number }>()
    return json({ ok: true, database: row?.up === 1 })
  }

  const auth = url.pathname.match(/^\/api\/auth\/(github|google)\/(start|callback)$/)
  if (auth && method === 'GET') {
    const provider = auth[1] as Provider
    if (!PROVIDERS.includes(provider)) return json({ error: 'Unknown sign-in provider.' }, 404)
    const origin = originOf(request, config)

    if (auth[2] === 'start') {
      const state = randomToken()
      const verifier = randomToken(48)
      const pending = await sign(config.SESSION_SECRET, {
        s: state,
        cv: verifier,
        pr: provider,
        r: safeReturn(url.searchParams.get('return')),
        exp: now.getTime() + SIGNIN_MINUTES * 60_000,
      })
      return redirect(authorizeUrl(provider, config, origin, state, await sha256(verifier)), [
        cookie(SIGNIN_COOKIE, pending, { maxAge: SIGNIN_MINUTES * 60, secure, path: '/api/auth' }),
      ])
    }

    // The callback: check it answers the sign-in this browser started.
    const pending = await verify<{ s: string; cv: string; pr: string; r: string; exp: number }>(
      config.SESSION_SECRET,
      readCookies(request.headers.get('Cookie'))[SIGNIN_COOKIE],
      now.getTime(),
    )
    const clearPending = cookie(SIGNIN_COOKIE, '', { maxAge: 0, secure, path: '/api/auth' })
    const back = (r: string, error?: string) => redirect(error ? `${r}${r.includes('?') ? '&' : '?'}signin=${encodeURIComponent(error)}` : r, [clearPending])
    if (url.searchParams.get('error')) return back(pending?.r ?? '/', 'cancelled')
    const code = url.searchParams.get('code')
    if (!pending || pending.pr !== provider || !code || url.searchParams.get('state') !== pending.s) return back(pending?.r ?? '/', 'expired')
    try {
      const profile = await exchange(provider, config, origin, code, pending.cv, deps.fetch, now.getTime())
      const player = await playerFor(db, provider, profile, now)
      await touch(db, player, now)
      const session = await sign(config.SESSION_SECRET, { p: player.id, v: player.session_version, exp: now.getTime() + SESSION_DAYS * 86_400_000 })
      return redirect(pending.r, [clearPending, cookie(SESSION_COOKIE, session, { maxAge: SESSION_DAYS * 86_400, secure })])
    } catch (err) {
      console.warn('Sign-in failed:', err instanceof Error ? err.message : err)
      return back(pending.r, err instanceof SignInError ? 'refused' : 'failed')
    }
  }

  if (url.pathname === '/api/auth/signout' && method === 'POST') {
    if (!fromOurPages(request, config)) return json({ error: 'Not allowed from here.' }, 403)
    return json({ signedIn: false }, 200, { 'Set-Cookie': cookie(SESSION_COOKIE, '', { maxAge: 0, secure }) })
  }

  if (url.pathname === '/api/me' && method === 'GET') {
    const player = await signedIn(request, deps)
    if (!player) return json({ signedIn: false })
    await touch(db, player, now)
    return json({ signedIn: true, player: publicPlayer(player) })
  }

  if (url.pathname === '/api/me/name' && method === 'POST') {
    if (!fromOurPages(request, config)) return json({ error: 'Not allowed from here.' }, 403)
    const player = await signedIn(request, deps)
    if (!player) return json({ error: 'Sign in first.' }, 401)
    const body = (await request.json().catch(() => null)) as { name?: unknown } | null
    const result = await setName(db, player, body?.name, now)
    return result.ok ? json({ signedIn: true, player: publicPlayer(result.player) }) : json({ error: result.error }, result.status)
  }

  return json({ error: 'Not found' }, 404)
}
