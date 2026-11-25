/**
 * The API, reports and the admin API. Shared setup in test-api.ts: each file gets its own
 * local D1 database with the real migrations.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { handle } from './api'
import { ACCESS_HEADER, clearAccessKeys } from './access'
import type { Db } from './db'
import { fakeAccess } from './test-access'
import { deps, env, me, named, nextId, providers, rename, reportAs, signIn, SITE, setUpApi } from './test-api'

setUpApi()
let db: Db
beforeAll(() => {
  db = env.db
})

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
    const { session } = await signIn('github', providers({ github: { id: nextId(), login: 'unnamed-reporter' } }).fetchImpl)
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
