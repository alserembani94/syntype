/**
 * Submitting runs (docs/leaderboard.md, "Submitting a run").
 *
 * 1. When a signed-in player starts a snippet, the game asks for a run token:
 *    signed, naming the player, the snippet's fingerprint and the server's time.
 * 2. When they finish, it sends the token, the keystroke log, the typing aids,
 *    the result it worked out and a Turnstile token.
 * 3. The token must be genuine, unused and recent; Turnstile must pass; the
 *    log must replay into the snippet and that result, at a human pace
 *    (runcheck.ts), and take no longer than had passed since the token.
 * 4. If it's the player's best (overall, or for its typing aids) the best is
 *    replaced; if it's in a board's top 20, its log is kept, and logs pushed
 *    out of the top 20 are deleted.
 */
import type { Db } from './db'
import { randomToken, sign, verify } from './crypto'
import { checkRun, REJECTIONS, type Claim, type Rejection } from './runcheck'
import type { PlayerRow } from './players'
import { SNIPPET_DATA_PATH, type SnippetFile } from '../../src/lib/snippetfiles'
import type { LogEntry, TypingAids } from '../../src/lib/runcore'

/** Reads one of the site's static files (the Worker's ASSETS binding). */
export type Assets = (path: string) => Promise<Response>

export interface RunConfig {
  SESSION_SECRET: string
  TURNSTILE_SECRET_KEY: string
}

/** A token is good for this long after the run starts. */
export const TOKEN_HOURS = 2
/** How long after finishing a run can still be submitted (a dropped connection can retry). */
export const SUBMIT_WITHIN_MS = 10 * 60_000
/** Allowance for the time between the first key and the token request reaching the server. */
const START_SLACK_MS = 5_000
/** Boards keep logs for their top 20. */
export const LOGS_KEPT = 20
/** The largest submission accepted, in bytes. */
export const MAX_BODY = 256 * 1024

interface RunToken {
  k: 'run'
  id: string
  p: string
  f: string
  t: number
  exp: number
}

// ——— Snippets ———

const snippetCache = new Map<string, SnippetFile | null>()
const FINGERPRINT = /^[0-9a-f]{64}$/

/** The snippet with this fingerprint, if the game offers it today. */
export async function snippetFor(assets: Assets, fingerprint: string): Promise<SnippetFile | null> {
  if (!FINGERPRINT.test(fingerprint)) return null
  if (snippetCache.has(fingerprint)) return snippetCache.get(fingerprint)!
  const res = await assets(`${SNIPPET_DATA_PATH}/${fingerprint}.json`)
  const file = res.ok ? ((await res.json()) as SnippetFile) : null
  if (file?.fingerprint !== fingerprint) return null
  if (snippetCache.size > 500) snippetCache.clear()
  snippetCache.set(fingerprint, file)
  return file
}

// ——— Starting ———

export async function startRun(config: RunConfig, assets: Assets, player: PlayerRow, body: unknown, now: Date) {
  const fingerprint = (body as { fingerprint?: unknown } | null)?.fingerprint
  if (typeof fingerprint !== 'string' || !(await snippetFor(assets, fingerprint))) return { ok: false as const, status: 404, error: 'That snippet isn’t on the leaderboards.' }
  const t = now.getTime()
  const token = await sign(config.SESSION_SECRET, { k: 'run', id: randomToken(16), p: player.id, f: fingerprint, t, exp: t + TOKEN_HOURS * 3_600_000 } satisfies RunToken)
  return { ok: true as const, token }
}

// ——— Submitting ———

export type SubmitRejection = Rejection | 'expired' | 'used' | 'snippet-changed' | 'turnstile' | 'too-soon' | 'too-late'

const SUBMIT_REJECTIONS: Record<Exclude<SubmitRejection, Rejection>, string> = {
  expired: 'The run took too long to submit. Play it again to submit it.',
  used: 'This run was already submitted.',
  'snippet-changed': 'This snippet has changed since you started it.',
  turnstile: 'The check that you’re a person didn’t pass.',
  'too-soon': 'The run is longer than the time since you started it.',
  'too-late': 'Runs have to be submitted within 10 minutes of finishing.',
}
export const rejectionMessage = (r: SubmitRejection) => (r in REJECTIONS ? REJECTIONS[r as Rejection] : SUBMIT_REJECTIONS[r as Exclude<SubmitRejection, Rejection>])

export interface Submitted {
  runId: string
  wpm: number
  rawWpm: number
  accuracy: number
  seconds: number
  /** A new best on the snippet's board. */
  best: boolean
  /** A new best for this combination of typing aids. */
  bestForAids: boolean
  /** The player's place on the board (their best, which may be an earlier run). */
  rank: number
}

export type SubmitResult = { ok: true; run: Submitted } | { ok: false; status: number; reason: SubmitRejection | 'bad-request'; error: string }

const reject = (reason: SubmitRejection, status = 422): SubmitResult => ({ ok: false, status, reason, error: rejectionMessage(reason) })

/** '110': auto-indent, auto-close, autocomplete. */
export const aidsKey = (a: TypingAids) => `${+a.autoIndent}${+a.autoClose}${+a.autocomplete}`

async function turnstilePasses(fetchImpl: (input: string, init?: RequestInit) => Promise<Response>, secret: string, token: unknown, ip: string | null, key: string) {
  if (typeof token !== 'string' || !token || token.length > 4096) return false
  try {
    const res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip ?? undefined, idempotency_key: key }),
    })
    const result = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (!result.success) console.warn('Turnstile:', result['error-codes'])
    return result.success === true
  } catch (err) {
    console.warn('Turnstile unreachable:', err instanceof Error ? err.message : err)
    return false
  }
}

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function gunzip(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

/** Players who show on boards (and the player asking, wherever they are). */
const VISIBLE = '(p.hidden = 0 AND p.moderator_hidden = 0 OR p.id = ?)'
/** Rows ahead of a score on a board: faster, or as fast and more accurate, or the same and earlier. */
const AHEAD = '(b.wpm > ? OR (b.wpm = ? AND (b.accuracy > ? OR (b.accuracy = ? AND b.finished_at < ?))))'

interface Deps {
  db: Db
  config: RunConfig
  assets: Assets
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  ip: string | null
}

export async function submitRun(deps: Deps, player: PlayerRow, body: unknown, now: Date): Promise<SubmitResult> {
  const { db, config } = deps
  const b = (body ?? {}) as { token?: unknown; aids?: unknown; log?: unknown; result?: unknown; turnstile?: unknown }
  const bad = (error: string): SubmitResult => ({ ok: false, status: 400, reason: 'bad-request', error })
  if (!player.name) return { ok: false, status: 403, reason: 'bad-request', error: 'Choose your leaderboard name first.' }

  const a = b.aids as Partial<TypingAids> | undefined
  if (!a || typeof a.autoIndent !== 'boolean' || typeof a.autoClose !== 'boolean' || typeof a.autocomplete !== 'boolean') return bad('Send the typing aids.')
  const aids: TypingAids = { autoIndent: a.autoIndent, autoClose: a.autoClose, autocomplete: a.autocomplete }
  const claim = b.result as Claim | undefined
  if (!claim || typeof claim !== 'object') return bad('Send the result.')

  // The token: genuine, this player's, unused, and recent.
  const t = now.getTime()
  const token = typeof b.token === 'string' ? await verify<RunToken>(config.SESSION_SECRET, b.token, t) : null
  if (!token) return reject('expired')
  if (token.k !== 'run' || token.p !== player.id) return bad('That run token isn’t yours.')
  if (await db.prepare('SELECT 1 AS used FROM used_run_tokens WHERE id = ?').bind(token.id).first()) return reject('used', 409)
  const snippet = await snippetFor(deps.assets, token.f)
  if (!snippet) return reject('snippet-changed', 410)

  // A person, then the run itself.
  if (!(await turnstilePasses(deps.fetch, config.TURNSTILE_SECRET_KEY, b.turnstile, deps.ip, token.id))) return reject('turnstile', 403)
  const checked = checkRun(snippet, aids, b.log, claim)
  if (!checked.ok) return reject(checked.reason)
  const run = checked.run
  // The run began after the token was asked for, and finished at most 10 minutes ago.
  const sinceStart = t - token.t
  if (run.durationMs > sinceStart + START_SLACK_MS) return reject('too-soon')
  if (sinceStart - run.durationMs > SUBMIT_WITHIN_MS + START_SLACK_MS) return reject('too-late')

  const at = now.toISOString()
  const runId = token.id
  const key = aidsKey(aids)
  const upsert = (rowAids: string) =>
    db
      .prepare(
        `INSERT INTO bests (player_id, fingerprint, aids, language, run_id, wpm, raw_wpm, accuracy, seconds, run_aids, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (player_id, fingerprint, aids) DO UPDATE SET
           run_id = excluded.run_id, wpm = excluded.wpm, raw_wpm = excluded.raw_wpm, accuracy = excluded.accuracy,
           seconds = excluded.seconds, run_aids = excluded.run_aids, finished_at = excluded.finished_at
         WHERE excluded.wpm > bests.wpm OR (excluded.wpm = bests.wpm AND excluded.accuracy > bests.accuracy)`,
      )
      .bind(player.id, snippet.fingerprint, rowAids, snippet.language, runId, run.wpm, run.rawWpm, run.accuracy, run.seconds, key, at)
  // The previous best's run, whose log goes if this one replaces it.
  const previous = await db.prepare("SELECT run_id FROM bests WHERE player_id = ? AND fingerprint = ? AND aids = 'any'").bind(player.id, snippet.fingerprint).first<{ run_id: string }>()
  let results: { meta: { changes: number } }[]
  try {
    results = (await db.batch([
      // Marks the token used; a second submission of it fails here, in the same transaction.
      db.prepare('INSERT INTO used_run_tokens (id, used_at) VALUES (?, ?)').bind(token.id, at),
      db
        .prepare('INSERT OR IGNORE INTO snippet_versions (fingerprint, language, name, length, code, first_seen_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(snippet.fingerprint, snippet.language, snippet.name, snippet.length, snippet.code, at),
      upsert(key),
      upsert('any'),
    ])) as { meta: { changes: number } }[]
  } catch (err) {
    if (/UNIQUE/i.test(String(err))) return reject('used', 409)
    throw err
  }
  const bestForAids = results[2].meta.changes > 0
  const best = results[3].meta.changes > 0

  // The player's place, with the best that now stands.
  const mine = (await db
    .prepare("SELECT run_id, wpm, accuracy, finished_at FROM bests WHERE player_id = ? AND fingerprint = ? AND aids = 'any'")
    .bind(player.id, snippet.fingerprint)
    .first<{ run_id: string; wpm: number; accuracy: number; finished_at: string }>())!
  const ahead = await db
    .prepare(`SELECT count(*) AS n FROM bests b JOIN players p ON p.id = b.player_id WHERE b.fingerprint = ? AND b.aids = 'any' AND b.player_id != ? AND ${VISIBLE} AND ${AHEAD}`)
    .bind(snippet.fingerprint, player.id, player.id, mine.wpm, mine.wpm, mine.accuracy, mine.accuracy, mine.finished_at)
    .first<{ n: number }>()
  const rank = (ahead?.n ?? 0) + 1

  if (best) {
    const writes = []
    if (previous && previous.run_id !== runId) writes.push(db.prepare('DELETE FROM logs WHERE run_id = ?').bind(previous.run_id))
    if (rank <= LOGS_KEPT) {
      writes.push(
        db.prepare('INSERT INTO logs (run_id, player_id, fingerprint, log, created_at) VALUES (?, ?, ?, ?, ?)').bind(runId, player.id, snippet.fingerprint, await gzip(JSON.stringify(b.log as LogEntry[])), at),
        // The run pushed out of the top 20 loses its log.
        db
          .prepare(
            `DELETE FROM logs WHERE fingerprint = ? AND run_id NOT IN (
               SELECT b.run_id FROM bests b JOIN players p ON p.id = b.player_id
               WHERE b.fingerprint = ? AND b.aids = 'any' AND p.hidden = 0 AND p.moderator_hidden = 0
               ORDER BY b.wpm DESC, b.accuracy DESC, b.finished_at LIMIT ?)`,
          )
          .bind(snippet.fingerprint, snippet.fingerprint, LOGS_KEPT),
      )
    }
    if (writes.length) await db.batch(writes)
  }
  // Now and then, forget tokens too old to be used again.
  if (Math.random() < 0.02) await db.prepare('DELETE FROM used_run_tokens WHERE used_at < ?').bind(new Date(t - 86_400_000).toISOString()).run()

  return { ok: true, run: { runId, wpm: run.wpm, rawWpm: run.rawWpm, accuracy: run.accuracy, seconds: run.seconds, best, bestForAids, rank } }
}
