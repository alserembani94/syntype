/**
 * A run's replay: the run as it was after each action of its log, on a
 * timeline that starts at the first key and skips the time the page was paused,
 * so playback never sits frozen while the player was away.
 */
import { decodeLog, type LogEntry, type TypingAids } from './runlog'
import { init, reducer } from './typing'
import { computePairs } from './pairs'
import type { Run } from './engine'
import type { Language, Snippet } from '../languages'

export interface Frame {
  /** Milliseconds since the first key, pauses removed. */
  t: number
  run: Run
}

export interface Replay {
  frames: Frame[]
  /** Length of the timeline, in ms. */
  duration: number
}

export function buildReplay(lang: Language, snippet: Snippet, aids: TypingAids, log: LogEntry[]): Replay {
  const options = { autoIndent: aids.autoIndent, autoClose: aids.autoClose, pairs: aids.autoClose ? computePairs(snippet.code, lang) : undefined, suggest: null }
  let s = init(snippet, options, 0)
  const frames: Frame[] = [{ t: 0, run: s.run }]
  let start: number | null = null
  let pausedAt: number | null = null
  let paused = 0
  for (const a of decodeLog(log)) {
    s = reducer(s, a)
    if (a.type === 'pause') pausedAt = a.now
    else if (a.type === 'resume' && pausedAt !== null) {
      paused += a.now - pausedAt
      pausedAt = null
    }
    if (a.type === 'tick' || a.type === 'pause' || a.type === 'resume') continue
    start ??= a.now
    const t = a.now - start - paused
    // Only frames where something changed, at their moment on the timeline.
    if (s.run !== frames[frames.length - 1].run) frames.push({ t, run: s.run })
  }
  return { frames, duration: frames[frames.length - 1].t }
}

/** The frame showing at time `t`: the last one at or before it. */
export function frameAt(replay: Replay, t: number): Frame {
  const { frames } = replay
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (frames[mid].t <= t) lo = mid
    else hi = mid - 1
  }
  return frames[lo]
}
