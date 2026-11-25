/**
 * The API against a real local D1 database (Wrangler's getPlatformProxy runs
 * the same engine as Cloudflare), with GitHub and Google simulated.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { handle, originOf, safeReturn, SESSION_COOKIE, SIGNIN_COOKIE, type ApiConfig, type Deps } from './api'
import { ACCESS_HEADER, clearAccessKeys } from './access'
import { sign } from './crypto'
import type { Db, Statement } from './db'
import { RENAME_EVERY_MS } from './names'
import { AUD, fakeAccess, TEAM } from './test-access'
import { gunzip, LOGS_KEPT } from './runs'
import { myPlace, runForReplay, runRemoval } from './boards'
import { deleteInactive } from './account'
import { LANGUAGES } from '../../src/languages'
import { snippetFiles, type SnippetFile } from '../../src/lib/snippetfiles'
import { encodeLog, replayLog, resultOf, type LogEntry, type TypingAids } from '../../src/lib/runcore'
import { hasService, play } from '../../src/test/harness'

const config: ApiConfig = {
  SITE_URL: 'https://syntype.vercel.my',
  GITHUB_CLIENT_ID: 'gh-client',
  GITHUB_CLIENT_SECRET: 'gh-secret',
  GOOGLE_CLIENT_ID: 'google-client',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  SESSION_SECRET: 'test-session-secret',
  ACCESS_TEAM_DOMAIN: TEAM,
  ACCESS_AUD: AUD,
  TURNSTILE_SITE_KEY: 'turnstile-site',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
}
const SITE = config.SITE_URL

let db: Db
let snippetData: Map<string, SnippetFile>
/** The build's snippet data files, as the Worker's static assets serve them. */
const assets = async (path: string) => {
  if (path.endsWith('/index.json')) return Response.json([...snippetData.values()].map(({ fingerprint, language, name, length }) => ({ fingerprint, language, name, length })))
  const f = snippetData.get(path.split('/').pop()!.replace('.json', ''))
  return f ? Response.json(f) : new Response('Not found', { status: 404 })
}
let dispose: () => Promise<void>
beforeAll(async () => {
  const proxy = await getPlatformProxy<{ DB: Db }>({ persist: false })
  db = proxy.env.DB
  dispose = proxy.dispose
  snippetData = new Map((await snippetFiles(LANGUAGES)).map((f) => [f.fingerprint, f]))
  // The real migrations, in order, one statement at a time.
  const dir = new URL('../../migrations/', import.meta.url)
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(file, dir), 'utf8').replace(/--[^\n]*/g, '')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) await db.prepare(stmt).run()
  }
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

const deps = (fetchImpl: Deps['fetch'] = async () => new Response(null, { status: 500 }), now?: Date): Deps => ({ db, config, fetch: fetchImpl, assets, now: now && (() => now) })
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

const me_ = (session?: string, now?: Date) => me(session, now)

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
    expect(await (await handle(new Request(`${SITE}/api/health`), deps())).json()).toEqual({ ok: true, database: true, tables: true })
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

  it('a token of one kind never passes as another, and old untyped sessions no longer count', async () => {
    const { session } = await signIn('github', providers({ github: { id: ids++, login: 'kinds' } }).fetchImpl)
    const player = (await me(session)).player!
    const untyped = await sign(config.SESSION_SECRET, { p: player.id, v: 1, exp: Date.now() + 60_000 })
    expect((await me(untyped)).signedIn).toBe(false)
    // A sign-in in progress, or a run token, in the session cookie: signed out, not a server error.
    const signinToken = await sign(config.SESSION_SECRET, { k: 'signin', s: 'x', cv: 'y', pr: 'github', r: '/', exp: Date.now() + 60_000 })
    const runToken = await sign(config.SESSION_SECRET, { k: 'run', id: 'r', p: player.id, f: 'x', t: 1, v: 1, exp: Date.now() + 60_000 })
    for (const t of [signinToken, runToken]) {
      const res = await handle(new Request(`${SITE}/api/me`, { headers: { Cookie: `${SESSION_COOKIE}=${t}` } }), deps())
      expect(res.status).toBe(200)
      expect(((await res.json()) as { signedIn: boolean }).signedIn).toBe(false)
    }
  })

  it('GitHub sign-in uses PKCE too', async () => {
    const start = await handle(new Request(`${SITE}/api/auth/github/start`), deps())
    const to = new URL(start.headers.get('Location')!)
    expect(to.searchParams.get('code_challenge_method')).toBe('S256')
    expect(to.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
    const sent: string[] = []
    const { fetchImpl } = providers({ github: { id: ids++, login: 'pkce-check' } })
    await signIn('github', async (input, init) => {
      if (typeof init?.body === 'object' && init.body instanceof URLSearchParams) sent.push(init.body.get('code_verifier') ?? '')
      return fetchImpl(input, init)
    })
    expect(sent[0]).toMatch(/^[\w-]{60,}$/)
  })

  it('signing out everywhere ends every session the player has', async () => {
    const a = await signIn('github', providers({ github: { id: 4242, login: 'two-devices' } }).fetchImpl)
    const b = await signIn('github', providers({ github: { id: 4242, login: 'two-devices' } }).fetchImpl)
    expect((await me(b.session)).signedIn).toBe(true)
    const out = await handle(new Request(`${SITE}/api/me/signout-everywhere`, { method: 'POST', headers: { Cookie: `${SESSION_COOKIE}=${a.session}`, Origin: SITE } }), deps())
    expect(out.status).toBe(200)
    expect(out.headers.get('Set-Cookie')).toMatch(/^syntype_session=; /)
    expect((await me(a.session)).signedIn).toBe(false)
    expect((await me(b.session)).signedIn).toBe(false)
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

/** A signed-in player with a confirmed name. */
async function named(login: string) {
  const { session } = await signIn('github', providers({ github: { id: ids++, login } }).fetchImpl)
  expect((await rename(session!, login)).status).toBe(200)
  return { session: session!, id: (await me(session)).player!.id }
}

const reportAs = (session: string | null, body: unknown, origin: string | null = SITE) =>
  handle(
    new Request(`${SITE}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session ? { Cookie: `${SESSION_COOKIE}=${session}` } : {}), ...(origin ? { Origin: origin } : {}) },
      body: JSON.stringify(body),
    }),
    deps(),
  )

describe('reports', () => {
  it('a named player reports another player, once, with a reason and an optional note', async () => {
    const a = await named('reporter-a')
    const b = await named('target-b')
    expect((await reportAs(null, { player: b.id, reason: 'name' })).status).toBe(401)
    expect((await reportAs(a.session, { player: b.id, reason: 'name' }, 'https://evil.example')).status).toBe(403)
    expect((await reportAs(a.session, { player: b.id, reason: 'rude' })).status).toBe(400)
    expect((await reportAs(a.session, { player: b.id, reason: 'other', note: 'x'.repeat(501) })).status).toBe(400)
    expect((await reportAs(a.session, { player: a.id, reason: 'name' })).status).toBe(400)
    expect((await reportAs(a.session, { player: 'nobody', reason: 'name' })).status).toBe(404)
    expect((await reportAs(a.session, { player: b.id, run: 'no-such-run', reason: 'cheating' })).status).toBe(404)
    expect((await reportAs(a.session, { player: b.id, reason: 'name', note: '  rude word  ' })).status).toBe(201)
    expect((await reportAs(a.session, { player: b.id, reason: 'other' })).status).toBe(409)
    const row = await db.prepare('SELECT * FROM reports WHERE reporter_id = ?').bind(a.id).first<{ note: string; status: string }>()
    expect(row).toMatchObject({ note: 'rude word', status: 'open' })
  })

  it('needs a confirmed name, and allows 10 a day', async () => {
    const { session } = await signIn('github', providers({ github: { id: ids++, login: 'unnamed-reporter' } }).fetchImpl)
    const target = await named('target-c')
    expect((await reportAs(session!, { player: target.id, reason: 'name' })).status).toBe(403)
    const busy = await named('busy-reporter')
    for (let i = 0; i < 10; i++) {
      const t = await named(`target-d${i}`)
      expect((await reportAs(busy.session, { player: t.id, reason: 'other' })).status).toBe(201)
    }
    const res = await reportAs(busy.session, { player: target.id, reason: 'other' })
    expect(res.status).toBe(429)
  })
})

describe('the admin API', () => {
  let access: Awaited<ReturnType<typeof fakeAccess>>
  let token: string
  beforeAll(async () => {
    clearAccessKeys()
    access = await fakeAccess()
    token = await access.token()
  })
  const adminReq = (path: string, init: { method?: string; body?: unknown; token?: string | null; origin?: string | null } = {}) =>
    handle(
      new Request(`${SITE}/api/admin${path}`, {
        method: init.method ?? 'GET',
        headers: {
          ...(init.token === null ? {} : { [ACCESS_HEADER]: init.token ?? token }),
          ...(init.method === 'POST' && init.origin !== null ? { Origin: init.origin ?? SITE } : {}),
          'Content-Type': 'application/json',
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
      deps(access.fetchImpl),
    )
  const data = async <T,>(res: Response) => (await res.json()) as T

  it('answers only requests that came through Cloudflare Access', async () => {
    expect((await adminReq('/me', { token: null })).status).toBe(403)
    const other = await fakeAccess()
    expect((await adminReq('/me', { token: await other.token() })).status).toBe(403)
    expect((await adminReq('/players', { token: await access.token({ aud: ['other'] }) })).status).toBe(403)
    expect(await data(await adminReq('/me'))).toEqual({ email: 'owner@example.com' })
  })

  it('changes nothing from another site, even with Access', async () => {
    const p = await named('csrf-target')
    expect((await adminReq(`/players/${p.id}/hide`, { method: 'POST', origin: 'https://evil.example' })).status).toBe(403)
    expect((await adminReq(`/players/${p.id}/hide`, { method: 'POST', origin: null })).status).toBe(403)
  })

  it('finds players by name, ID or provider ID', async () => {
    const p = await named('Findable_Fox')
    type Found = { players: { id: string; name: string }[] }
    expect((await data<Found>(await adminReq('/players?q=findable'))).players.map((x) => x.id)).toEqual([p.id])
    expect((await data<Found>(await adminReq(`/players?q=${p.id}`))).players.map((x) => x.id)).toEqual([p.id])
    // LIKE wildcards are taken literally.
    expect((await data<Found>(await adminReq('/players?q=%25'))).players).toEqual([])
    expect((await data<Found>(await adminReq('/players'))).players.length).toBeGreaterThan(0)
  })

  it('renames, hides, shows and signs out a player, and logs each action', async () => {
    const p = await named('moderated')
    type One = { player: { name: string; hiddenByModerator: boolean; hidden: boolean } }
    const renamed = await adminReq(`/players/${p.id}/rename`, { method: 'POST', body: { name: 'Player 4821' } })
    expect((await data<One>(renamed)).player.name).toBe('Player 4821')
    expect((await adminReq(`/players/${p.id}/rename`, { method: 'POST', body: { name: 'admin' } })).status).toBe(400)
    // The rename starts the player's weekly wait.
    expect((await rename(p.session, 'moderated-again')).status).toBe(429)

    expect((await data<One>(await adminReq(`/players/${p.id}/hide`, { method: 'POST' }))).player.hiddenByModerator).toBe(true)
    expect((await me(p.session)).player).toMatchObject({ hidden: false, hiddenByModerator: true })
    expect((await data<One>(await adminReq(`/players/${p.id}/show`, { method: 'POST' }))).player.hiddenByModerator).toBe(false)

    expect((await adminReq(`/players/${p.id}/signout`, { method: 'POST' })).status).toBe(200)
    expect((await me(p.session)).signedIn).toBe(false)
    expect((await adminReq('/players/nobody/hide', { method: 'POST' })).status).toBe(404)
    expect((await adminReq(`/players/${p.id}/delete`, { method: 'POST' })).status).toBe(404)

    type Log = { actions: { action: string; player: string; playerName: string; admin: string; detail: string | null }[] }
    const log = (await data<Log>(await adminReq('/actions'))).actions.filter((a) => a.player === p.id)
    expect(log.map((a) => a.action)).toEqual(['signout', 'show', 'hide', 'rename'])
    expect(log[3]).toMatchObject({ admin: 'owner@example.com', playerName: 'Player 4821', detail: JSON.stringify({ from: 'moderated', to: 'Player 4821' }) })
  })

  it('queues reports most-reported first, and closes them', async () => {
    const target = await named('much-reported')
    const once = await named('once-reported')
    for (const name of ['r-one', 'r-two', 'r-three']) {
      const r = await named(name)
      expect((await reportAs(r.session, { player: target.id, reason: 'name', note: `from ${name}` })).status).toBe(201)
    }
    const r = await named('r-four')
    expect((await reportAs(r.session, { player: once.id, reason: 'other' })).status).toBe(201)

    type Queue = { groups: { player: { id: string; openReports: number }; count: number; reports: { reporter: string; note: string }[] }[] }
    const open = (await data<Queue>(await adminReq('/reports'))).groups
    const mine = open.filter((g) => [target.id, once.id].includes(g.player.id))
    expect(mine.map((g) => [g.player.id, g.count])).toEqual([
      [target.id, 3],
      [once.id, 1],
    ])
    expect(mine[0].player.openReports).toBe(3)
    expect(mine[0].reports.map((x) => x.reporter).sort()).toEqual(['r-one', 'r-three', 'r-two'])

    expect((await adminReq('/reports/close', { method: 'POST', body: { player: target.id, status: 'maybe' } })).status).toBe(400)
    const closed = await adminReq('/reports/close', { method: 'POST', body: { player: target.id, status: 'dismissed' } })
    expect(await data(closed)).toEqual({ ok: true, closed: 3 })
    const after = (await data<Queue>(await adminReq('/reports'))).groups.map((g) => g.player.id)
    expect(after).not.toContain(target.id)
    expect(after).toContain(once.id)
    const history = (await data<Queue>(await adminReq('/reports?status=closed'))).groups.map((g) => g.player.id)
    expect(history).toContain(target.id)
  })

  it('keeps a deleted reporter’s reports, without saying who sent them', async () => {
    const target = await named('kept-target')
    const gone = await named('gone-reporter')
    expect((await reportAs(gone.session, { player: target.id, reason: 'cheating' })).status).toBe(201)
    await db.prepare('PRAGMA foreign_keys = ON').run()
    await db.prepare('DELETE FROM players WHERE id = ?').bind(gone.id).run()
    type Queue = { groups: { player: { id: string }; reports: { reporter: string | null }[] }[] }
    const group = (await data<Queue>(await adminReq('/reports'))).groups.find((g) => g.player.id === target.id)
    expect(group?.reports).toEqual([expect.objectContaining({ reporter: null })])
  })
})

describe('submitting runs', () => {
  const lang = LANGUAGES.find((l) => l.id === 'python')!
  let snippet = lang.snippets.find((x) => x.length === 'short')!
  const AIDS: TypingAids = { autoIndent: true, autoClose: true, autocomplete: false }
  let fp: string
  beforeAll(() => {
    fp = [...snippetData.values()].find((f) => f.language === 'python' && f.name === snippet.name)!.fingerprint
  })

  /**
   * Turnstile: 'person' passes, solved on our site for our action; 'elsewhere'
   * and 'other-action' pass but for another hostname or action; anything else fails.
   */
  const turnstile = (seen: unknown[] = []) => async (input: string, init?: RequestInit) => {
    if (input !== 'https://challenges.cloudflare.com/turnstile/v0/siteverify') return new Response('unexpected', { status: 500 })
    const body = JSON.parse(String(init?.body)) as { secret: string; response: string }
    seen.push(body)
    const genuine = body.secret === 'turnstile-secret' && ['person', 'elsewhere', 'other-action'].includes(body.response)
    return Response.json({
      success: genuine,
      hostname: body.response === 'elsewhere' ? 'evil.example' : 'syntype.vercel.my',
      action: body.response === 'other-action' ? 'login' : 'submit-run',
    })
  }
  const post = (path: string, session: string, body: unknown, at: Date, fetchImpl = turnstile()) =>
    handle(
      new Request(`${SITE}${path}`, {
        method: 'POST',
        headers: { Cookie: `${SESSION_COOKIE}=${session}`, Origin: SITE, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      deps(fetchImpl, at),
    )
  const start = async (session: string, at: Date) => ((await (await post('/api/runs/start', session, { fingerprint: fp }, at)).json()) as { token: string }).token

  /** An honest run of the snippet; `speed` scales how fast it's typed. */
  function honestRun(speed = 1, seed = 5) {
    const state = play(lang, snippet, { acceptSuggestions: false, service: hasService(lang), aids: AIDS, typist: { seed, typos: 0.02 } })
    const log = encodeLog(state.log).map((e) => {
      const copy = [...e] as LogEntry
      copy[copy.length - 1] = Math.round((e[e.length - 1] as number) / speed)
      return copy
    })
    const r = resultOf(replayRun(log))
    const duration = log.reduce((t, e) => t + (e[e.length - 1] as number), 0)
    return { log, result: { wpm: r.wpm, rawWpm: r.rawWpm, accuracy: r.accuracy, seconds: r.seconds }, duration }
  }
  const replayRun = (log: LogEntry[]) => {
    const f = snippetData.get(fp)!
    const pairs = { closeOf: new Array(f.code.length).fill(-1), allowed: new Array(f.code.length).fill(false), autoCloseBefore: f.pairs.before }
    for (const [i, j] of f.pairs.close) pairs.closeOf[i] = j
    for (const i of f.pairs.allowed) pairs.allowed[i] = true
    return replayLog(snippet, AIDS, pairs, log)
  }
  type Answer = { accepted: boolean; reason?: string; best?: boolean; bestForAids?: boolean; rank?: number; runId?: string; wpm?: number }
  /** Starts at t0 and submits right after finishing (or `late` ms later). */
  async function submit(session: string, run: ReturnType<typeof honestRun>, opts: { t0?: number; late?: number; turnstileToken?: string; token?: string } = {}) {
    const t0 = opts.t0 ?? Date.now()
    const token = opts.token ?? (await start(session, new Date(t0)))
    const res = await post('/api/runs', session, { token, aids: AIDS, log: run.log, result: run.result, turnstile: opts.turnstileToken ?? 'person' }, new Date(t0 + run.duration + (opts.late ?? 1500)))
    return { status: res.status, body: (await res.json()) as Answer, token }
  }

  it('a run token needs a named player and a snippet the game offers', async () => {
    const { session } = await signIn('github', providers({ github: { id: ids++, login: 'tokenless' } }).fetchImpl)
    expect((await post('/api/runs/start', session!, { fingerprint: fp }, new Date())).status).toBe(403)
    const p = await named('token-taker')
    expect((await post('/api/runs/start', p.session, { fingerprint: 'f'.repeat(64) }, new Date())).status).toBe(404)
    expect((await post('/api/runs/start', p.session, { fingerprint: '../index' }, new Date())).status).toBe(404)
    expect(await start(p.session, new Date())).toMatch(/\./)
  })

  it('accepts an honest run, keeps it as the best with its log, and gives the place', async () => {
    const p = await named('honest-typist')
    const run = honestRun()
    const seen: unknown[] = []
    const t0 = Date.now()
    const token = await start(p.session, new Date(t0))
    const res = await post('/api/runs', p.session, { token, aids: AIDS, log: run.log, result: run.result, turnstile: 'person' }, new Date(t0 + run.duration + 800), turnstile(seen))
    const body = (await res.json()) as Answer
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ accepted: true, best: true, bestForAids: true })
    expect(body.rank).toBeGreaterThanOrEqual(1)
    expect(Math.abs(body.wpm! - run.result.wpm)).toBeLessThan(0.01)
    expect(seen).toEqual([expect.objectContaining({ secret: 'turnstile-secret', response: 'person' })])
    // No idempotency key: each Turnstile token is checked once, so Cloudflare's reuse check applies.
    expect(seen[0]).not.toHaveProperty('idempotency_key')

    const bests = await db.prepare('SELECT aids, run_aids, run_id FROM bests WHERE player_id = ? ORDER BY aids').bind(p.id).all<{ aids: string; run_aids: string; run_id: string }>()
    expect(bests.results).toEqual([
      { aids: '110', run_aids: '110', run_id: body.runId },
      { aids: 'any', run_aids: '110', run_id: body.runId },
    ])
    const stored = await db.prepare('SELECT log FROM logs WHERE run_id = ?').bind(body.runId).first<{ log: ArrayBuffer }>()
    expect(JSON.parse(await gunzip(new Uint8Array(stored!.log)))).toEqual(run.log)
    expect(await db.prepare('SELECT name FROM snippet_versions WHERE fingerprint = ?').bind(fp).first()).toEqual({ name: snippet.name })

    // The same token can't submit twice.
    const again = await post('/api/runs', p.session, { token, aids: AIDS, log: run.log, result: run.result, turnstile: 'person' }, new Date(t0 + run.duration + 2000))
    expect(again.status).toBe(409)
  })

  it('a slower run keeps the best; a faster one replaces it and its log', async () => {
    const p = await named('improver')
    const first = await submit(p.session, honestRun(1))
    expect(first.body).toMatchObject({ accepted: true, best: true })
    const slower = await submit(p.session, honestRun(0.8, 9))
    expect(slower.body).toMatchObject({ accepted: true, best: false, bestForAids: false })
    const faster = await submit(p.session, honestRun(1.3, 13))
    expect(faster.body).toMatchObject({ accepted: true, best: true })
    const logs = await db.prepare('SELECT run_id FROM logs WHERE player_id = ?').bind(p.id).all<{ run_id: string }>()
    expect(logs.results.map((l) => l.run_id)).toEqual([faster.body.runId])
  })

  it('ranks against visible players only', async () => {
    const a = await named('rank-fast')
    const b = await named('rank-slow')
    const hiddenOne = await named('rank-hidden')
    const fpBefore = (await db.prepare("SELECT count(*) AS n FROM bests b JOIN players p ON p.id = b.player_id WHERE fingerprint = ? AND aids = 'any' AND p.hidden = 0 AND p.moderator_hidden = 0 AND wpm > ?").bind(fp, 1000).first<{ n: number }>())!.n
    expect(fpBefore).toBe(0)
    const fast = await submit(a.session, honestRun(3, 21))
    const slow = await submit(b.session, honestRun(2.9, 22))
    expect(slow.body.rank).toBe(fast.body.rank! + 1)
    await db.prepare('UPDATE players SET moderator_hidden = 1 WHERE id = ?').bind(hiddenOne.id).run()
    const hiddenRun = await submit(hiddenOne.session, honestRun(3.2, 23))
    expect(hiddenRun.body.accepted).toBe(true)
    // The hidden player still sees their own place, but nobody else is pushed down.
    const slowAgain = await submit(b.session, honestRun(2.95, 24))
    expect(slowAgain.body.rank).toBe(fast.body.rank! + 1)
  })

  it('keeps logs for the top 20 only', async () => {
    // A board of its own: another short Python snippet.
    const saved = { snippet, fp }
    snippet = lang.snippets.filter((x) => x.length === 'short')[1]
    fp = [...snippetData.values()].find((f) => f.language === 'python' && f.name === snippet.name)!.fingerprint
    try {
      // A top 20 faster than any honest run here, each with a log.
      const at = new Date().toISOString()
      await db.prepare("INSERT INTO snippet_versions (fingerprint, language, name, length, code, first_seen_at) VALUES (?, 'python', ?, 'short', ?, ?)").bind(fp, snippet.name, snippet.code, at).run()
      for (let i = 0; i < LOGS_KEPT; i++) {
        const p = await named(`top-${i}`)
        await db.batch([
          db.prepare("INSERT INTO bests (player_id, fingerprint, aids, language, run_id, wpm, raw_wpm, accuracy, seconds, run_aids, finished_at) VALUES (?, ?, 'any', 'python', ?, ?, ?, 100, 5, '110', ?)").bind(p.id, fp, `top-run-${i}`, 200 - i, 200 - i, at),
          db.prepare('INSERT INTO logs (run_id, player_id, fingerprint, log, created_at) VALUES (?, ?, ?, ?, ?)').bind(`top-run-${i}`, p.id, fp, new Uint8Array([1]), at),
        ])
      }
      const outside = await submit((await named('outside-top')).session, honestRun(1, 31))
      expect(outside.body).toMatchObject({ best: true, rank: LOGS_KEPT + 1 })
      expect(await db.prepare('SELECT 1 AS x FROM logs WHERE run_id = ?').bind(outside.body.runId).first()).toBeNull()

      // The 20th falls back; a faster run enters the top 20 and pushes the old 20th's log out.
      await db.prepare("UPDATE bests SET wpm = 50 WHERE run_id = 'top-run-19'").run()
      const entering = await submit((await named('entering-top')).session, honestRun(1.2, 41))
      expect(entering.body).toMatchObject({ best: true, rank: LOGS_KEPT })
      const logs = (await db.prepare('SELECT run_id FROM logs WHERE fingerprint = ?').bind(fp).all<{ run_id: string }>()).results.map((r) => r.run_id)
      expect(logs).toHaveLength(LOGS_KEPT)
      expect(logs).toContain(entering.body.runId)
      expect(logs).not.toContain('top-run-19')
    } finally {
      ;({ snippet, fp } = saved)
    }
  })

  it('refuses a run without a person behind it, too soon, too late, or with an old token', async () => {
    const p = await named('checked-typist')
    const run = honestRun(1, 51)
    expect((await submit(p.session, run, { turnstileToken: 'bot' })).body.reason).toBe('turnstile')
    // Solved on another site, or for another action: not ours.
    expect((await submit(p.session, run, { turnstileToken: 'elsewhere' })).body.reason).toBe('turnstile')
    expect((await submit(p.session, run, { turnstileToken: 'other-action' })).body.reason).toBe('turnstile')
    const t0 = Date.now()
    const token = await start(p.session, new Date(t0))
    expect(run.duration).toBeGreaterThan(6000)
    const early = await post('/api/runs', p.session, { token, aids: AIDS, log: run.log, result: run.result, turnstile: 'person' }, new Date(t0 + 500))
    expect(((await early.json()) as Answer).reason).toBe('too-soon')
    expect((await submit(p.session, run, { late: 11 * 60_000 })).body.reason).toBe('too-late')
    expect((await submit(p.session, run, { late: 3 * 3_600_000 })).body.reason).toBe('expired')
    const forged = await submit(p.session, { ...run, result: { ...run.result, wpm: run.result.wpm * 2 } })
    expect(forged).toMatchObject({ status: 422, body: { accepted: false, reason: 'result-mismatch' } })
  })

  it('boards: top scores by language, a board’s top 15 for an aid filter, your place, replays, and removal', async () => {
    const saved = { snippet, fp }
    snippet = lang.snippets.filter((x) => x.length === 'medium')[0]
    fp = [...snippetData.values()].find((f) => f.language === 'python' && f.name === snippet.name)!.fingerprint
    try {
      const get = async <T,>(path: string, session?: string) => {
        const res = await handle(new Request(`${SITE}${path}`, { headers: session ? { Cookie: `${SESSION_COOKIE}=${session}` } : {} }), deps())
        return { status: res.status, cache: res.headers.get('Cache-Control'), body: (await res.json()) as T }
      }
      const fast = await named('board-fast')
      const slow = await named('board-slow')
      const shy = await named('board-hidden')
      const fastRun = await submit(fast.session, honestRun(1.4, 71))
      const slowRun = await submit(slow.session, honestRun(1, 72))
      const shyRun = await submit(shy.session, honestRun(1.6, 73))
      for (const r of [fastRun, slowRun, shyRun]) expect(r.body.accepted).toBe(true)
      await db.prepare('UPDATE players SET hidden = 1 WHERE id = ?').bind(shy.id).run()
      // An older text of a Python snippet, with a score: an archived board.
      const old = 'e'.repeat(64)
      const at = new Date().toISOString()
      await db.batch([
        db.prepare("INSERT INTO snippet_versions (fingerprint, language, name, length, code, first_seen_at) VALUES (?, 'python', 'old.py', 'short', 'print(1)', ?)").bind(old, at),
        db.prepare("INSERT INTO bests (player_id, fingerprint, aids, language, run_id, wpm, raw_wpm, accuracy, seconds, run_aids, finished_at) VALUES (?, ?, 'any', 'python', 'old-run', 50, 50, 100, 2, '000', ?)").bind(slow.id, old, at),
      ])

      type Lang = { snippets: { fingerprint: string; name: string; top: { name: string; wpm: number } | null }[]; archived: { fingerprint: string; name: string }[] }
      const overview = await get<Lang>('/api/boards?lang=python')
      expect(overview.cache).toBe('public, max-age=60')
      expect(overview.body.snippets).toHaveLength(lang.snippets.length)
      expect(overview.body.snippets.find((x) => x.fingerprint === fp)?.top?.name).toBe('board-fast')
      expect(overview.body.archived).toEqual([expect.objectContaining({ fingerprint: old, name: 'old.py' })])

      type Board = { snippet: { name: string; current: boolean; code?: string }; rows: { rank: number; player: { name: string }; runId: string; hasLog: boolean; aids: string }[] }
      const b = await get<Board>(`/api/boards/${fp}`)
      expect(b.body.snippet).toMatchObject({ name: snippet.name, current: true })
      expect(b.body.rows.map((r) => [r.rank, r.player.name, r.hasLog])).toEqual([
        [1, 'board-fast', true],
        [2, 'board-slow', true],
      ])
      expect((await get<Board>(`/api/boards/${fp}?aids=110`)).body.rows).toHaveLength(2)
      expect((await get<Board>(`/api/boards/${fp}?aids=111`)).body.rows).toEqual([])
      expect((await get<Board>(`/api/boards/${old}`)).body.snippet).toMatchObject({ current: false, code: 'print(1)' })
      expect((await get(`/api/boards/${'0'.repeat(64)}`)).status).toBe(404)

      // Your place, even when hidden from everyone else.
      const me = await get<{ row: { rank: number } }>(`/api/boards/${fp}/me`, slow.session)
      expect(me.cache).toBe('no-store')
      expect(me.body.row.rank).toBe(2)
      expect((await get<{ row: { rank: number } }>(`/api/boards/${fp}/me`, shy.session)).body.row.rank).toBe(1)

      // Replays of kept runs; a hidden player's only for the admin.
      type Replay = { log: LogEntry[]; snippet: { code: string }; player: { name: string } }
      const replay = await get<Replay>(`/api/replays/${fastRun.body.runId}`)
      expect(replay.body.player.name).toBe('board-fast')
      expect(replay.body.snippet.code).toBe(snippet.code)
      expect(replay.body.log.length).toBeGreaterThan(10)
      expect((await get(`/api/replays/${shyRun.body.runId}`)).status).toBe(404)
      clearAccessKeys()
      const access = await fakeAccess()
      const asAdmin = (path: string, method = 'GET', body?: unknown) =>
        handle(
          new Request(`${SITE}/api/admin${path}`, {
            method,
            headers: { [ACCESS_HEADER]: adminToken, ...(method === 'POST' ? { Origin: SITE, 'Content-Type': 'application/json' } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body),
          }),
          deps(access.fetchImpl),
        )
      const adminToken = await access.token()
      expect((await asAdmin(`/replays/${shyRun.body.runId}`)).status).toBe(200)

      // Removing the fastest run: off the board, its log gone, and the action logged.
      // The player id is needed: without it the server would have to scan every score to find the run.
      expect((await asAdmin(`/runs/${fastRun.body.runId}/remove`, 'POST', {})).status).toBe(400)
      expect((await asAdmin(`/runs/${fastRun.body.runId}/remove`, 'POST', { player: slow.id })).status).toBe(404)
      const removed = await asAdmin(`/runs/${fastRun.body.runId}/remove`, 'POST', { player: fast.id })
      expect(await removed.json()).toEqual({ ok: true, removed: 2 })
      expect((await get<Board>(`/api/boards/${fp}`)).body.rows.map((r) => r.player.name)).toEqual(['board-slow'])
      expect(await db.prepare('SELECT 1 AS x FROM logs WHERE run_id = ?').bind(fastRun.body.runId).first()).toBeNull()
      expect(await db.prepare("SELECT action FROM admin_actions WHERE target_run_id = ?").bind(fastRun.body.runId).first()).toEqual({ action: 'remove-run' })
      expect((await asAdmin(`/runs/${fastRun.body.runId}/remove`, 'POST', { player: fast.id })).status).toBe(404)
    } finally {
      ;({ snippet, fp } = saved)
    }
  })

  it('removing a player’s overall best brings back their best with other typing aids', async () => {
    const p = await named('two-aids')
    const withAids = await submit(p.session, honestRun(1.5, 81))
    // A slower best with every aid off, inserted as the server would keep it.
    const at = new Date().toISOString()
    await db.prepare("INSERT INTO bests (player_id, fingerprint, aids, language, run_id, wpm, raw_wpm, accuracy, seconds, run_aids, finished_at) VALUES (?, ?, '000', 'python', 'slower-run', 40, 40, 98, 9, '000', ?)").bind(p.id, fp, at).run()
    clearAccessKeys()
    const access = await fakeAccess()
    const res = await handle(
      new Request(`${SITE}/api/admin/runs/${withAids.body.runId}/remove`, {
        method: 'POST',
        headers: { [ACCESS_HEADER]: await access.token(), Origin: SITE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: p.id }),
      }),
      deps(access.fetchImpl),
    )
    expect(res.status).toBe(200)
    const rows = await db.prepare('SELECT aids, run_id FROM bests WHERE player_id = ? ORDER BY aids').bind(p.id).all()
    expect(rows.results).toEqual([
      { aids: '000', run_id: 'slower-run' },
      { aids: 'any', run_id: 'slower-run' },
    ])
  })

  it('players hide, list and delete their entries, download their data, and delete their account', async () => {
    const saved = { snippet, fp }
    snippet = lang.snippets.filter((x) => x.length === 'medium')[1]
    fp = [...snippetData.values()].find((f) => f.language === 'python' && f.name === snippet.name)!.fingerprint
    try {
      const call = async <T,>(path: string, session: string, body?: unknown) => {
        const res = await handle(
          new Request(`${SITE}${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            headers: { Cookie: `${SESSION_COOKIE}=${session}`, ...(body === undefined ? {} : { Origin: SITE, 'Content-Type': 'application/json' }) },
            body: body === undefined ? undefined : JSON.stringify(body),
          }),
          deps(),
        )
        return { status: res.status, headers: res.headers, body: (await res.json()) as T }
      }
      const boardNames = async () =>
        ((await (await handle(new Request(`${SITE}/api/boards/${fp}`), deps())).json()) as { rows: { player: { name: string } }[] }).rows.map((r) => r.player.name)
      const me = await named('data-owner')
      const other = await named('data-other')
      const mine = await submit(me.session, honestRun(1.2, 91))
      const theirs = await submit(other.session, honestRun(1, 92))
      expect(await boardNames()).toEqual(['data-owner', 'data-other'])

      // Hide and show again.
      const hid = await call<{ player: { hidden: boolean } }>('/api/me/hide', me.session, { hidden: true })
      expect(hid.body.player.hidden).toBe(true)
      expect(await boardNames()).toEqual(['data-other'])
      await call('/api/me/hide', me.session, { hidden: false })
      expect(await boardNames()).toEqual(['data-owner', 'data-other'])

      // Entries, and deleting one; another player's runs aren't yours to delete.
      const entries = await call<{ entries: { runId: string; snippet: string; hasLog: boolean }[] }>('/api/me/runs', me.session)
      expect(entries.body.entries).toEqual([expect.objectContaining({ runId: mine.body.runId, snippet: snippet.name, hasLog: true })])
      expect((await call(`/api/me/runs/${theirs.body.runId}/delete`, me.session, {})).status).toBe(404)
      expect((await call(`/api/me/runs/${mine.body.runId}/delete`, me.session, {})).status).toBe(200)
      expect(await boardNames()).toEqual(['data-other'])

      // Download: everything kept, with logs readable.
      const again = await submit(me.session, honestRun(1.1, 93))
      await reportAs(me.session, { player: other.id, reason: 'other', note: 'checking' })
      const data = await call<{ player: { name: string }; bests: unknown[]; logs: { runId: string; log: unknown[] }[]; reportsMade: { note: string }[] }>('/api/me/data', me.session)
      expect(data.headers.get('Content-Disposition')).toMatch(/attachment/)
      expect(data.body.player.name).toBe('data-owner')
      expect(data.body.bests.length).toBe(2)
      expect(data.body.logs).toEqual([expect.objectContaining({ runId: again.body.runId })])
      expect(data.body.logs[0].log.length).toBeGreaterThan(10)
      expect(data.body.reportsMade).toEqual([expect.objectContaining({ note: 'checking' })])
      // Reports about them and moderator actions: included, without who reported, their notes, or the moderator's email.
      await reportAs(other.session, { player: me.id, reason: 'other', note: 'written by data-other' })
      await db.prepare("INSERT INTO reports (id, reporter_id, target_player_id, target_run_id, reason, note, created_at, source) VALUES ('auto-about', NULL, ?, NULL, 'cheating', 'Automatic: test', ?, 'auto')").bind(me.id, new Date().toISOString()).run()
      await db.prepare("INSERT INTO admin_actions (id, action, target_player_id, target_run_id, detail, created_at, admin) VALUES ('act-about', 'hide', ?, NULL, NULL, ?, 'owner@example.com')").bind(me.id, new Date().toISOString()).run()
      const full = await call<{ reportsAboutYou: Record<string, unknown>[]; moderatorActions: Record<string, unknown>[] }>('/api/me/data', me.session)
      const text = JSON.stringify(full.body)
      expect(text).not.toMatch(/written by data-other|owner@example\.com|reporter/)
      expect(full.body.reportsAboutYou).toEqual(
        expect.arrayContaining([expect.objectContaining({ reason: 'other', note: null, source: 'player' }), expect.objectContaining({ note: 'Automatic: test', source: 'auto' })]),
      )
      expect(full.body.moderatorActions).toEqual([expect.objectContaining({ action: 'hide' })])
      await db.prepare("DELETE FROM reports WHERE target_player_id = ? AND reason != 'name'").bind(me.id).run()
      expect((await call('/api/me/data', 'not-a-session')).status).toBe(401)

      // Delete the account: confirmed by name; data gone, reports made kept without a name, reports about them gone.
      await reportAs(other.session, { player: me.id, reason: 'name' })
      expect((await call('/api/me/delete', me.session, { confirm: 'someone else' })).status).toBe(400)
      const gone = await call<{ deleted: boolean }>('/api/me/delete', me.session, { confirm: 'DATA-OWNER' })
      expect(gone.body.deleted).toBe(true)
      expect(gone.headers.get('Set-Cookie')).toMatch(/^syntype_session=; /)
      expect((await me_(me.session)).signedIn).toBe(false)
      expect(await boardNames()).toEqual(['data-other'])
      for (const table of ['bests', 'logs']) expect(await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE player_id = ?`).bind(me.id).first()).toEqual({ n: 0 })
      expect(await db.prepare('SELECT reporter_id FROM reports WHERE note = ?').bind('checking').first()).toEqual({ reporter_id: null })
      expect(await db.prepare('SELECT count(*) AS n FROM reports WHERE target_player_id = ?').bind(me.id).first()).toEqual({ n: 0 })
    } finally {
      ;({ snippet, fp } = saved)
    }
  })

  it('accounts unused for two years are deleted; others stay', async () => {
    const old = await named('long-gone')
    const recent = await named('still-here')
    const now = new Date()
    await db.prepare('UPDATE players SET last_seen_at = ? WHERE id = ?').bind(new Date(now.getTime() - 2.1 * 365 * 86_400_000).toISOString(), old.id).run()
    await db.prepare('UPDATE players SET last_seen_at = ? WHERE id = ?').bind(new Date(now.getTime() - 1.9 * 365 * 86_400_000).toISOString(), recent.id).run()
    // Many at once: one batch, so it stays within D1's 50 queries per invocation on the free plan.
    const stale = new Date(now.getTime() - 3 * 365 * 86_400_000).toISOString()
    for (let i = 0; i < 60; i++) {
      await db.prepare('INSERT INTO players (id, provider, provider_id, suggested_name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)').bind(`stale-${i}`, 'github', `stale-${i}`, 'x', stale, stale).run()
    }
    let queries = 0
    const counting: Db = {
      prepare: (sql) => db.prepare(sql),
      batch: (stmts) => {
        queries++
        return db.batch(stmts)
      },
    }
    expect(await deleteInactive(counting, now)).toBeGreaterThanOrEqual(61)
    expect(queries).toBe(1)
    expect(await db.prepare('SELECT id FROM players WHERE id IN (?, ?)').bind(old.id, recent.id).all()).toMatchObject({ results: [{ id: recent.id }] })
  })

  it('flags a new best far above the player’s history for the admin, with the run’s details; the run stays up', async () => {
    const p = await named('sudden-jump')
    // Three earlier bests around 50 WPM, on other (older) snippet versions.
    const at = new Date().toISOString()
    for (let i = 0; i < 3; i++) {
      const old = `${i}`.repeat(64).slice(0, 64).replace(/./g, String.fromCharCode(97 + i))
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO snippet_versions (fingerprint, language, name, length, code, first_seen_at) VALUES (?, 'python', ?, 'short', 'x', ?)").bind(old, `old${i}.py`, at),
        db.prepare("INSERT INTO bests (player_id, fingerprint, aids, language, run_id, wpm, raw_wpm, accuracy, seconds, run_aids, finished_at) VALUES (?, ?, 'any', 'python', ?, 50, 50, 97, 9, '110', ?)").bind(p.id, old, `slow-${i}-${p.id}`, at),
      ])
    }
    const run = await submit(p.session, honestRun(1, 99))
    expect(run.body).toMatchObject({ accepted: true, best: true })
    clearAccessKeys()
    const access = await fakeAccess()
    const res = await handle(new Request(`${SITE}/api/admin/reports`, { headers: { [ACCESS_HEADER]: await access.token() } }), deps(access.fetchImpl))
    type Queue = { groups: { player: { id: string }; run: string; runInfo: { snippet: string; hasLog: boolean; wpm: number } | null; reports: { automatic: boolean; reporter: string | null; note: string }[] }[] }
    const group = ((await res.json()) as Queue).groups.find((g) => g.player.id === p.id)!
    expect(group.run).toBe(run.body.runId)
    expect(group.runInfo).toMatchObject({ snippet: snippet.name, hasLog: true })
    expect(group.reports).toEqual([expect.objectContaining({ automatic: true, reporter: null, note: expect.stringMatching(/against an average of 50 on their 3 other snippets/) })])
    // The admin sees the player's entries, from the player search.
    const runs = await handle(new Request(`${SITE}/api/admin/players/${p.id}/runs`, { headers: { [ACCESS_HEADER]: await access.token() } }), deps(access.fetchImpl))
    expect(((await runs.json()) as { entries: { runId: string }[] }).entries.map((e) => e.runId)).toContain(run.body.runId)
  })

  it('looks runs up without scanning the whole scores table (query plans)', async () => {
    const p = await named('plan-check')
    const run = await submit(p.session, honestRun(1, 101))
    const runId = run.body.runId!
    // Record every statement the functions run, then ask SQLite how it would run each one.
    const seen: { sql: string; binds: unknown[] }[] = []
    const recording: Db = {
      prepare(sql) {
        const stmt = db.prepare(sql)
        const wrap = (binds: unknown[]): Statement => {
          seen.push({ sql, binds })
          const bound = stmt.bind(...binds)
          return { bind: (...b) => wrap(b), first: () => bound.first(), all: () => bound.all(), run: () => bound.run() } as Statement
        }
        return { bind: (...b: unknown[]) => wrap(b), first: () => stmt.first(), all: () => stmt.all(), run: () => stmt.run() } as Statement
      },
      batch: () => Promise.resolve([]),
    }
    await runForReplay(recording, runId, { admin: true })
    await runRemoval(recording, runId, p.id)
    await myPlace(recording, p.id, fp, 'any')
    expect(seen.length).toBeGreaterThan(3)
    for (const { sql, binds } of seen.filter((x) => /^\s*(SELECT|DELETE|INSERT)/i.test(x.sql))) {
      const plan = (await db.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind(...binds).all<{ detail: string }>()).results.map((r) => r.detail)
      expect(plan.join(' | '), sql).not.toMatch(/\bSCAN (b|bests)\b/)
    }
  })

  it('keeps no keystrokes for hidden players, and never more than one log per player and snippet', async () => {
    const hidden = await named('hidden-typist')
    await db.prepare('UPDATE players SET hidden = 1 WHERE id = ?').bind(hidden.id).run()
    const run = await submit(hidden.session, honestRun(1, 111))
    expect(run.body).toMatchObject({ accepted: true, best: true })
    expect(await db.prepare('SELECT count(*) AS n FROM logs WHERE player_id = ?').bind(hidden.id).first()).toEqual({ n: 0 })

    // A stray log for the same snippet (as two bests submitted at once could leave) goes with the next best.
    const p = await named('two-tabs')
    const first = await submit(p.session, honestRun(1, 112))
    await db.prepare('INSERT INTO logs (run_id, player_id, fingerprint, log, created_at) VALUES (?, ?, ?, ?, ?)').bind('stray-run', p.id, fp, new Uint8Array([1]), new Date().toISOString()).run()
    const second = await submit(p.session, honestRun(1.3, 113))
    expect(second.body.best).toBe(true)
    const logs = (await db.prepare('SELECT run_id FROM logs WHERE player_id = ?').bind(p.id).all<{ run_id: string }>()).results.map((r) => r.run_id)
    expect(logs).toEqual([second.body.runId])
    expect(logs).not.toContain(first.body.runId)
  })

  it('hiding writes only when it changes something, and at most as often as the limiter allows', async () => {
    const p = await named('toggler')
    let allowed = 1
    const limiter = { limit: async () => ({ success: allowed-- > 0 }) }
    const hide = (hidden: boolean) =>
      handle(
        new Request(`${SITE}/api/me/hide`, {
          method: 'POST',
          headers: { Cookie: `${SESSION_COOKIE}=${p.session}`, Origin: SITE, 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden }),
        }),
        { ...deps(), limits: { hide: limiter } },
      )
    // Already shown: no change, so neither a write nor a use of the limit.
    expect((await hide(false)).status).toBe(200)
    expect(allowed).toBe(1)
    expect((await hide(true)).status).toBe(200)
    expect((await hide(false)).status).toBe(429)
    expect(await db.prepare('SELECT hidden FROM players WHERE id = ?').bind(p.id).first()).toEqual({ hidden: 1 })
  })

  it('a request body over the limit is refused before it is read', async () => {
    const p = await named('big-body')
    const res = await handle(
      new Request(`${SITE}/api/me/name`, {
        method: 'POST',
        headers: { Cookie: `${SESSION_COOKIE}=${p.session}`, Origin: SITE, 'Content-Type': 'application/json', 'Content-Length': '100000' },
        body: JSON.stringify({ name: 'x'.repeat(99_980) }),
      }),
      deps(),
    )
    expect(res.status).toBe(413)
  })

  it('a token is the player’s own', async () => {
    const a = await named('token-owner')
    const b = await named('token-thief')
    const run = honestRun(1, 61)
    const t0 = Date.now()
    const token = await start(a.session, new Date(t0))
    expect((await submit(b.session, run, { t0, token })).status).toBe(400)
  })
})
