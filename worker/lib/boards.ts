/**
 * Reading the leaderboards (docs/leaderboard.md, "Leaderboards").
 *
 * A board is one snippet version (fingerprint) and one typing-aid filter:
 * 'any' (each player's overall best) or a combination such as '110'. Boards
 * show visible players only, fastest first; ties go to higher accuracy, then
 * whoever got there first. Each read touches few rows: a language's overview
 * reads one top row per snippet, and a board reads its top 15 through the
 * bests_board index. The Worker caches both for 60 seconds (worker/index.ts).
 */
import type { Db } from './db'
import { AHEAD, ORDER, VISIBLE } from './sql'
import type { Assets } from './runs'
import { SNIPPET_DATA_PATH, type SnippetIndexEntry } from '../../src/lib/snippetfiles'
import type { SnippetLength } from '../../src/languages/types'
import type { Board, BoardReplay, BoardRow, LanguageBoards } from '../../src/lib/apiTypes'

export type { BoardRow }

export const BOARD_SIZE = 15
/** How long boards are cached at the edge, in seconds. */
export const BOARD_CACHE_SECONDS = 60

export const validAids = (aids: string | null): string => (aids && /^(any|[01]{3})$/.test(aids) ? aids : 'any')

let indexCache: { at: number; entries: SnippetIndexEntry[] } | null = null
/** The snippets the game offers today (the build's index), kept a minute. */
export async function currentSnippets(assets: Assets, now: number): Promise<SnippetIndexEntry[]> {
  if (indexCache && now - indexCache.at < 60_000) return indexCache.entries
  const res = await assets(`${SNIPPET_DATA_PATH}/index.json`)
  const entries = res.ok ? ((await res.json()) as SnippetIndexEntry[]) : []
  indexCache = { at: now, entries }
  return entries
}

interface RowData {
  player_id: string
  name: string
  wpm: number
  accuracy: number
  run_aids: string
  finished_at: string
  run_id: string
  has_log: number
}
const toRow = (r: RowData, rank: number): BoardRow => ({
  rank,
  player: { id: r.player_id, name: r.name },
  wpm: r.wpm,
  accuracy: r.accuracy,
  aids: r.run_aids,
  finishedAt: r.finished_at,
  runId: r.run_id,
  hasLog: r.has_log === 1,
})
const ROW_COLUMNS = 'b.player_id, p.name, b.wpm, b.accuracy, b.run_aids, b.finished_at, b.run_id, (l.run_id IS NOT NULL) AS has_log'

/** A language's boards: each current snippet's top score, and its older snippet versions that have scores. */
export async function languageBoards(db: Db, assets: Assets, language: string, now: number): Promise<LanguageBoards> {
  const current = (await currentSnippets(assets, now)).filter((s) => s.language === language)
  const tops = current.length
    ? ((await db.batch(
        current.map((s) =>
          db
            .prepare(`SELECT p.name, b.wpm FROM bests b JOIN players p ON p.id = b.player_id WHERE b.fingerprint = ? AND b.aids = 'any' AND ${VISIBLE} ORDER BY ${ORDER} LIMIT 1`)
            .bind(s.fingerprint),
        ),
      )) as { results: { name: string; wpm: number }[] }[])
    : []
  const currentSet = new Set(current.map((s) => s.fingerprint))
  const { results: versions } = await db
    .prepare('SELECT fingerprint, name, length, first_seen_at FROM snippet_versions WHERE language = ? ORDER BY name, first_seen_at DESC')
    .bind(language)
    .all<{ fingerprint: string; name: string; length: SnippetLength; first_seen_at: string }>()
  return {
    language,
    snippets: current.map((s, i) => ({ fingerprint: s.fingerprint, name: s.name, length: s.length, top: tops[i]?.results[0] ?? null })),
    archived: versions.filter((v) => !currentSet.has(v.fingerprint)).map((v) => ({ fingerprint: v.fingerprint, name: v.name, length: v.length, since: v.first_seen_at })),
  }
}

/** One board: the snippet, and its top 15 for an aid filter. */
export async function board(db: Db, assets: Assets, fingerprint: string, aids: string, now: number): Promise<Board | null> {
  if (!/^[0-9a-f]{64}$/.test(fingerprint)) return null
  const live = (await currentSnippets(assets, now)).find((s) => s.fingerprint === fingerprint)
  const version = live
    ? null
    : await db.prepare('SELECT language, name, length, code FROM snippet_versions WHERE fingerprint = ?').bind(fingerprint).first<{ language: string; name: string; length: SnippetLength; code: string }>()
  if (!live && !version) return null
  const { results } = await db
    .prepare(
      `SELECT ${ROW_COLUMNS} FROM bests b JOIN players p ON p.id = b.player_id LEFT JOIN logs l ON l.run_id = b.run_id
       WHERE b.fingerprint = ? AND b.aids = ? AND ${VISIBLE} ORDER BY ${ORDER} LIMIT ?`,
    )
    .bind(fingerprint, aids, BOARD_SIZE)
    .all<RowData>()
  return {
    snippet: live
      ? { fingerprint, language: live.language, name: live.name, length: live.length, current: true }
      : // An archived board keeps the text it was typed on, for its replays.
        { fingerprint, language: version!.language, name: version!.name, length: version!.length, current: false, code: version!.code },
    aids,
    rows: results.map((r, i) => toRow(r, i + 1)),
  }
}

/** The player's own place on a board, wherever it is ("You: #57"). */
export async function myPlace(db: Db, playerId: string, fingerprint: string, aids: string): Promise<BoardRow | null> {
  const mine = await db
    .prepare(
      `SELECT ${ROW_COLUMNS} FROM bests b JOIN players p ON p.id = b.player_id LEFT JOIN logs l ON l.run_id = b.run_id
       WHERE b.player_id = ? AND b.fingerprint = ? AND b.aids = ?`,
    )
    .bind(playerId, fingerprint, aids)
    .first<RowData>()
  if (!mine) return null
  const ahead = await db
    .prepare(
      `SELECT count(*) AS n FROM bests b JOIN players p ON p.id = b.player_id
       WHERE b.fingerprint = ? AND b.aids = ? AND b.wpm >= ? AND b.player_id != ? AND ${VISIBLE}
         AND ${AHEAD}`,
    )
    // wpm >= mine.wpm adds nothing to the condition, but lets the board index read only the rows ahead.
    .bind(fingerprint, aids, mine.wpm, playerId, mine.wpm, mine.wpm, mine.accuracy, mine.accuracy, mine.finished_at)
    .first<{ n: number }>()
  return toRow(mine, (ahead?.n ?? 0) + 1)
}

/**
 * A kept run, for its replay: the log, the text it was typed on, and who typed
 * it. Public replays are of runs on the boards by visible players; the admin
 * can watch any kept run.
 */
/** A kept run with its log still compressed, as stored; the route unpacks it. */
export async function runForReplay(db: Db, runId: string, opts: { admin: boolean }): Promise<(Omit<BoardReplay, 'log'> & { log: ArrayBuffer }) | null> {
  const row = await db
    .prepare(
      `SELECT l.log, b.player_id, p.name, b.wpm, b.accuracy, b.run_aids, b.finished_at, b.fingerprint, v.language, v.name AS snippet, v.length, v.code
       FROM logs l
       -- By the primary key: a kept log always belongs to its player's overall ('any') best on that snippet.
       JOIN bests b ON b.player_id = l.player_id AND b.fingerprint = l.fingerprint AND b.aids = 'any' AND b.run_id = l.run_id
       JOIN players p ON p.id = b.player_id
       JOIN snippet_versions v ON v.fingerprint = b.fingerprint
       WHERE l.run_id = ? ${opts.admin ? '' : `AND ${VISIBLE}`}
       LIMIT 1`,
    )
    .bind(runId)
    .first<{
      log: ArrayBuffer
      player_id: string
      name: string
      wpm: number
      accuracy: number
      run_aids: string
      finished_at: string
      fingerprint: string
      language: string
      snippet: string
      length: SnippetLength
      code: string
    }>()
  if (!row) return null
  return {
    runId,
    player: { id: row.player_id, name: row.name },
    wpm: row.wpm,
    accuracy: row.accuracy,
    aids: row.run_aids,
    finishedAt: row.finished_at,
    snippet: { fingerprint: row.fingerprint, language: row.language, name: row.snippet, length: row.length, code: row.code },
    log: row.log,
  }
}

/**
 * The writes that take one of a player's runs off the boards: its best rows
 * and its log go, and if it was their overall best, their best with other
 * typing aids takes its place. Null if it isn't one of their runs on the
 * boards. Looked up by player (the primary key's first column), so it reads
 * only that player's rows, never the whole table.
 */
export async function runRemoval(db: Db, runId: string, playerId: string) {
  const rows = (await db.prepare('SELECT player_id, fingerprint, aids FROM bests WHERE player_id = ? AND run_id = ?').bind(playerId, runId).all<{ player_id: string; fingerprint: string; aids: string }>()).results
  if (!rows.length) return null
  const { player_id: player, fingerprint } = rows[0]
  const writes = [
    db.prepare('DELETE FROM bests WHERE player_id = ? AND fingerprint = ? AND run_id = ?').bind(player, fingerprint, runId),
    db.prepare('DELETE FROM logs WHERE run_id = ?').bind(runId),
  ]
  if (rows.some((r) => r.aids === 'any')) {
    writes.push(
      db
        .prepare(
          `INSERT INTO bests (player_id, fingerprint, aids, language, run_id, wpm, raw_wpm, accuracy, seconds, run_aids, finished_at)
           SELECT player_id, fingerprint, 'any', language, run_id, wpm, raw_wpm, accuracy, seconds, run_aids, finished_at
           FROM bests b WHERE b.player_id = ? AND b.fingerprint = ? AND b.aids != 'any' AND b.run_id != ?
           ORDER BY ${ORDER} LIMIT 1`,
        )
        .bind(player, fingerprint, runId),
    )
  }
  return { player, fingerprint, rows: rows.length, writes }
}
