/**
 * What signed-in players can do with their own data (docs/leaderboard.md,
 * "Player actions" and "Privacy"): hide from the boards, see and delete their
 * entries, download everything kept about them, and delete their account.
 * Inactive accounts are deleted after two years.
 */
import type { Db } from './db'
import { runRemoval } from './boards'
import { gunzip } from './runs'
import type { PlayerRow } from './players'

export const INACTIVE_YEARS = 2

/** Shows or hides the player on every board. A moderator's hide stays either way. */
export async function setHidden(db: Db, player: PlayerRow, hidden: unknown) {
  if (typeof hidden !== 'boolean') return { ok: false as const, status: 400, error: 'Say whether to hide.' }
  await db.prepare('UPDATE players SET hidden = ? WHERE id = ?').bind(hidden ? 1 : 0, player.id).run()
  return { ok: true as const }
}

/** The player's leaderboard entries: their overall best on each snippet version. */
export async function myEntries(db: Db, player: Pick<PlayerRow, 'id'>) {
  const { results } = await db
    .prepare(
      `SELECT b.run_id, b.fingerprint, b.wpm, b.accuracy, b.run_aids, b.finished_at, v.language, v.name, v.length, (l.run_id IS NOT NULL) AS has_log
       FROM bests b JOIN snippet_versions v ON v.fingerprint = b.fingerprint LEFT JOIN logs l ON l.run_id = b.run_id
       WHERE b.player_id = ? AND b.aids = 'any' ORDER BY b.finished_at DESC`,
    )
    .bind(player.id)
    .all<{ run_id: string; fingerprint: string; wpm: number; accuracy: number; run_aids: string; finished_at: string; language: string; name: string; length: string; has_log: number }>()
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
  if (!removal) return { ok: false as const, status: 404, error: 'That run isn’t one of yours on the boards.' }
  await db.batch(removal.writes)
  return { ok: true as const }
}

/** Everything the server keeps about the player, as one file. */
export async function myData(db: Db, player: PlayerRow, now: Date) {
  const [bests, logs, reports] = await Promise.all([
    db.prepare('SELECT fingerprint, aids, language, run_id, wpm, raw_wpm, accuracy, seconds, run_aids, finished_at FROM bests WHERE player_id = ? ORDER BY fingerprint, aids').bind(player.id).all(),
    db.prepare('SELECT run_id, fingerprint, log, created_at FROM logs WHERE player_id = ?').bind(player.id).all<{ run_id: string; fingerprint: string; log: ArrayBuffer; created_at: string }>(),
    db.prepare('SELECT target_player_id, target_run_id, reason, note, status, created_at FROM reports WHERE reporter_id = ? ORDER BY created_at').bind(player.id).all(),
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
    logs: await Promise.all(logs.results.map(async (l) => ({ runId: l.run_id, fingerprint: l.fingerprint, createdAt: l.created_at, log: JSON.parse(await gunzip(new Uint8Array(l.log))) }))),
    reportsMade: reports.results,
  }
}

/** The writes that delete a player: logs, bests and reports about them go; reports they made stay, without their name; the moderation log forgets their names. One transaction. */
const deletion = (db: Db, playerId: string) => [
  db.prepare('UPDATE reports SET reporter_id = NULL WHERE reporter_id = ?').bind(playerId),
  // The moderation log keeps what was done, but not their names (a rename's old and new name).
  db.prepare('UPDATE admin_actions SET detail = NULL WHERE target_player_id = ? AND action = ?').bind(playerId, 'rename'),
  db.prepare('DELETE FROM reports WHERE target_player_id = ?').bind(playerId),
  db.prepare('DELETE FROM logs WHERE player_id = ?').bind(playerId),
  db.prepare('DELETE FROM bests WHERE player_id = ?').bind(playerId),
  db.prepare('DELETE FROM players WHERE id = ?').bind(playerId),
]

/** Deletes the account, once the player has typed their name (or, without one, the suggested name) to confirm. */
export async function deleteAccount(db: Db, player: PlayerRow, body: unknown) {
  const typed = (body as { confirm?: unknown } | null)?.confirm
  const expected = player.name ?? player.suggested_name
  if (typeof typed !== 'string' || typed.trim().toLowerCase() !== expected.toLowerCase()) {
    return { ok: false as const, status: 400, error: `Type ${expected} to confirm.` }
  }
  await db.batch(deletion(db, player.id))
  return { ok: true as const }
}

/** Deletes accounts nobody has signed in to for two years (the daily scheduled run). */
export async function deleteInactive(db: Db, now: Date): Promise<number> {
  const before = new Date(now.getTime())
  before.setUTCFullYear(before.getUTCFullYear() - INACTIVE_YEARS)
  const { results } = await db.prepare('SELECT id FROM players WHERE last_seen_at < ? LIMIT 200').bind(before.toISOString()).all<{ id: string }>()
  for (const { id } of results) await db.batch(deletion(db, id))
  return results.length
}
