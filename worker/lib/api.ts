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
 *   POST /api/reports                     report a player or one of their runs
 *   POST /api/runs/start                  a run token, when a signed-in player starts a snippet
 *   POST /api/runs                        submit a finished run (runs.ts)
 *   GET  /api/boards?lang=                a language's boards: each snippet's top score (boards.ts)
 *   GET  /api/boards/:fingerprint?aids=   one board's top 15
 *   GET  /api/boards/:fingerprint/me      the signed-in player's place on it
 *   GET  /api/replays/:runId              a kept run on the boards, to replay
 *
 * The admin page's API, behind Cloudflare Access (access.ts checks its token
 * on every request):
 *
 *   GET  /api/admin/me                    the admin's email
 *   GET  /api/admin/players?q=            find players
 *   POST /api/admin/players/:id/:action   rename, hide, show, signout
 *   GET  /api/admin/reports?status=       the report queue: open or closed
 *   POST /api/admin/reports/close         resolve or dismiss reports about a player or run
 *   GET  /api/admin/actions?before=       the action log
 *   GET  /api/admin/replays/:runId        any kept run, to replay
 *   POST /api/admin/runs/:runId/remove    take a run off the boards
 */
import type { Db } from './db'
import { cookie, readCookies } from './cookies'
import { randomToken, sha256, sign, verify } from './crypto'
import { authorizeUrl, exchange, PROVIDERS, SignInError, type OAuthConfig, type Provider } from './oauth'
import { accessEmail, type AccessConfig } from './access'
import { actionLog, actOnPlayer, closeReports, findPlayers, PLAYER_ACTIONS, removeRun, report, reportQueue, type PlayerAction } from './moderation'
import { board, BOARD_CACHE_SECONDS, languageBoards, myPlace, runForReplay, validAids } from './boards'
import { MAX_BODY, gunzip, rejectionMessage, startRun, submitRun, type Assets } from './runs'
import { getPlayer, playerFor, publicPlayer, setName, touch, type PlayerRow } from './players'

export interface ApiConfig extends OAuthConfig, AccessConfig {
  SITE_URL: string
  SESSION_SECRET: string
  TURNSTILE_SITE_KEY: string
  TURNSTILE_SECRET_KEY: string
}

export interface Deps {
  db: Db
  config: ApiConfig
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  /** The site's static files (for the snippet data files). */
  assets: Assets
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
    // Up, and with its tables: the migrations in migrations/ have been applied.
    const row = await db.prepare("SELECT count(*) AS tables FROM sqlite_master WHERE type = 'table' AND name IN ('players', 'bests', 'logs', 'reports')").first<{ tables: number }>()
    return json({ ok: true, database: row !== null, tables: row?.tables === 4 })
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
    return json({ signedIn: true, player: publicPlayer(player), turnstileSiteKey: config.TURNSTILE_SITE_KEY })
  }

  if (url.pathname === '/api/me/name' && method === 'POST') {
    if (!fromOurPages(request, config)) return json({ error: 'Not allowed from here.' }, 403)
    const player = await signedIn(request, deps)
    if (!player) return json({ error: 'Sign in first.' }, 401)
    const body = (await request.json().catch(() => null)) as { name?: unknown } | null
    const result = await setName(db, player, body?.name, now)
    return result.ok ? json({ signedIn: true, player: publicPlayer(result.player) }) : json({ error: result.error }, result.status)
  }

  if (url.pathname === '/api/reports' && method === 'POST') {
    if (!fromOurPages(request, config)) return json({ error: 'Not allowed from here.' }, 403)
    const player = await signedIn(request, deps)
    if (!player) return json({ error: 'Sign in to report.' }, 401)
    const result = await report(db, player, await request.json().catch(() => null), now)
    return result.ok ? json({ ok: true }, 201) : json({ error: result.error }, result.status)
  }

  if (url.pathname === '/api/runs/start' && method === 'POST') {
    if (!fromOurPages(request, config)) return json({ error: 'Not allowed from here.' }, 403)
    const player = await signedIn(request, deps)
    if (!player) return json({ error: 'Sign in to submit runs.' }, 401)
    if (!player.name) return json({ error: 'Choose your leaderboard name first.' }, 403)
    const result = await startRun(config, deps.assets, player, await request.json().catch(() => null), now)
    return result.ok ? json({ token: result.token }) : json({ error: result.error }, result.status)
  }

  if (url.pathname === '/api/runs' && method === 'POST') {
    if (!fromOurPages(request, config)) return json({ error: 'Not allowed from here.' }, 403)
    const player = await signedIn(request, deps)
    if (!player) return json({ error: 'Sign in to submit runs.' }, 401)
    const text = await request.text()
    if (text.length > MAX_BODY) return json({ accepted: false, reason: 'too-long', error: rejectionMessage('too-long') }, 413)
    let body: unknown = null
    try {
      body = JSON.parse(text)
    } catch {
      return json({ error: 'Send JSON.' }, 400)
    }
    const result = await submitRun({ db, config, assets: deps.assets, fetch: deps.fetch, ip: request.headers.get('CF-Connecting-IP') }, player, body, now)
    return result.ok ? json({ accepted: true, ...result.run }) : json({ accepted: false, reason: result.reason, error: result.error }, result.status)
  }

  // Boards and replays are the same for everyone: cached for a minute (worker/index.ts).
  const shared = { 'Cache-Control': `public, max-age=${BOARD_CACHE_SECONDS}` }
  if (url.pathname === '/api/boards' && method === 'GET') {
    const language = url.searchParams.get('lang') ?? ''
    if (!/^[a-z0-9-]{1,40}$/.test(language)) return json({ error: 'Which language?' }, 400)
    return json(await languageBoards(db, deps.assets, language, now.getTime()), 200, shared)
  }
  const boardPath = url.pathname.match(/^\/api\/boards\/([0-9a-f]{64})(\/me)?$/)
  if (boardPath && method === 'GET') {
    const aids = validAids(url.searchParams.get('aids'))
    if (boardPath[2]) {
      const player = await signedIn(request, deps)
      if (!player) return json({ signedIn: false })
      return json({ signedIn: true, row: await myPlace(db, player.id, boardPath[1], aids) })
    }
    const b = await board(db, deps.assets, boardPath[1], aids, now.getTime())
    return b ? json(b, 200, shared) : json({ error: 'No such board.' }, 404)
  }
  const replayPath = url.pathname.match(/^\/api\/replays\/([\w-]{1,64})$/)
  if (replayPath && method === 'GET') {
    const run = await runForReplay(db, replayPath[1], { admin: false })
    return run ? json({ ...run, log: JSON.parse(await gunzip(new Uint8Array(run.log))) }, 200, shared) : json({ error: 'That run can’t be replayed.' }, 404)
  }

  if (url.pathname.startsWith('/api/admin/')) return admin(request, url, deps, now)

  return json({ error: 'Not found' }, 404)
}

async function admin(request: Request, url: URL, deps: Deps, now: Date): Promise<Response> {
  const { config, db } = deps
  const email = await accessEmail(request, config, deps.fetch, now.getTime())
  if (!email) return json({ error: 'Admins only. Sign in through Cloudflare Access.' }, 403)
  const path = url.pathname.slice('/api/admin'.length)
  const method = request.method
  if (method === 'POST' && !fromOurPages(request, config)) return json({ error: 'Not allowed from here.' }, 403)
  const body = () => request.json().catch(() => null)
  const reply = (result: { ok: true } | { ok: false; status: number; error: string }) =>
    result.ok ? json(result) : json({ error: result.error }, result.status)

  if (path === '/me' && method === 'GET') return json({ email })
  if (path === '/players' && method === 'GET') return json({ players: await findPlayers(db, url.searchParams.get('q')) })
  const act = path.match(/^\/players\/([^/]+)\/([a-z]+)$/)
  if (act && method === 'POST' && PLAYER_ACTIONS.includes(act[2] as PlayerAction)) {
    return reply(await actOnPlayer(db, email, decodeURIComponent(act[1]), act[2] as PlayerAction, await body(), now))
  }
  if (path === '/reports' && method === 'GET') {
    return json({ groups: await reportQueue(db, url.searchParams.get('status') === 'closed' ? 'closed' : 'open') })
  }
  if (path === '/reports/close' && method === 'POST') return reply(await closeReports(db, email, await body(), now))
  if (path === '/actions' && method === 'GET') return json({ actions: await actionLog(db, url.searchParams.get('before')) })
  const replay = path.match(/^\/replays\/([\w-]{1,64})$/)
  if (replay && method === 'GET') {
    const run = await runForReplay(db, replay[1], { admin: true })
    return run ? json({ ...run, log: JSON.parse(await gunzip(new Uint8Array(run.log))) }) : json({ error: 'That run’s keystrokes aren’t kept.' }, 404)
  }
  const remove = path.match(/^\/runs\/([\w-]{1,64})\/remove$/)
  if (remove && method === 'POST') return reply(await removeRun(db, email, remove[1], now))
  return json({ error: 'Not found' }, 404)
}
