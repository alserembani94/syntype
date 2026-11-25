import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '../languages'
import { play } from '../test/harness'
import { encodeLog, replay as replayRun, resultOf } from './runlog'
import { buildReplay, frameAt } from './replay'

const lang = LANGUAGES.find((l) => l.id === 'typescript')!
const snippet = lang.snippets.find((s) => s.length === 'medium')!
const aids = { autoIndent: true, autoClose: true, autocomplete: true }
const original = play(lang, snippet, { acceptSuggestions: true, service: true, typist: { seed: 4, typos: 0.04 } })
const log = encodeLog(original.log)
const r = buildReplay(lang, snippet, aids, log)

describe('replay timeline', () => {
  it('starts untyped and ends on exactly the finished run', () => {
    expect(r.frames[0].run.pos).toBe(0)
    const last = r.frames[r.frames.length - 1].run
    const replayed = replayRun(lang, snippet, aids, log).run
    expect(last.typed).toEqual(replayed.typed)
    expect(last.states).toEqual(replayed.states)
  })

  it('lasts as long as the typing time, with the pause cut out', () => {
    // The harness typist pauses for 3 s halfway; the timeline doesn't include it.
    expect(r.duration / 1000).toBeCloseTo(resultOf(original).seconds, 2)
  })

  it('moves forward in time, one frame per change', () => {
    for (let i = 1; i < r.frames.length; i++) {
      expect(r.frames[i].t).toBeGreaterThanOrEqual(r.frames[i - 1].t)
      expect(r.frames[i].run).not.toBe(r.frames[i - 1].run)
    }
  })

  it('finds the frame showing at any moment', () => {
    expect(frameAt(r, -5)).toBe(r.frames[0])
    expect(frameAt(r, r.duration + 1000)).toBe(r.frames[r.frames.length - 1])
    const mid = r.frames[Math.floor(r.frames.length / 2)]
    expect(frameAt(r, mid.t + 0.5).t).toBe(mid.t)
  })
})
