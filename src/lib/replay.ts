/**
 * A run's replay: the run as it was after each change in its log, on a
 * timeline that starts at the first key and skips the time the page was paused,
 * so playback never sits frozen while the player was away.
 *
 * It doesn't keep a copy of the run for every change (each is a few arrays as
 * long as the snippet: 10–20 MB on the longest). It keeps the log, a snapshot
 * every CHECKPOINT_EVERY changes, and the one it showed last: playback steps
 * forward from there, and a jump starts from the nearest snapshot, rebuilding
 * at most that many changes through the same reducer that made them.
 */
import { decodeLog, type LogEntry, type TypingAids } from './runcore'
import { init, reducer, type LoggedAction, type TestState } from './typing'
import { computePairs } from './pairs'
import type { Run } from './engine'
import type { Language, Snippet } from '../languages/types'

export const CHECKPOINT_EVERY = 64

export interface Frame {
  /** Which change this is: 0 is the untyped snippet. */
  index: number
  /** Milliseconds since the first key, pauses removed. */
  t: number
  run: Run
}

export interface Replay {
  /** When each change happens on the timeline (ms); times[0] is 0, the untyped snippet. */
  times: number[]
  /** Length of the timeline, in ms. */
  duration: number
  /** The frame for change `index`. The same object while the index stays the same. */
  frame(index: number): Frame
}

export function buildReplay(lang: Language, snippet: Snippet, aids: TypingAids, log: LogEntry[]): Replay {
  const options = { autoIndent: aids.autoIndent, autoClose: aids.autoClose, pairs: aids.autoClose ? computePairs(snippet.code, lang) : undefined, suggest: null }
  const actions: LoggedAction[] = decodeLog(log)
  let s: TestState = init(snippet, options, 0)
  const times = [0]
  /** The last action applied to reach each change (-1: none, the untyped snippet). */
  const actionAt = [-1]
  const checkpoints: TestState[] = [s]
  let lastRun = s.run
  let start: number | null = null
  let pausedAt: number | null = null
  let paused = 0
  actions.forEach((a, i) => {
    s = reducer(s, a)
    if (a.type === 'pause') pausedAt = a.now
    else if (a.type === 'resume' && pausedAt !== null) {
      paused += a.now - pausedAt
      pausedAt = null
    }
    if (a.type === 'tick' || a.type === 'pause' || a.type === 'resume') return
    start ??= a.now
    // Only changes, at their moment on the timeline.
    if (s.run === lastRun) return
    lastRun = s.run
    times.push(a.now - start - paused)
    actionAt.push(i)
    if ((times.length - 1) % CHECKPOINT_EVERY === 0) checkpoints.push(s)
  })

  let shown: { index: number; state: TestState; frame: Frame } | null = null
  const frame = (index: number): Frame => {
    const k = Math.max(0, Math.min(times.length - 1, index))
    if (shown?.index === k) return shown.frame
    // Step forward from what's showing, or from the nearest snapshot before k, whichever is closer.
    const base = Math.floor(k / CHECKPOINT_EVERY) * CHECKPOINT_EVERY
    const from = shown && shown.index < k && shown.index >= base ? shown : { index: base, state: checkpoints[base / CHECKPOINT_EVERY] }
    let state = from.state
    for (let i = actionAt[from.index] + 1; i <= actionAt[k]; i++) state = reducer(state, actions[i])
    shown = { index: k, state, frame: { index: k, t: times[k], run: state.run } }
    return shown.frame
  }
  return { times, duration: times[times.length - 1], frame }
}

/** The frame showing at time `t`: the last change at or before it. */
export function frameAt(replay: Replay, t: number): Frame {
  const { times } = replay
  let lo = 0
  let hi = times.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (times[mid] <= t) lo = mid
    else hi = mid - 1
  }
  return replay.frame(lo)
}
