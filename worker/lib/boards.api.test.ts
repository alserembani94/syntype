/**
 * The API, boards, replays, removal and flags. Shared setup in test-api.ts: each file gets its own
 * local D1 database with the real migrations.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { handle, SESSION_COOKIE } from './api'
import { ACCESS_HEADER, clearAccessKeys } from './access'
import type { Db, Statement } from './db'
import { fakeAccess } from './test-access'
import { myPlace, runForReplay, runRemoval } from './boards'
import { type LogEntry } from '../../src/lib/runcore'
import { deps, env, fpOf, named, PYTHON, runHelpers, SITE, setUpApi } from './test-api'

setUpApi()
let db: Db
beforeAll(() => {
  db = env.db
})

describe('boards', () => {
  const lang = PYTHON
  let snippet = lang.snippets.find((x) => x.length === 'short')!
  let fp: string
  beforeAll(() => {
    fp = fpOf(snippet)
  })
  const { honestRun, submit } = runHelpers(() => ({ snippet, fp }))

  it('boards: top scores by language, a board’s top 15 for an aid filter, your place, replays, and removal', async () => {
    const saved = { snippet, fp }
    snippet = lang.snippets.filter((x) => x.length === 'medium')[0]
    fp = fpOf(snippet)
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

})
