/**
 * Tests only: the API's test setup, shared by the *.api.test.ts files. Each
 * file that calls setUpApi() gets its own local D1 database (wrangler's
 * platform proxy) with the real migrations applied, the build's snippet
 * data files as static assets, and simulated GitHub, Google and Turnstile.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { handle, SESSION_COOKIE, SIGNIN_COOKIE, type ApiConfig, type Deps } from './api'
import type { Db } from './db'
import { AUD, TEAM } from './test-access'
import { LANGUAGES } from '../../src/languages'
import { snippetFiles, type SnippetFile } from '../../src/lib/snippetfiles'
import type { TypingAids } from '../../src/lib/runcore'
import { honestRun } from '../../src/test/harness'
import type { Language, Snippet } from '../../src/languages/types'

export const config: ApiConfig = {
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
export const SITE = config.SITE_URL

/** The test database and snippet data; set once setUpApi()'s beforeAll has run. */
export const env = { db: undefined as unknown as Db, snippetData: new Map<string, SnippetFile>() }

/** The build's snippet data files, as the Worker's static assets serve them. */
export const assets = async (path: string) => {
  if (path.endsWith('/index.json')) return Response.json([...env.snippetData.values()].map(({ fingerprint, language, name, length }) => ({ fingerprint, language, name, length })))
  const f = env.snippetData.get(path.split('/').pop()!.replace('.json', ''))
  return f ? Response.json(f) : new Response('Not found', { status: 404 })
}

/** Sets up this test file's database: call once, at the top. */
export function setUpApi() {
  let dispose: (() => Promise<void>) | undefined
  beforeAll(async () => {
    const proxy = await getPlatformProxy<{ DB: Db }>({ persist: false })
    env.db = proxy.env.DB
    dispose = proxy.dispose
    env.snippetData = new Map((await snippetFiles(LANGUAGES)).map((f) => [f.fingerprint, f]))
    // The real migrations, in order, one statement at a time.
    const dir = new URL('../../migrations/', import.meta.url)
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      const sql = readFileSync(new URL(file, dir), 'utf8').replace(/--[^\n]*/g, '')
      for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) await env.db.prepare(stmt).run()
    }
  }, 60_000)
  afterAll(() => dispose?.())
}

let ids = 1000
/** A provider account id no other test uses. */
export const nextId = () => ids++

/** A simulated provider: GitHub or Google answering the token and profile requests. */
export function providers(profile: { github?: { id: number; login: string }; google?: Record<string, unknown>; fail?: boolean }) {
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

export const deps = (fetchImpl: Deps['fetch'] = async () => new Response(null, { status: 500 }), now?: Date): Deps => ({
  db: env.db,
  config,
  fetch: fetchImpl,
  assets,
  now: now && (() => now),
})

/**
 * A request to the API. A body makes it a POST from the site's pages (`origin:
 * null` leaves Origin out, as another site's form would); `session` signs it in.
 */
export function req(
  path: string,
  opts: { session?: string | null; body?: unknown; method?: string; origin?: string | null; headers?: Record<string, string>; now?: Date; fetch?: Deps['fetch'] } = {},
) {
  const post = opts.method === 'POST' || opts.body !== undefined
  const headers: Record<string, string> = { ...opts.headers }
  if (opts.session) headers.Cookie = `${SESSION_COOKIE}=${opts.session}`
  if (post && opts.origin !== null) headers.Origin = opts.origin ?? SITE
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const init: RequestInit = { method: opts.method ?? (post ? 'POST' : 'GET'), headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }
  return handle(new Request(`${SITE}${path}`, init), deps(opts.fetch, opts.now))
}

export const cookieFrom = (res: Response, name: string) =>
  res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))?.split(';')[0].slice(name.length + 1)

/** Signs in through the whole flow; returns the session cookie and where it landed. */
export async function signIn(provider: 'github' | 'google', fetchImpl: Deps['fetch'], ret = '/runs') {
  const start = await handle(new Request(`${SITE}/api/auth/${provider}/start?return=${encodeURIComponent(ret)}`), deps(fetchImpl))
  const pending = cookieFrom(start, SIGNIN_COOKIE)!
  const state = new URL(start.headers.get('Location')!).searchParams.get('state')!
  const back = await handle(
    new Request(`${SITE}/api/auth/${provider}/callback?code=abc&state=${state}`, { headers: { Cookie: `${SIGNIN_COOKIE}=${pending}` } }),
    deps(fetchImpl),
  )
  return { start, back, session: cookieFrom(back, SESSION_COOKIE) }
}

export const me = async (session?: string, now?: Date) =>
  (await (await req('/api/me', { session, now })).json()) as {
    signedIn: boolean
    player?: { id: string; name: string | null; suggestedName: string; provider: string }
  }

export const rename = (session: string, name: unknown, origin: string | null = SITE, now?: Date) => req('/api/me/name', { session, body: { name }, origin, now })

/** A signed-in player with a confirmed name. */
export async function named(login: string) {
  const { session } = await signIn('github', providers({ github: { id: nextId(), login } }).fetchImpl)
  expect((await rename(session!, login)).status).toBe(200)
  return { session: session!, id: (await me(session)).player!.id }
}

export const reportAs = (session: string | null, body: unknown, origin: string | null = SITE) => req('/api/reports', { session, body, origin })

// ——— Runs ———

/**
 * Turnstile: 'person' passes, solved on our site for our action; 'elsewhere'
 * and 'other-action' pass but for another hostname or action; anything else fails.
 */
export const turnstile =
  (seen: unknown[] = []) =>
  async (input: string, init?: RequestInit) => {
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

export type Answer = { accepted: boolean; reason?: string; best?: boolean; bestForAids?: boolean; rank?: number; runId?: string; wpm?: number }
export const RUN_AIDS: TypingAids = { autoIndent: true, autoClose: true, autocomplete: false }
export const PYTHON: Language = LANGUAGES.find((l) => l.id === 'python')!

/** A Python snippet's fingerprint (its board). */
export const fpOf = (snippet: Snippet) => [...env.snippetData.values()].find((f) => f.language === 'python' && f.name === snippet.name)!.fingerprint

/** Runs as the game sends them, on whichever Python snippet `current` names (a test can move to another board). */
export function runHelpers(current: () => { snippet: Snippet; fp: string }) {
  const post = (path: string, session: string, body: unknown, at: Date, fetchImpl = turnstile()) => req(path, { session, body, now: at, fetch: fetchImpl })
  const start = async (session: string, at: Date) => ((await (await post('/api/runs/start', session, { fingerprint: current().fp }, at)).json()) as { token: string }).token
  /** An honest run of the snippet; `speed` scales how fast it's typed. */
  const honestRunOf = (speed = 1, seed = 5) => honestRun(PYTHON, current().snippet, RUN_AIDS, { speed, seed, acceptSuggestions: false })
  /** Starts at t0 and submits right after finishing (or `late` ms later). */
  async function submit(session: string, run: ReturnType<typeof honestRunOf>, opts: { t0?: number; late?: number; turnstileToken?: string; token?: string } = {}) {
    const t0 = opts.t0 ?? Date.now()
    const token = opts.token ?? (await start(session, new Date(t0)))
    const res = await post('/api/runs', session, { token, aids: RUN_AIDS, log: run.log, result: run.result, turnstile: opts.turnstileToken ?? 'person' }, new Date(t0 + run.duration + (opts.late ?? 1500)))
    return { status: res.status, body: (await res.json()) as Answer, token }
  }
  return { post, start, honestRun: honestRunOf, submit }
}
