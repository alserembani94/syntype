/**
 * The parts of run logs that the server shares with the game: the log format,
 * encoding and decoding, and replaying a log into a run and its result.
 * Nothing here needs the language definitions (src/languages), so the Worker
 * can use it; src/lib/runlog.ts adds the rest.
 */
import { activeSeconds, init, reducer, type LoggedAction, type TestState } from './typing'
import { summarize, type Result } from './stats'
import type { Move } from './engine'
import type { Pairs } from './pairs'
import type { Snippet } from '../languages/types'

/**
 * One log entry: a code, its data, then the time in whole milliseconds since
 * the previous entry.
 *   ['k', ch, dt]           typed a character
 *   ['b', 0 | 1, dt]        backspace (1: a whole word)
 *   ['m', dir, dt]          moved past an auto-closed character (right, end, down)
 *   ['a', start, text, dt]  accepted a suggestion: text inserted from start
 *   ['p', dt] ['r', dt]     paused and resumed (the page lost or got focus)
 *   ['t', dt]               the once-a-second sample behind the chart and consistency
 */
export type LogEntry =
  | ['k', string, number]
  | ['b', 0 | 1, number]
  | ['m', Move, number]
  | ['a', number, string, number]
  | ['p', number]
  | ['r', number]
  | ['t', number]

export interface TypingAids {
  autoIndent: boolean
  autoClose: boolean
  autocomplete: boolean
}

/**
 * Times are rounded once, relative to the first entry, and then turned into
 * gaps, so rounding never adds up along the log (under 1 ms off in total).
 */
export function encodeLog(actions: LoggedAction[]): LogEntry[] {
  if (!actions.length) return []
  const t0 = actions[0].now
  let prev = 0
  return actions.map((a) => {
    const at = Math.round(a.now - t0)
    const dt = at - prev
    prev = at
    switch (a.type) {
      case 'key':
        return ['k', a.ch, dt]
      case 'back':
        return ['b', a.word ? 1 : 0, dt]
      case 'move':
        return ['m', a.dir, dt]
      case 'insert':
        return ['a', a.start, a.text, dt]
      case 'pause':
        return ['p', dt]
      case 'resume':
        return ['r', dt]
      case 'tick':
        return ['t', dt]
    }
  })
}

export function decodeLog(log: LogEntry[]): LoggedAction[] {
  let now = 0
  return log.map((e): LoggedAction => {
    now += e[e.length - 1] as number
    switch (e[0]) {
      case 'k':
        return { type: 'key', ch: e[1], now }
      case 'b':
        return { type: 'back', word: e[1] === 1, now }
      case 'm':
        return { type: 'move', dir: e[1], now }
      case 'a':
        return { type: 'insert', start: e[1], text: e[2], now }
      case 'p':
        return { type: 'pause', now }
      case 'r':
        return { type: 'resume', now }
      case 't':
        return { type: 'tick', now }
    }
  })
}

/**
 * The state a run's log leads to, typed into `snippet` with the given aids and
 * no suggestions. `pairs` (computePairs for the snippet's language) is needed
 * when auto-close is on.
 */
export function replayLog(snippet: Snippet, aids: TypingAids, pairs: Pairs | undefined, log: LogEntry[]): TestState {
  const options = { autoIndent: aids.autoIndent, autoClose: aids.autoClose, pairs: aids.autoClose ? pairs : undefined, suggest: null }
  let s = init(snippet, options, 0)
  for (const a of decodeLog(log)) s = reducer(s, a)
  return s
}

/** A finished run's result, as the results screen shows it. */
export const resultOf = (s: TestState): Result =>
  summarize(s.run, activeSeconds(s, s.finishedAt), s.samples, s.pausedMs / 1000)

/** SHA-256 of a snippet's code, as hex. */
export async function fingerprint(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
