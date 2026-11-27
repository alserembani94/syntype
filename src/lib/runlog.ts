/**
 * Run records and keystroke logs (docs/leaderboard.md).
 *
 * A finished run becomes a RunRecord: which snippet (and a fingerprint of its
 * exact text), the typing aids, the result, and a compact log of everything
 * that changed the run. Replaying the log through the same reducer, with
 * suggestions off, rebuilds the run and its result: that is how the personal
 * board replays runs, and how the server checks submitted ones. An accepted
 * suggestion is logged as the text it inserted, so a replay never needs the
 * suggestion engine (which would cost ~40x more CPU on the server).
 *
 * The log format and replay are in runcore.ts, which the server shares.
 */
import { type TestState } from './typing'
import { computePairs } from './pairs'
import { encodeLog, fingerprint, replayLog, resultOf, type LogEntry, type TypingAids } from './runcore'
import type { Language, Snippet, SnippetLength } from '../languages/types'

export interface RunRecord {
  /** Unique per run. */
  id: string
  language: string
  snippet: string
  /** SHA-256 of the snippet's code: a new fingerprint means a new board. */
  fingerprint: string
  length: SnippetLength
  aids: TypingAids
  wpm: number
  rawWpm: number
  accuracy: number
  /** Null for runs too short to measure. */
  consistency: number | null
  /** Typing time, pauses excluded. */
  seconds: number
  /** When the run finished, as an ISO date. */
  finishedAt: string
  log: LogEntry[]
}

/** The state a run's log leads to, typed into `snippet` with the given aids and no suggestions. */
export function replay(lang: Language, snippet: Snippet, aids: TypingAids, log: LogEntry[]): TestState {
  return replayLog(snippet, aids, aids.autoClose ? computePairs(snippet.code, lang) : undefined, log)
}

/** A unique run id: a UUID where the browser offers one (secure pages), random hex otherwise. */
const runId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')

/** The record of a finished run. */
export async function recordRun(lang: Language, s: TestState, aids: TypingAids, finishedAt = new Date()): Promise<RunRecord> {
  if (s.phase !== 'done') throw new Error('Only a finished run can be recorded')
  const r = resultOf(s)
  return {
    id: runId(),
    language: lang.id,
    snippet: s.snippet.name,
    fingerprint: await fingerprint(s.snippet.code),
    length: s.snippet.length,
    aids,
    wpm: r.wpm,
    rawWpm: r.rawWpm,
    accuracy: r.accuracy,
    consistency: r.consistency,
    seconds: r.seconds,
    finishedAt: finishedAt.toISOString(),
    log: encodeLog(s.log),
  }
}
