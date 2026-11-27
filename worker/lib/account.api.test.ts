/**
 * The API, a player’s own account and data. Shared setup in test-api.ts: each file gets its own
 * local D1 database with the real migrations.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { handle, SESSION_COOKIE } from './api'
import type { Db } from './db'
import { deleteInactive } from './account'
import { deps, env, fpOf, me, named, PYTHON, reportAs, runHelpers, SITE, setUpApi } from './test-api'

setUpApi()
let db: Db
beforeAll(() => {
  db = env.db
})

describe('a player’s own data', () => {
  const lang = PYTHON
  let snippet = lang.snippets.find((x) => x.length === 'short')!
  let fp: string
  beforeAll(() => {
    fp = fpOf(snippet)
  })
  const { honestRun, submit } = runHelpers(() => ({ snippet, fp }))

  it('players hide, list and delete their entries, download their data, and delete their account', async () => {
    const saved = { snippet, fp }
    snippet = lang.snippets.filter((x) => x.length === 'medium')[1]
    fp = fpOf(snippet)
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
      const owner = await named('data-owner')
      const other = await named('data-other')
      const mine = await submit(owner.session, honestRun(1.2, 91))
      const theirs = await submit(other.session, honestRun(1, 92))
      expect(await boardNames()).toEqual(['data-owner', 'data-other'])

      // Hide and show again.
      const hid = await call<{ player: { hidden: boolean } }>('/api/me/hide', owner.session, { hidden: true })
      expect(hid.body.player.hidden).toBe(true)
      expect(await boardNames()).toEqual(['data-other'])
      await call('/api/me/hide', owner.session, { hidden: false })
      expect(await boardNames()).toEqual(['data-owner', 'data-other'])

      // Entries, and deleting one; another player's runs aren't yours to delete.
      const entries = await call<{ entries: { runId: string; snippet: string; hasLog: boolean }[] }>('/api/me/runs', owner.session)
      expect(entries.body.entries).toEqual([expect.objectContaining({ runId: mine.body.runId, snippet: snippet.name, hasLog: true })])
      expect((await call(`/api/me/runs/${theirs.body.runId}/delete`, owner.session, {})).status).toBe(404)
      expect((await call(`/api/me/runs/${mine.body.runId}/delete`, owner.session, {})).status).toBe(200)
      expect(await boardNames()).toEqual(['data-other'])

      // Download: everything kept, with logs readable.
      const again = await submit(owner.session, honestRun(1.1, 93))
      await reportAs(owner.session, { player: other.id, reason: 'other', note: 'checking' })
      const data = await call<{ player: { name: string }; bests: unknown[]; logs: { runId: string; log: unknown[] }[]; reportsMade: { note: string }[] }>('/api/me/data', owner.session)
      expect(data.headers.get('Content-Disposition')).toMatch(/attachment/)
      expect(data.body.player.name).toBe('data-owner')
      expect(data.body.bests.length).toBe(2)
      expect(data.body.logs).toEqual([expect.objectContaining({ runId: again.body.runId })])
      expect(data.body.logs[0].log.length).toBeGreaterThan(10)
      expect(data.body.reportsMade).toEqual([expect.objectContaining({ note: 'checking' })])
      // Reports about them and moderator actions: included, without who reported, their notes, or the moderator's email.
      await reportAs(other.session, { player: owner.id, reason: 'other', note: 'written by data-other' })
      await db.prepare("INSERT INTO reports (id, reporter_id, target_player_id, target_run_id, reason, note, created_at, source) VALUES ('auto-about', NULL, ?, NULL, 'cheating', 'Automatic: test', ?, 'auto')").bind(owner.id, new Date().toISOString()).run()
      await db.prepare("INSERT INTO admin_actions (id, action, target_player_id, target_run_id, detail, created_at, admin) VALUES ('act-about', 'hide', ?, NULL, NULL, ?, 'owner@example.com')").bind(owner.id, new Date().toISOString()).run()
      const full = await call<{ reportsAboutYou: Record<string, unknown>[]; moderatorActions: Record<string, unknown>[] }>('/api/me/data', owner.session)
      const text = JSON.stringify(full.body)
      expect(text).not.toMatch(/written by data-other|owner@example\.com|reporter/)
      expect(full.body.reportsAboutYou).toEqual(
        expect.arrayContaining([expect.objectContaining({ reason: 'other', note: null, source: 'player' }), expect.objectContaining({ note: 'Automatic: test', source: 'auto' })]),
      )
      expect(full.body.moderatorActions).toEqual([expect.objectContaining({ action: 'hide' })])
      await db.prepare("DELETE FROM reports WHERE target_player_id = ? AND reason != 'name'").bind(owner.id).run()
      expect((await call('/api/me/data', 'not-a-session')).status).toBe(401)

      // Delete the account: confirmed by name; data gone, reports made kept without a name, reports about them gone.
      await reportAs(other.session, { player: owner.id, reason: 'name' })
      expect((await call('/api/me/delete', owner.session, { confirm: 'someone else' })).status).toBe(400)
      const gone = await call<{ deleted: boolean }>('/api/me/delete', owner.session, { confirm: 'DATA-OWNER' })
      expect(gone.body.deleted).toBe(true)
      expect(gone.headers.get('Set-Cookie')).toMatch(/^syntype_session=; /)
      expect((await me(owner.session)).signedIn).toBe(false)
      expect(await boardNames()).toEqual(['data-other'])
      for (const table of ['bests', 'logs']) expect(await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE player_id = ?`).bind(owner.id).first()).toEqual({ n: 0 })
      expect(await db.prepare('SELECT reporter_id FROM reports WHERE note = ?').bind('checking').first()).toEqual({ reporter_id: null })
      expect(await db.prepare('SELECT count(*) AS n FROM reports WHERE target_player_id = ?').bind(owner.id).first()).toEqual({ n: 0 })
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

})
