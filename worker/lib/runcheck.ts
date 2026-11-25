/**
 * Checks a submitted run (docs/leaderboard.md, "Submitting a run"): replays its
 * log through the game's own reducer (src/lib/typing.ts, keystrokes only, no
 * suggestion engine) against the snippet's exact text, and looks for typing no
 * person could do. Pure, so the tests can run it on every snippet.
 */
import { replayLog, resultOf, type LogEntry, type TypingAids } from '../../src/lib/runcore'
import { MIN_ACCURACY_FOR_BEST } from '../../src/lib/stats'
import { expandPairs, type SnippetFile } from '../../src/lib/snippetfiles'

/** The result a run claims (from the game's RunRecord). */
export interface Claim {
  wpm: number
  rawWpm: number
  accuracy: number
  seconds: number
}

export interface Checked {
  wpm: number
  rawWpm: number
  accuracy: number
  seconds: number
  /** Wall time from the first key to the last, pauses included, in ms. */
  durationMs: number
}

export type Rejection =
  | 'invalid-log'
  | 'too-long'
  | 'not-finished'
  | 'result-mismatch'
  | 'low-accuracy'
  | 'too-fast'
  | 'too-even'

export const REJECTIONS: Record<Rejection, string> = {
  'invalid-log': 'The run’s keystroke log isn’t valid.',
  'too-long': 'The run is too long to check.',
  'not-finished': 'The keystrokes don’t finish the snippet.',
  'result-mismatch': 'The result doesn’t match the keystrokes.',
  'low-accuracy': `Runs under ${MIN_ACCURACY_FOR_BEST}% accuracy don’t count.`,
  'too-fast': 'Some of the typing is faster than a person can type.',
  'too-even': 'The typing rhythm is too even to be a person’s.',
}

/** Limits that keep a replay within the Worker's CPU budget. */
export const MAX_RUN_MINUTES = 30
const maxEntries = (code: string) => 4 * code.length + 200 + MAX_RUN_MINUTES * 60

/** Keys closer together than this, many in a row, aren't typed by hand. */
export const FAST_GAP_MS = 15
export const FAST_RUN = 10
/** The fastest sustained typing accepted, over a window of keys. */
export const MAX_SUSTAINED_WPM = 250
export const SUSTAINED_WINDOW = 100
const MIN_SUSTAINED_WINDOW = 50
/** Gaps vary from key to key; machine rhythm barely does. */
export const MIN_RHYTHM_VARIATION = 0.08
const MIN_KEYS_FOR_RHYTHM = 40

const TYPED = /^[\x20-\x7e\n\t]$/
const MOVES = ['right', 'end', 'down']
const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 3_600_000

/** A log's shape: entries the game writes, and nothing else. */
function validLog(log: unknown, aids: TypingAids): log is LogEntry[] {
  if (!Array.isArray(log) || log.length === 0) return false
  return log.every((e) => {
    if (!Array.isArray(e)) return false
    switch (e[0]) {
      case 'k':
        return e.length === 3 && typeof e[1] === 'string' && TYPED.test(e[1]) && isCount(e[2])
      case 'b':
        return e.length === 3 && (e[1] === 0 || e[1] === 1) && isCount(e[2])
      case 'm':
        return e.length === 3 && MOVES.includes(e[1]) && isCount(e[2])
      case 'a':
        // An accepted suggestion: a word, and only with autocomplete on.
        return aids.autocomplete && e.length === 4 && isCount(e[1]) && typeof e[2] === 'string' && e[2].length > 0 && e[2].length <= 80 && !/[\n\r]/.test(e[2]) && isCount(e[3])
      case 'p':
      case 'r':
      case 't':
        return e.length === 2 && isCount(e[1])
      default:
        return false
    }
  })
}

/** When each typed key landed (ms from the start), split where the run was paused. */
function keyTimes(log: LogEntry[]): number[][] {
  const stretches: number[][] = [[]]
  let now = 0
  for (const e of log) {
    now += e[e.length - 1] as number
    if (e[0] === 'k') stretches[stretches.length - 1].push(now)
    else if (e[0] === 'p') stretches.push([])
  }
  return stretches.filter((s) => s.length > 1)
}

/** Typing no person could do: long bursts of near-simultaneous keys, or a sustained speed beyond the best typists. */
export function humanProblem(log: LogEntry[]): Rejection | null {
  const stretches = keyTimes(log)
  const gaps: number[] = []
  for (const times of stretches) {
    let fast = 0
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1]
      fast = gap < FAST_GAP_MS ? fast + 1 : 0
      if (fast >= FAST_RUN) return 'too-fast'
      if (gap < 1000) gaps.push(gap)
    }
    // Sustained speed: the fastest window of keys, in WPM (5 keys a word).
    const window = Math.min(SUSTAINED_WINDOW, times.length)
    if (window >= MIN_SUSTAINED_WINDOW) {
      for (let i = window - 1; i < times.length; i++) {
        const ms = times[i] - times[i - window + 1]
        if ((window - 1) / 5 / (ms / 60_000) > MAX_SUSTAINED_WPM) return 'too-fast'
      }
    }
  }
  if (gaps.length >= MIN_KEYS_FOR_RHYTHM) {
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
    const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length)
    if (mean > 0 && sd / mean < MIN_RHYTHM_VARIATION) return 'too-even'
  }
  return null
}

const close = (a: number, b: number, by: number) => typeof b === 'number' && Number.isFinite(b) && Math.abs(a - b) <= by

/** Replays and checks a run: its numbers as the server worked them out, or why it's rejected. */
export function checkRun(snippet: SnippetFile, aids: TypingAids, log: unknown, claim: Claim): { ok: true; run: Checked } | { ok: false; reason: Rejection } {
  if (!validLog(log, aids)) return { ok: false, reason: 'invalid-log' }
  if (log.length > maxEntries(snippet.code)) return { ok: false, reason: 'too-long' }
  const durationMs = log.reduce((t, e) => t + (e[e.length - 1] as number), 0)
  if (durationMs > MAX_RUN_MINUTES * 60_000) return { ok: false, reason: 'too-long' }

  const pairs = aids.autoClose ? expandPairs(snippet.pairs, snippet.code.length) : undefined
  const state = replayLog({ name: snippet.name, code: snippet.code, length: snippet.length }, aids, pairs, log)
  if (state.phase !== 'done') return { ok: false, reason: 'not-finished' }
  const r = resultOf(state)
  if (!close(r.wpm, claim.wpm, 1) || !close(r.rawWpm, claim.rawWpm, 1) || !close(r.accuracy, claim.accuracy, 1) || !close(r.seconds, claim.seconds, 1)) {
    return { ok: false, reason: 'result-mismatch' }
  }
  if (r.accuracy < MIN_ACCURACY_FOR_BEST) return { ok: false, reason: 'low-accuracy' }
  const human = humanProblem(log)
  if (human) return { ok: false, reason: human }
  return { ok: true, run: { wpm: r.wpm, rawWpm: r.rawWpm, accuracy: r.accuracy, seconds: r.seconds, durationMs } }
}
