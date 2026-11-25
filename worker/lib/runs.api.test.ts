/**
 * The API, submitting runs. Shared setup in test-api.ts: each file gets its own
 * local D1 database with the real migrations.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { handle, SESSION_COOKIE } from './api'
import type { Db } from './db'
import { LOGS_KEPT } from './runs'
import { unpackLog } from './logs'
import { deps, env, fpOf, named, nextId, providers, PYTHON, RUN_AIDS, runHelpers, signIn, SITE, turnstile, setUpApi, type Answer } from './test-api'

setUpApi()
let db: Db
beforeAll(() => {
  db = env.db
})

describe('submitting runs', () => {
  const lang = PYTHON
  let snippet = lang.snippets.find((x) => x.length === 'short')!
  const AIDS = RUN_AIDS
  let fp: string
  beforeAll(() => {
    fp = fpOf(snippet)
  })
  const { post, start, honestRun, submit } = runHelpers(() => ({ snippet, fp }))

  it('a run token needs a named player and a snippet the game offers', async () => {
    const { session } = await signIn('github', providers({ github: { id: nextId(), login: 'tokenless' } }).fetchImpl)
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
    expect(await unpackLog(stored!.log)).toEqual(run.log)
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
    fp = fpOf(snippet)
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
