/**
 * Automatic flags (docs/leaderboard.md, "Moderation"): a new best far above
 * the player's own history goes to the admin's report queue. The run stays on
 * the board; the admin watches the replay and decides.
 */
import type { Db } from './db'

/** A new best this many times the player's average on their other snippets... */
export const JUMP_FACTOR = 1.6
/** ...and at least this fast (a jump from 30 to 50 WPM is just practice). */
export const JUMP_MIN_WPM = 90
/** History needed before a jump means anything. */
export const HISTORY_MIN = 3
/** A newcomer taking #1 is flagged on boards with at least this many players. */
export const NEWCOMER_BOARD_MIN = 5

/** Why a new best should be looked at, or null. Pure, for the tests. */
export function flagReason(run: { wpm: number; rank: number }, history: { count: number; average: number }, boardSize: number): string | null {
  if (history.count >= HISTORY_MIN && run.wpm >= JUMP_MIN_WPM && run.wpm >= JUMP_FACTOR * history.average) {
    return `Automatic: ${Math.round(run.wpm)} WPM, against an average of ${Math.round(history.average)} on their ${history.count} other snippets.`
  }
  if (history.count < HISTORY_MIN && run.rank === 1 && boardSize >= NEWCOMER_BOARD_MIN) {
    return `Automatic: a new player straight to #1 of ${boardSize}, with ${history.count === 0 ? 'no other runs' : `${history.count} other snippet${history.count === 1 ? '' : 's'}`}.`
  }
  return null
}

/** Checks a new best and, if it stands out, files an automatic report about it. */
export async function flagIfUnusual(db: Db, run: { playerId: string; runId: string; fingerprint: string; wpm: number; rank: number }, now: Date): Promise<string | null> {
  const history = (await db
    .prepare("SELECT count(*) AS count, coalesce(avg(wpm), 0) AS average FROM bests WHERE player_id = ? AND aids = 'any' AND fingerprint != ?")
    .bind(run.playerId, run.fingerprint)
    .first<{ count: number; average: number }>())!
  let boardSize = 0
  if (history.count < HISTORY_MIN && run.rank === 1) {
    boardSize = (await db
      .prepare("SELECT count(*) AS n FROM bests b JOIN players p ON p.id = b.player_id WHERE b.fingerprint = ? AND b.aids = 'any' AND p.hidden = 0 AND p.moderator_hidden = 0")
      .bind(run.fingerprint)
      .first<{ n: number }>())!.n
  }
  const reason = flagReason(run, history, boardSize)
  if (!reason) return null
  await db
    .prepare("INSERT INTO reports (id, reporter_id, target_player_id, target_run_id, reason, note, created_at, source) VALUES (?, NULL, ?, ?, 'cheating', ?, ?, 'auto')")
    .bind(crypto.randomUUID(), run.playerId, run.runId, reason, now.toISOString())
    .run()
  return reason
}
