/**
 * The API, signing in, sessions and leaderboard names. Shared setup in test-api.ts: each file gets its own
 * local D1 database with the real migrations.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { handle, originOf, safeReturn, SESSION_COOKIE, SIGNIN_COOKIE } from './api'
import { sign } from './crypto'
import type { Db } from './db'
import { RENAME_EVERY_MS } from './names'
import { config, cookieFrom, deps, env, me, nextId, providers, rename, signIn, SITE, setUpApi } from './test-api'

setUpApi()
let db: Db
beforeAll(() => {
  db = env.db
})

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
    const id = nextId()
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
    const sub = `g-${nextId()}`
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
    const { session } = await signIn('github', providers({ github: { id: nextId(), login: 'session-test' } }).fetchImpl)
    const player = (await me(session)).player!
    // Change a character in the middle of the signature: the last one holds unused bits, so changing it
    // can leave the signature's bytes as they were.
    const dot = session!.indexOf('.')
    const at = dot + 20
    const tampered = session!.slice(0, at) + (session![at] === 'A' ? 'B' : 'A') + session!.slice(at + 1)
    expect((await me(tampered)).signedIn).toBe(false)
    const forged = await sign('not-the-secret', { p: player.id, v: 1, exp: Date.now() + 60_000 })
    expect((await me(forged)).signedIn).toBe(false)
    expect((await me(session, new Date(Date.now() + 31 * 86_400_000))).signedIn).toBe(false)
    // Signing a player out everywhere (as deleting the account will) ends every session.
    await db.prepare('UPDATE players SET session_version = session_version + 1 WHERE id = ?').bind(player.id).run()
    expect((await me(session)).signedIn).toBe(false)
  })

  it('a token of one kind never passes as another, and old untyped sessions no longer count', async () => {
    const { session } = await signIn('github', providers({ github: { id: nextId(), login: 'kinds' } }).fetchImpl)
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
    const { fetchImpl } = providers({ github: { id: nextId(), login: 'pkce-check' } })
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
    const { session } = await signIn('github', providers({ github: { id: nextId(), login: 'namer' } }).fetchImpl)
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
    const a = await signIn('github', providers({ github: { id: nextId(), login: 'first-taker' } }).fetchImpl)
    const b = await signIn('github', providers({ github: { id: nextId(), login: 'second-taker' } }).fetchImpl)
    expect((await rename(a.session!, 'Speedy')).status).toBe(200)
    const taken = await rename(b.session!, 'SPEEDY')
    expect(taken.status).toBe(409)
    expect(((await taken.json()) as { error: string }).error).toMatch(/taken/)
  })

  it('renaming is allowed once a week; confirming the first name does not start the wait', async () => {
    const { session } = await signIn('github', providers({ github: { id: nextId(), login: 'renamer' } }).fetchImpl)
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
