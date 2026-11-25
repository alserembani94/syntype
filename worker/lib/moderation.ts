/**
 * Reports from players, and what the admin does about them
 * (docs/leaderboard.md, "Moderation"). Every admin action is written to
 * admin_actions, with the admin's Access email.
 */
import { fail, isUniqueViolation, type Result } from './result'
import type { Db } from './db'
import { nameKey, nameProblem, tidyName } from './names'
import { getPlayer, type PlayerRow } from './players'
import { runRemoval } from './boards'
import { PLAYER_ACTIONS, REPORT_REASONS, type AdminAction, type AdminPlayer, type PlayerAction, type ReportGroup, type ReportReason, type RunInfo } from '../../src/lib/apiTypes'

export const REASONS = REPORT_REASONS
export type Reason = ReportReason
export const NOTE_MAX = 500
export const REPORTS_PER_DAY = 10


/** A player reports a player, or one of their runs. */
export async function report(db: Db, reporter: PlayerRow, body: unknown, now: Date): Promise<Result<{ id: string }>> {
  const b = (body ?? {}) as { player?: unknown; run?: unknown; reason?: unknown; note?: unknown }
  if (!reporter.name) return fail(403, 'Choose your leaderboard name before reporting.')
  if (typeof b.player !== 'string' || !b.player) return fail(400, 'Say who you are reporting.')
  if (b.run !== undefined && b.run !== null && (typeof b.run !== 'string' || !b.run)) return fail(400, 'That run isn’t valid.')
  if (typeof b.reason !== 'string' || !REASONS.includes(b.reason as Reason)) return fail(400, 'Pick a reason.')
  if (b.note !== undefined && b.note !== null && typeof b.note !== 'string') return fail(400, 'The note must be text.')
  const note = typeof b.note === 'string' ? b.note.trim() : ''
  if (note.length > NOTE_MAX) return fail(400, `Keep the note to ${NOTE_MAX} characters.`)
  if (b.player === reporter.id) return fail(400, 'You can’t report yourself.')
  const run = typeof b.run === 'string' ? b.run : null

  const target = await getPlayer(db, b.player)
  if (!target) return fail(404, 'That player no longer exists.')
  if (run && !(await db.prepare('SELECT 1 AS found FROM bests WHERE run_id = ? AND player_id = ?').bind(run, target.id).first())) {
    return fail(404, 'That run is no longer on the leaderboards.')
  }
  const already = await db
    .prepare('SELECT 1 AS found FROM reports WHERE reporter_id = ? AND target_player_id = ? AND target_run_id IS ?')
    .bind(reporter.id, target.id, run)
    .first()
  if (already) return fail(409, 'You’ve already reported this.')
  const today = await db
    .prepare('SELECT count(*) AS n FROM reports WHERE reporter_id = ? AND created_at > ?')
    .bind(reporter.id, new Date(now.getTime() - 86_400_000).toISOString())
    .first<{ n: number }>()
  if ((today?.n ?? 0) >= REPORTS_PER_DAY) return fail(429, `You can send up to ${REPORTS_PER_DAY} reports a day. Try again tomorrow.`)

  const id = crypto.randomUUID()
  try {
    await db
      .prepare('INSERT INTO reports (id, reporter_id, target_player_id, target_run_id, reason, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, reporter.id, target.id, run, b.reason, note || null, now.toISOString())
      .run()
  } catch (err) {
    // Two reports of the same run at once: the table's UNIQUE catches the second.
    if (isUniqueViolation(err)) return fail(409, 'You’ve already reported this.')
    throw err
  }
  return { ok: true, id }
}

// ——— The admin page ———

const adminPlayer = (p: PlayerRow & { open_reports?: number }): AdminPlayer => ({
  id: p.id,
  provider: p.provider,
  providerId: p.provider_id,
  name: p.name,
  suggestedName: p.suggested_name,
  hidden: p.hidden === 1,
  hiddenByModerator: p.moderator_hidden === 1,
  nameChangedAt: p.name_changed_at,
  createdAt: p.created_at,
  lastSeenAt: p.last_seen_at,
  openReports: p.open_reports ?? 0,
})

const OPEN_REPORTS = "(SELECT count(*) FROM reports r WHERE r.target_player_id = players.id AND r.status = 'open') AS open_reports"
const LIST_MAX = 50

/** Players by name (any case, either the confirmed or the suggested one) or exact ID; the newest first without a query. */
export async function findPlayers(db: Db, q: string | null): Promise<AdminPlayer[]> {
  const query = (q ?? '').trim()
  if (!query) {
    const { results } = await db.prepare(`SELECT *, ${OPEN_REPORTS} FROM players ORDER BY created_at DESC LIMIT ?`).bind(LIST_MAX).all<PlayerRow>()
    return results.map(adminPlayer)
  }
  const like = `%${query.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const { results } = await db
    .prepare(
      `SELECT *, ${OPEN_REPORTS} FROM players
       WHERE id = ? OR provider_id = ? OR name_key LIKE ? ESCAPE '\\' OR lower(suggested_name) LIKE ? ESCAPE '\\'
       ORDER BY name IS NULL, name_key LIMIT ?`,
    )
    .bind(query, query, like, like, LIST_MAX)
    .all<PlayerRow>()
  return results.map(adminPlayer)
}

const logAction = (db: Db, admin: string, action: string, player: string | null, run: string | null, detail: string | null, now: Date) =>
  db
    .prepare('INSERT INTO admin_actions (id, action, target_player_id, target_run_id, detail, created_at, admin) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), action, player, run, detail, now.toISOString(), admin)

async function withPlayer<T>(db: Db, id: string, act: (p: PlayerRow) => Promise<Result<T>>): Promise<Result<{ player: AdminPlayer } & T>> {
  const p = await getPlayer(db, id)
  if (!p) return fail(404, 'No such player.')
  const result = await act(p)
  if (!result.ok) return result
  const after = await db.prepare(`SELECT *, ${OPEN_REPORTS} FROM players WHERE id = ?`).bind(id).first<PlayerRow>()
  return { ...result, player: adminPlayer(after!) }
}

export { PLAYER_ACTIONS }
export type { PlayerAction }

/**
 * Something the admin does to a player:
 * - rename: to a name that meets the usual rules, at any time. It counts as a
 *   change of name, so the player waits a week before changing it again.
 * - hide / show: take them off the leaderboards, or put them back. Separate
 *   from the player's own "hide me", which can't undo it.
 * - signout: sign them out on every device.
 */
export function actOnPlayer(db: Db, admin: string, id: string, action: PlayerAction, body: unknown, now: Date) {
  return withPlayer(db, id, async (p): Promise<Result> => {
    switch (action) {
      case 'rename': {
        const raw = (body as { name?: unknown } | null)?.name
        if (typeof raw !== 'string') return fail(400, 'Send a name.')
        const name = tidyName(raw)
        const problem = nameProblem(name)
        if (problem) return fail(400, problem)
        if (name === p.name) return { ok: true }
        try {
          await db.batch([
            db.prepare('UPDATE players SET name = ?, name_key = ?, name_changed_at = ? WHERE id = ?').bind(name, nameKey(name), now.toISOString(), p.id),
            logAction(db, admin, 'rename', p.id, null, JSON.stringify({ from: p.name, to: name }), now),
          ])
        } catch (err) {
          if (/UNIQUE/i.test(String(err))) return fail(409, 'Another player has that name.')
          throw err
        }
        return { ok: true }
      }
      case 'hide':
      case 'show': {
        const value = action === 'hide' ? 1 : 0
        if (p.moderator_hidden === value) return { ok: true }
        await db.batch([db.prepare('UPDATE players SET moderator_hidden = ? WHERE id = ?').bind(value, p.id), logAction(db, admin, action, p.id, null, null, now)])
        return { ok: true }
      }
      case 'signout':
        await db.batch([
          db.prepare('UPDATE players SET session_version = session_version + 1 WHERE id = ?').bind(p.id),
          logAction(db, admin, 'signout', p.id, null, null, now),
        ])
        return { ok: true }
    }
  })
}

/**
 * Takes a run off the boards: its best rows and its log go. Where it was the
 * player's overall best, their next best (from another typing-aid
 * combination) takes its place, so they stay on the board with a run that
 * still stands.
 */
export async function removeRun(db: Db, admin: string, runId: string, body: unknown, now: Date): Promise<Result<{ removed: number }>> {
  const playerId = (body as { player?: unknown } | null)?.player
  if (typeof playerId !== 'string' || !playerId) return fail(400, 'Say whose run it is.')
  const removal = await runRemoval(db, runId, playerId)
  if (!removal) return fail(404, 'That run isn’t on the boards.')
  await db.batch([...removal.writes, logAction(db, admin, 'remove-run', removal.player, runId, JSON.stringify({ fingerprint: removal.fingerprint }), now)])
  return { ok: true, removed: removal.rows }
}

/** Runs on the boards, by run id, for the report queue. Looked up through the reported players, so only their rows are read. */
async function runInfos(db: Db, runs: { player: string; run: string }[]): Promise<Map<string, RunInfo>> {
  if (!runs.length) return new Map()
  const players = [...new Set(runs.map((r) => r.player))]
  const runIds = [...new Set(runs.map((r) => r.run))]
  const { results } = await db
    .prepare(
      `SELECT b.run_id, max(b.wpm) AS wpm, max(b.accuracy) AS accuracy, b.run_aids, b.finished_at, v.language, v.name, max(l.run_id IS NOT NULL) AS has_log
       FROM bests b JOIN snippet_versions v ON v.fingerprint = b.fingerprint LEFT JOIN logs l ON l.run_id = b.run_id
       WHERE b.player_id IN (${players.map(() => '?').join(', ')}) AND b.run_id IN (${runIds.map(() => '?').join(', ')}) GROUP BY b.run_id`,
    )
    .bind(...players, ...runIds)
    .all<{ run_id: string; wpm: number; accuracy: number; run_aids: string; finished_at: string; language: string; name: string; has_log: number }>()
  return new Map(
    results.map((r) => [r.run_id, { language: r.language, snippet: r.name, wpm: r.wpm, accuracy: r.accuracy, aids: r.run_aids, finishedAt: r.finished_at, hasLog: r.has_log === 1 }]),
  )
}

interface ReportRow {
  id: string
  target_player_id: string
  target_run_id: string | null
  reason: Reason
  note: string | null
  status: string
  created_at: string
  reporter_name: string | null
  source: string
}

/**
 * The report queue: reports gathered by what they're about (a player, or one
 * of their runs). Open ones most-reported first; closed ones newest first.
 */
export async function reportQueue(db: Db, status: 'open' | 'closed'): Promise<ReportGroup[]> {
  const where = status === 'open' ? "status = 'open'" : "status != 'open'"
  const { results: groups } = await db
    .prepare(
      `SELECT target_player_id AS player, target_run_id AS run, count(*) AS count, max(created_at) AS latest
       FROM reports WHERE ${where} GROUP BY target_player_id, target_run_id
       ORDER BY ${status === 'open' ? 'count DESC, ' : ''}latest DESC LIMIT ?`,
    )
    .bind(LIST_MAX)
    .all<{ player: string; run: string | null; count: number; latest: string }>()
  if (!groups.length) return []
  const ids = [...new Set(groups.map((g) => g.player))]
  const marks = ids.map(() => '?').join(', ')
  const [{ results: rows }, { results: players }] = await Promise.all([
    db
      .prepare(
        `SELECT r.*, p.name AS reporter_name FROM reports r LEFT JOIN players p ON p.id = r.reporter_id
         WHERE r.${where} AND r.target_player_id IN (${marks}) ORDER BY r.created_at DESC`,
      )
      .bind(...ids)
      .all<ReportRow>(),
    db.prepare(`SELECT *, ${OPEN_REPORTS} FROM players WHERE id IN (${marks})`).bind(...ids).all<PlayerRow>(),
  ])
  const byId = new Map(players.map((p) => [p.id, adminPlayer(p)]))
  const runs = await runInfos(
    db,
    groups.filter((g): g is typeof g & { run: string } => !!g.run).map((g) => ({ player: g.player, run: g.run })),
  )
  return groups.map((g) => ({
    player: byId.get(g.player) ?? null,
    run: g.run,
    runInfo: g.run ? (runs.get(g.run) ?? null) : null,
    count: g.count,
    latest: g.latest,
    reports: rows
      .filter((r) => r.target_player_id === g.player && r.target_run_id === g.run)
      .map((r) => ({ id: r.id, reason: r.reason, note: r.note, status: r.status, createdAt: r.created_at, reporter: r.reporter_name, automatic: r.source === 'auto' })),
  }))
}

/** Closes every open report about a player (or one of their runs): dealt with, or nothing to do. */
export async function closeReports(db: Db, admin: string, body: unknown, now: Date): Promise<Result<{ closed: number }>> {
  const b = (body ?? {}) as { player?: unknown; run?: unknown; status?: unknown }
  if (typeof b.player !== 'string' || (b.run != null && typeof b.run !== 'string')) return fail(400, 'Say which reports.')
  if (b.status !== 'resolved' && b.status !== 'dismissed') return fail(400, 'Resolve or dismiss.')
  const run = typeof b.run === 'string' ? b.run : null
  const [update] = (await db.batch([
    db.prepare("UPDATE reports SET status = ? WHERE status = 'open' AND target_player_id = ? AND target_run_id IS ?").bind(b.status, b.player, run),
    logAction(db, admin, b.status === 'resolved' ? 'resolve-reports' : 'dismiss-reports', b.player, run, null, now),
  ])) as { meta: { changes: number } }[]
  return { ok: true, closed: update.meta.changes }
}

/** The action log, newest first, a page at a time. */
export async function actionLog(db: Db, before: string | null): Promise<AdminAction[]> {
  const { results } = await db
    .prepare(
      `SELECT a.*, p.name AS player_name FROM admin_actions a LEFT JOIN players p ON p.id = a.target_player_id
       WHERE ? IS NULL OR a.created_at < ? ORDER BY a.created_at DESC LIMIT ?`,
    )
    .bind(before, before, LIST_MAX)
    .all<{ id: string; action: string; target_player_id: string | null; player_name: string | null; target_run_id: string | null; detail: string | null; admin: string | null; created_at: string }>()
  return results.map((a) => ({
    id: a.id,
    action: a.action,
    player: a.target_player_id,
    playerName: a.player_name,
    run: a.target_run_id,
    detail: a.detail,
    admin: a.admin,
    createdAt: a.created_at,
  }))
}
