/**
 * The API against a real local D1 database (Wrangler's getPlatformProxy runs
 * the same engine as Cloudflare), with GitHub and Google simulated.
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { handle, originOf, safeReturn, SESSION_COOKIE, SIGNIN_COOKIE, type ApiConfig, type Deps } from './api'
import { sign } from './crypto'
import type { Db } from './db'
import { RENAME_EVERY_MS } from './names'

const config: ApiConfig = {
  SITE_URL: 'https://syntype.vercel.my',
  GITHUB_CLIENT_ID: 'gh-client',
  GITHUB_CLIENT_SECRET: 'gh-secret',
  GOOGLE_CLIENT_ID: 'google-client',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  SESSION_SECRET: 'test-session-secret',
}
const SITE = config.SITE_URL

let db: Db
let dispose: () => Promise<void>
beforeAll(async () => {
  const proxy = await getPlatformProxy<{ DB: Db }>({ persist: false })
  db = proxy.env.DB
  dispose = proxy.dispose
  // The real migration, one statement at a time.
  const sql = readFileSync(new URL('../../migrations/0001_init.sql', import.meta.url), 'utf8').replace(/--[^\n]*/g, '')
  for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) await db.prepare(stmt).run()
}, 60_000)
afterAll(() => dispose?.())

let ids = 1000
/** A simulated provider: GitHub or Google answering the token and profile requests. */
function providers(profile: { github?: { id: number; login: string }; google?: Record<string, unknown>; fail?: boolean }) {
  const calls: string[] = []
  const fetchImpl = async (input: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${input}`)
    if (profile.fail) return Response.json({ error: 'bad_verification_code' })
    if (input === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: 'gh-token' })
    if (input === 'https://api.github.com/user') return Response.json(profile.github)
    if (input === 'https://oauth2.googleapis.com/token') {
      const body = btoa(JSON.stringify(profile.google)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
      return Response.json({ id_token: `e30.${body}.sig` })
    }
    return new Response('unexpected', { status: 500 })
  }
  return { fetchImpl, calls }
}

const deps = (fetchImpl: Deps['fetch'] = async () => new Response(null, { status: 500 }), now?: Date): Deps => ({ db, config, fetch: fetchImpl, now: now && (() => now) })
const cookieFrom = (res: Response, name: string) =>
  res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))?.split(';')[0].slice(name.length + 1)

/** Signs in through the whole flow; returns the session cookie and where it landed. */
async function signIn(provider: 'github' | 'google', fetchImpl: Deps['fetch'], ret = '/runs') {
  const start = await handle(new Request(`${SITE}/api/auth/${provider}/start?return=${encodeURIComponent(ret)}`), deps(fetchImpl))
  const pending = cookieFrom(start, SIGNIN_COOKIE)!
  const state = new URL(start.headers.get('Location')!).searchParams.get('state')!
  const back = await handle(
    new Request(`${SITE}/api/auth/${provider}/callback?code=abc&state=${state}`, { headers: { Cookie: `${SIGNIN_COOKIE}=${pending}` } }),
    deps(fetchImpl),
  )
  return { start, back, session: cookieFrom(back, SESSION_COOKIE) }
}

const me = async (session?: string, now?: Date) =>
  (await (await handle(new Request(`${SITE}/api/me`, { headers: session ? { Cookie: `${SESSION_COOKIE}=${session}` } : {} }), deps(undefined, now))).json()) as {
    signedIn: boolean
    player?: { id: string; name: string | null; suggestedName: string; provider: string }
  }

const rename = (session: string, name: unknown, origin: string | null = SITE, now?: Date) =>
  handle(
    new Request(`${SITE}/api/me/name`, {
      method: 'POST',
      headers: { Cookie: `${SESSION_COOKIE}=${session}`, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify({ name }),
    }),
    deps(undefined, now),
  )

describe('health', () => {
  it('reports the database is up', async () => {
    expect(await (await handle(new Request(`${SITE}/api/health`), deps())).json()).toEqual({ ok: true, database: true })
  })
})

describe('signing in', () => {
  it('sends GitHub players to GitHub with a one-time state and no scopes', async () => {
    const res = await handle(new Request(`${SITE}/api/auth/github/start?return=/python`), deps())
    expect(res.status).toBe(302)
    const to = new URL(res.headers.get('Location')!)
    expect(to.origin + to.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(to.searchParams.get('client_id')).toBe('gh-client')
    expect(to.searchParams.get('redirect_uri')).toBe(`${SITE}/api/auth/github/callback`)
    expect(to.searchParams.get('state')).toMatch(/^[\w-]{40,}$/)
    expect(to.searchParams.get('scope')).toBeNull()
    expect(res.headers.getSetCookie()[0]).toMatch(/HttpOnly; SameSite=Lax; Secure$/)
  })

  it('asks Google for the basic profile only, with PKCE', async () => {
    const res = await handle(new Request(`${SITE}/api/auth/google/start`), deps())
    const to = new URL(res.headers.get('Location')!)
    expect(to.origin).toBe('https://accounts.google.com')
    expect(to.searchParams.get('scope')).toBe('openid profile')
    expect(to.searchParams.get('code_challenge_method')).toBe('S256')
    expect(to.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
  })

  it('a first GitHub sign-in creates a player, suggests the username, and signs them in', async () => {
    const id = ids++
    const { fetchImpl, calls } = providers({ github: { id, login: 'ada-lovelace' } })
    const { back, session } = await signIn('github', fetchImpl)
    expect(back.status).toBe(302)
    expect(back.headers.get('Location')).toBe('/runs')
    expect(session).toBeDefined()
    expect(calls).toEqual(['POST https://github.com/login/oauth/access_token', 'GET https://api.github.com/user'])
    const m = await me(session)
    expect(m).toMatchObject({ signedIn: true, player: { name: null, suggestedName: 'ada-lovelace', provider: 'github' } })
    // Signing in again finds the same player.
    const again = await signIn('github', providers({ github: { id, login: 'ada-lovelace' } }).fetchImpl)
    expect((await me(again.session)).player?.id).toBe(m.player?.id)
  })

  it('a Google sign-in suggests a first name with digits, never the full name, and stores no email', async () => {
    const sub = `g-${ids++}`
    const { fetchImpl } = providers({
      google: { iss: 'https://accounts.google.com', aud: 'google-client', sub, exp: Date.now() / 1000 + 300, given_name: 'Grace', name: 'Grace Hopper', email: 'grace@example.com' },
    })
    const { session } = await signIn('google', fetchImpl)
    const m = await me(session)
    expect(m.player?.suggestedName).toMatch(/^grace-\d{3}$/)
    const row = await db.prepare('SELECT * FROM players WHERE provider_id = ?').bind(sub).first<Record<string, unknown>>()
    expect(JSON.stringify(row)).not.toMatch(/grace@example\.com|Hopper/)
  })

  it('refuses a Google sign-in meant for another app', async () => {
    const { fetchImpl } = providers({ google: { iss: 'https://accounts.google.com', aud: 'someone-else', sub: 'x', exp: Date.now() / 1000 + 300 } })
    const { back, session } = await signIn('google', fetchImpl)
    expect(back.headers.get('Location')).toBe('/runs?signin=refused')
    expect(session).toBeUndefined()
  })

  it('refuses a callback without the matching state, so a sign-in cannot be forged', async () => {
    const start = await handle(new Request(`${SITE}/api/auth/github/start`), deps())
    const pending = cookieFrom(start, SIGNIN_COOKIE)!
    const back = await handle(
      new Request(`${SITE}/api/auth/github/callback?code=abc&state=guessed`, { headers: { Cookie: `${SIGNIN_COOKIE}=${pending}` } }),
      deps(providers({ github: { id: 1, login: 'x' } }).fetchImpl),
    )
    expect(back.headers.get('Location')).toBe('/?signin=expired')
    expect(cookieFrom(back, SESSION_COOKIE)).toBeUndefined()
  })

  it('reports a cancelled sign-in, and a provider that refuses the code', async () => {
    const start = await handle(new Request(`${SITE}/api/auth/github/start?return=/go`), deps())
    const pending = cookieFrom(start, SIGNIN_COOKIE)!
    const cancelled = await handle(new Request(`${SITE}/api/auth/github/callback?error=access_denied`, { headers: { Cookie: `${SIGNIN_COOKIE}=${pending}` } }), deps())
    expect(cancelled.headers.get('Location')).toBe('/go?signin=cancelled')
    const { back } = await signIn('github', providers({ fail: true }).fetchImpl, '/go')
    expect(back.headers.get('Location')).toBe('/go?signin=refused')
  })

  it('only ever sends players back to a path on this site', () => {
    expect(safeReturn('/rust')).toBe('/rust')
    expect(safeReturn('/runs?lang=go')).toBe('/runs?lang=go')
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'runs', null, '/a b']) expect(safeReturn(bad)).toBe('/')
    expect(originOf(new Request('https://evil.example/api/auth/github/start'), config)).toBe(SITE)
    expect(originOf(new Request('http://localhost:8787/api/me'), config)).toBe('http://localhost:8787')
  })
})

describe('sessions', () => {
  it('a forged, expired or outdated session cookie signs no one in', async () => {
    const { session } = await signIn('github', providers({ github: { id: ids++, login: 'session-test' } }).fetchImpl)
    const player = (await me(session)).player!
    expect((await me(session!.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')))).signedIn).toBe(false)
    const forged = await sign('not-the-secret', { p: player.id, v: 1, exp: Date.now() + 60_000 })
    expect((await me(forged)).signedIn).toBe(false)
    expect((await me(session, new Date(Date.now() + 31 * 86_400_000))).signedIn).toBe(false)
    // Signing a player out everywhere (as deleting the account will) ends every session.
    await db.prepare('UPDATE players SET session_version = session_version + 1 WHERE id = ?').bind(player.id).run()
    expect((await me(session)).signedIn).toBe(false)
  })

  it('signing out clears the cookie, and only from the site itself', async () => {
    const out = (origin: string | null) =>
      handle(new Request(`${SITE}/api/auth/signout`, { method: 'POST', headers: origin ? { Origin: origin } : {} }), deps())
    expect((await out('https://evil.example')).status).toBe(403)
    const res = await out(SITE)
    expect(res.status).toBe(200)
    expect(res.headers.get('Set-Cookie')).toMatch(/^syntype_session=; Path=\/; Max-Age=0/)
  })
})

describe('leaderboard names', () => {
  it('confirms the first name, applying the rules, and only from the site itself', async () => {
    const { session } = await signIn('github', providers({ github: { id: ids++, login: 'namer' } }).fetchImpl)
    expect((await rename(session!, 'Namer One', null)).status).toBe(403)
    expect((await rename(session!, 'Namer One', 'https://evil.example')).status).toBe(403)
    for (const [bad, why] of [
      ['ab', /at least 3/],
      ['x'.repeat(25), /at most 24/],
      ['ada!', /letters, numbers/],
      ['Admin', /reserved/],
      ['sh1t-head', /different name/],
    ] as const) {
      const res = await rename(session!, bad)
      expect(res.status, bad).toBe(400)
      expect(((await res.json()) as { error: string }).error).toMatch(why)
    }
    const ok = await rename(session!, '  Namer   One ')
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as { player: { name: string } }).player.name).toBe('Namer One')
  })

  it('names are unique whatever their case', async () => {
    const a = await signIn('github', providers({ github: { id: ids++, login: 'first-taker' } }).fetchImpl)
    const b = await signIn('github', providers({ github: { id: ids++, login: 'second-taker' } }).fetchImpl)
    expect((await rename(a.session!, 'Speedy')).status).toBe(200)
    const taken = await rename(b.session!, 'SPEEDY')
    expect(taken.status).toBe(409)
    expect(((await taken.json()) as { error: string }).error).toMatch(/taken/)
  })

  it('renaming is allowed once a week; confirming the first name does not start the wait', async () => {
    const { session } = await signIn('github', providers({ github: { id: ids++, login: 'renamer' } }).fetchImpl)
    expect((await rename(session!, 'Renamer A')).status).toBe(200)
    expect((await rename(session!, 'Renamer B')).status).toBe(200)
    const tooSoon = await rename(session!, 'Renamer C')
    expect(tooSoon.status).toBe(429)
    expect((await rename(session!, 'Renamer C', SITE, new Date(Date.now() + RENAME_EVERY_MS + 60_000))).status).toBe(200)
  })

  it('a name needs a signed-in player', async () => {
    const res = await handle(
      new Request(`${SITE}/api/me/name`, { method: 'POST', headers: { Origin: SITE, 'Content-Type': 'application/json' }, body: '{"name":"Nobody"}' }),
      deps(),
    )
    expect(res.status).toBe(401)
  })
})
