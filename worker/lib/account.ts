/**
 * What signed-in players can do with their own data (docs/leaderboard.md,
 * "Player actions" and "Privacy"): hide from the boards, see and delete their
 * entries, download everything kept about them, and delete their account.
 * Inactive accounts are deleted after two years.
 */
import type { Db } from './db'
import { runRemoval } from './boards'
import { unpackLog } from './logs'
import { fail } from './result'
import type { PlayerRow } from './players'
import type { SnippetLength } from '../../src/languages/types'
import type { Entry } from '../../src/lib/apiTypes'

const INACTIVE_YEARS = 2

/** Cloudflare's Rate Limiting binding (wrangler.jsonc "ratelimits"): approximate, per key and Cloudflare location. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/**
 * Shows or hides the player on every board. A moderator's hide stays either
 * way. The only player write with no natural bound, so it writes only when
 * something changes, and at most twice a minute per player (`limiter`).
 */
export async function setHidden(db: Db, player: PlayerRow, hidden: unknown, limiter?: RateLimiter) {
  if (typeof hidden !== 'boolean') return fail(400, 'Say whether to hide.')
  if ((player.hidden === 1) === hidden) return { ok: true as const }
  if (limiter && !(await limiter.limit({ key: player.id })).success) {
    return fail(429, 'That’s a lot of switching. Try again in a minute.')
  }
  await db.prepare('UPDATE players SET hidden = ? WHERE id = ?').bind(hidden ? 1 : 0, player.id).run()
  return { ok: true as const }
}

/** The player's leaderboard entries: their overall best on each snippet version. */
export async function myEntries(db: Db, player: Pick<PlayerRow, 'id'>): Promise<Entry[]> {
  const { results } = await db
    .prepare(
      `SELECT b.run_id, b.fingerprint, b.wpm, b.accuracy, b.run_aids, b.finished_at, v.language, v.name, v.length, (l.run_id IS NOT NULL) AS has_log
       FROM bests b JOIN snippet_versions v ON v.fingerprint = b.fingerprint LEFT JOIN logs l ON l.run_id = b.run_id
       WHERE b.player_id = ? AND b.aids = 'any' ORDER BY b.finished_at DESC`,
    )
    .bind(player.id)
    .all<{ run_id: string; fingerprint: string; wpm: number; accuracy: number; run_aids: string; finished_at: string; language: string; name: string; length: SnippetLength; has_log: number }>()
  return results.map((r) => ({
    runId: r.run_id,
    fingerprint: r.fingerprint,
    language: r.language,
    snippet: r.name,
    length: r.length,
    wpm: r.wpm,
    accuracy: r.accuracy,
    aids: r.run_aids,
    finishedAt: r.finished_at,
    hasLog: r.has_log === 1,
  }))
}

/** Deletes one of the player's own runs from the boards. */
export async function deleteMyRun(db: Db, player: PlayerRow, runId: string) {
  const removal = await runRemoval(db, runId, player.id)
  if (!removal) return fail(404, 'That run isn’t one of yours on the boards.')
  await db.batch(removal.writes)
  return { ok: true as const }
}

/**
 * Everything the server keeps about the player, as one file. Reports about
 * them and moderator actions on them are included without what belongs to
 * other people: who reported them, notes other players wrote, and the
 * moderator's email. (Syntype's own automatic flags keep their note.)
 */
export async function myData(db: Db, player: PlayerRow, now: Date) {
  const [bests, logs, reports, about, actions] = await Promise.all([
    db.prepare('SELECT fingerprint, aids, language, run_id, wpm, raw_wpm, accuracy, seconds, run_aids, finished_at FROM bests WHERE player_id = ? ORDER BY fingerprint, aids').bind(player.id).all(),
    db.prepare('SELECT run_id, fingerprint, log, created_at FROM logs WHERE player_id = ?').bind(player.id).all<{ run_id: string; fingerprint: string; log: ArrayBuffer; created_at: string }>(),
    db.prepare('SELECT target_player_id, target_run_id, reason, note, status, created_at FROM reports WHERE reporter_id = ? ORDER BY created_at').bind(player.id).all(),
    db
      .prepare("SELECT target_run_id AS run_id, reason, CASE WHEN source = 'auto' THEN note END AS note, source, status, created_at FROM reports WHERE target_player_id = ? ORDER BY created_at")
      .bind(player.id)
      .all(),
    db.prepare('SELECT action, target_run_id AS run_id, detail, created_at FROM admin_actions WHERE target_player_id = ? ORDER BY created_at').bind(player.id).all(),
  ])
  return {
    format: 'syntype-account-data',
    version: 1,
    exportedAt: now.toISOString(),
    player: {
      id: player.id,
      provider: player.provider,
      providerId: player.provider_id,
      name: player.name,
      suggestedName: player.suggested_name,
      nameChangedAt: player.name_changed_at,
      hidden: player.hidden === 1,
      hiddenByModerator: player.moderator_hidden === 1,
      createdAt: player.created_at,
      lastSeenAt: player.last_seen_at,
    },
    bests: bests.results,
    logs: await Promise.all(logs.results.map(async (l) => ({ runId: l.run_id, fingerprint: l.fingerprint, createdAt: l.created_at, log: await unpackLog(l.log) }))),
    reportsMade: reports.results,
    reportsAboutYou: about.results,
    moderatorActions: actions.results,
    withheld: 'Who reported you, notes other players wrote in their reports, and the moderator’s email are left out, to protect other people.',
  }
}

/**
 * The writes that delete players: logs, bests and reports about them go;
 * reports they made stay, without their name; the moderation log forgets
 * their names. `who` is a query for their ids, so one batch (one transaction,
 * and one query against D1's per-invocation limit) deletes any number.
 */
const deletion = (db: Db, who: { sql: string; binds: unknown[] }) => {
  const q = (sql: string) => db.prepare(sql.replace('$WHO', who.sql)).bind(...who.binds)
  return [
    q('UPDATE reports SET reporter_id = NULL WHERE reporter_id IN ($WHO)'),
    // The moderation log keeps what was done, but not their names (a rename's old and new name).
    q("UPDATE admin_actions SET detail = NULL WHERE action = 'rename' AND target_player_id IN ($WHO)"),
    q('DELETE FROM reports WHERE target_player_id IN ($WHO)'),
    q('DELETE FROM logs WHERE player_id IN ($WHO)'),
    q('DELETE FROM bests WHERE player_id IN ($WHO)'),
    q('DELETE FROM players WHERE id IN ($WHO)'),
  ]
}

/** Deletes the account, once the player has typed their name (or, without one, the suggested name) to confirm. */
export async function deleteAccount(db: Db, player: PlayerRow, body: unknown) {
  const typed = (body as { confirm?: unknown } | null)?.confirm
  const expected = player.name ?? player.suggested_name
  if (typeof typed !== 'string' || typed.trim().toLowerCase() !== expected.toLowerCase()) {
    return fail(400, `Type ${expected} to confirm.`)
  }
  await db.batch(deletion(db, { sql: 'SELECT ?', binds: [player.id] }))
  return { ok: true as const }
}

/**
 * Deletes accounts nobody has signed in to for two years (the daily scheduled
 * run), all in one batch. It reads the players table once a day: cheaper than
 * an index on last_seen_at, which would add a write to every daily visit.
 */
export async function deleteInactive(db: Db, now: Date): Promise<number> {
  const before = new Date(now.getTime())
  before.setUTCFullYear(before.getUTCFullYear() - INACTIVE_YEARS)
  const results = (await db.batch(deletion(db, { sql: 'SELECT id FROM players WHERE last_seen_at < ?', binds: [before.toISOString()] }))) as { meta: { changes: number } }[]
  return results.at(-1)!.meta.changes
}
