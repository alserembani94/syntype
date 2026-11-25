/**
 * The personal board's numbers, from local history (src/lib/history.ts):
 * per-snippet stats, the summary cards, the typing-aid filter and friendly
 * dates. Pure functions, so they're tested directly (board.test.ts).
 */
import type { StoredRun } from './history'
import type { TypingAids } from './runlog'
import { MIN_ACCURACY_FOR_BEST } from './stats'
import type { SnippetLength } from '../languages'

/** Which runs to show by typing aids: any, all on, all off, or an exact combination. */
export type AidsFilter = 'any' | 'on' | 'off' | TypingAids

export function matchesAids(filter: AidsFilter, aids: TypingAids): boolean {
  if (filter === 'any') return true
  const all = [aids.autoIndent, aids.autoClose, aids.autocomplete]
  if (filter === 'on') return all.every(Boolean)
  if (filter === 'off') return all.every((a) => !a)
  return aids.autoIndent === filter.autoIndent && aids.autoClose === filter.autoClose && aids.autocomplete === filter.autocomplete
}

/** Counts towards a best: accurate enough, as personal bests on the results screen. */
export const counts = (r: StoredRun) => r.accuracy >= MIN_ACCURACY_FOR_BEST

export interface SnippetStats {
  runs: number
  /** The best accurate run, or null if none was accurate enough. */
  best: StoredRun | null
  averageWpm: number
  averageAccuracy: number
  /** WPM of the last runs, oldest first, for the trend line. */
  trend: number[]
  lastPlayed: string
}

export const TREND_RUNS = 12

/** Stats for one snippet's runs (any order). Null when there are none. */
export function snippetStats(runs: StoredRun[]): SnippetStats | null {
  if (!runs.length) return null
  const oldestFirst = [...runs].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
  const accurate = runs.filter(counts)
  const best = accurate.length ? accurate.reduce((a, b) => (b.wpm > a.wpm ? b : a)) : null
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return {
    runs: runs.length,
    best,
    averageWpm: mean(runs.map((r) => r.wpm)),
    averageAccuracy: mean(runs.map((r) => r.accuracy)),
    trend: oldestFirst.slice(-TREND_RUNS).map((r) => r.wpm),
    lastPlayed: oldestFirst[oldestFirst.length - 1].finishedAt,
  }
}

export interface Overview {
  runs: number
  languages: number
  /** Typing time, pauses excluded, in seconds. */
  seconds: number
  /** The best accurate run of the given length, any language. */
  best: StoredRun | null
  /** Average WPM of the last 10 runs, and of the 10 before them (null until there are 20). */
  last10: number | null
  previous10: number | null
}

export function overview(all: StoredRun[], length: SnippetLength): Overview {
  const newestFirst = [...all].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
  const avg = (rs: StoredRun[]) => (rs.length ? rs.reduce((a, r) => a + r.wpm, 0) / rs.length : null)
  const ofLength = all.filter((r) => r.length === length && counts(r))
  return {
    runs: all.length,
    languages: new Set(all.map((r) => r.language)).size,
    seconds: all.reduce((a, r) => a + r.seconds, 0),
    best: ofLength.length ? ofLength.reduce((a, b) => (b.wpm > a.wpm ? b : a)) : null,
    last10: avg(newestFirst.slice(0, 10)),
    previous10: newestFirst.length >= 20 ? avg(newestFirst.slice(10, 20)) : null,
  }
}
