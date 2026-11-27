import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '../languages'
import { play } from '../test/harness'
import { encodeLog, resultOf } from './runcore'
import { replay as replayRun } from './runlog'
import { buildReplay, CHECKPOINT_EVERY, frameAt, type Frame } from './replay'
import { replayLog } from './runcore'
import { computePairs } from './pairs'

const lang = LANGUAGES.find((l) => l.id === 'typescript')!
const snippet = lang.snippets.find((s) => s.length === 'medium')!
const aids = { autoIndent: true, autoClose: true, autocomplete: true }
const original = play(lang, snippet, { acceptSuggestions: true, service: true, typist: { seed: 4, typos: 0.04 } })
const log = encodeLog(original.log)
const r = buildReplay(lang, snippet, aids, log)

describe('replay timeline', () => {
  it('starts untyped and ends on exactly the finished run', () => {
    expect(r.frame(0).run.pos).toBe(0)
    const last = r.frame(r.times.length - 1).run
    const replayed = replayRun(lang, snippet, aids, log).run
    expect(last.typed).toEqual(replayed.typed)
    expect(last.states).toEqual(replayed.states)
  })

  it('lasts as long as the typing time, with the pause cut out', () => {
    // The harness typist pauses for 3 s halfway; the timeline doesn't include it.
    expect(r.duration / 1000).toBeCloseTo(resultOf(original).seconds, 2)
  })

  it('moves forward in time, one frame per change', () => {
    expect(r.times.length).toBeGreaterThan(2 * CHECKPOINT_EVERY)
    for (let i = 1; i < r.times.length; i++) {
      expect(r.times[i]).toBeGreaterThanOrEqual(r.times[i - 1])
      const prev = r.frame(i - 1).run
      expect(r.frame(i).run).not.toEqual(prev)
    }
  })

  it('shows the same run at every change, whether played through, jumped to or stepped back to', () => {
    // The run after each change, from a single straight replay of the log.
    const pairs = computePairs(snippet.code, lang)
    const truth = (index: number) => {
      let count = 0
      let found: Frame['run'] | null = index === 0 ? replayLog(snippet, aids, pairs, []).run : null
      const entries = log.slice()
      for (let n = 1; n <= entries.length && !found; n++) {
        const st = replayLog(snippet, aids, pairs, entries.slice(0, n))
        const last = entries[n - 1][0]
        if (last === 't' || last === 'p' || last === 'r') continue
        const before = replayLog(snippet, aids, pairs, entries.slice(0, n - 1)).run
        if (JSON.stringify(st.run.states) !== JSON.stringify(before.states) || st.run.pos !== before.pos || JSON.stringify(st.run.typed) !== JSON.stringify(before.typed)) count++
        if (count === index) found = st.run
      }
      return found!
    }
    const n = r.times.length
    // Forward, a jump ahead, back to the start, and back to just after a snapshot.
    for (const index of [1, 2, CHECKPOINT_EVERY + 3, n - 1, 0, CHECKPOINT_EVERY - 1, CHECKPOINT_EVERY, Math.floor(n / 2)]) {
      const run = r.frame(index).run
      const expected = truth(index)
      expect(run.pos, `change ${index}`).toBe(expected.pos)
      expect(run.typed, `change ${index}`).toEqual(expected.typed)
      expect(run.states, `change ${index}`).toEqual(expected.states)
    }
  })

  it('finds the frame showing at any moment, as the same object while it doesn’t change', () => {
    expect(frameAt(r, -5).index).toBe(0)
    expect(frameAt(r, r.duration + 1000).index).toBe(r.times.length - 1)
    const mid = Math.floor(r.times.length / 2)
    expect(frameAt(r, r.times[mid] + 0.5).t).toBe(r.times[mid])
    expect(frameAt(r, r.times[mid] + 0.5)).toBe(frameAt(r, r.times[mid] + 0.6))
  })
})
