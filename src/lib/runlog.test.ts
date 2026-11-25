/**
 * Run logs: replaying a recorded log, with suggestions off, must rebuild the
 * same run and result for every snippet. The server will rely on this to
 * check submitted runs (docs/leaderboard.md), so it's checked for every
 * snippet of every language, with and without each typing aid.
 */
import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '../languages'
import { hasService, play, type Aids } from '../test/harness'
import { decodeLog, encodeLog, fingerprint, recordRun, replay, resultOf } from './runlog'
import type { TestState } from './typing'

const snippets = LANGUAGES.flatMap((lang) => lang.snippets.map((s) => [`${lang.id}/${s.name}`, lang, s] as const))

/** The parts of a run and its result that a replay must reproduce exactly. */
function expectSameRun(replayed: TestState, original: TestState) {
  expect(replayed.phase).toBe('done')
  expect(replayed.run.typed).toEqual(original.run.typed)
  expect(replayed.run.states).toEqual(original.run.states)
  expect(replayed.run.completed).toEqual(original.run.completed)
  expect(replayed.run.keystrokes).toBe(original.run.keystrokes)
  expect(replayed.run.correctKeystrokes).toBe(original.run.correctKeystrokes)
  const a = resultOf(replayed)
  const b = resultOf(original)
  expect(a.correct).toBe(b.correct)
  expect(a.incorrect).toBe(b.incorrect)
  expect(a.accuracy).toBe(b.accuracy)
  expect(a.consistency === null).toBe(b.consistency === null)
  // Times are stored to the millisecond: under 1 ms off over the whole run.
  expect(Math.abs(a.seconds - b.seconds)).toBeLessThan(0.001)
  expect(Math.abs(a.wpm - b.wpm) / b.wpm).toBeLessThan(0.001)
  expect(replayed.samples.length).toBe(original.samples.length)
}

describe('replaying a run log rebuilds the run', () => {
  it.each(snippets)('%s, accepting suggestions with every aid on, with typos and a pause', (_, lang, s) => {
    const original = play(lang, s, { acceptSuggestions: true, service: hasService(lang), typist: { seed: 11, typos: 0.03 } })
    expect(original.phase).toBe('done')
    const aids = { autoIndent: true, autoClose: true, autocomplete: true }
    expectSameRun(replay(lang, s, aids, encodeLog(original.log)), original)
  })

  const variations: [string, Aids][] = [
    ['no auto-indent', { autoIndent: false, autoClose: true, autocomplete: true }],
    ['no auto-close', { autoIndent: true, autoClose: false, autocomplete: true }],
    ['no autocomplete', { autoIndent: true, autoClose: true, autocomplete: false }],
    ['no aids at all', { autoIndent: false, autoClose: false, autocomplete: false }],
  ]
  // One language of each kind is enough here; the full matrix runs above with every aid on.
  const sample = snippets.filter(([, lang]) => ['typescript', 'python', 'go', 'cobol', 'brainfuck'].includes(lang.id))
  describe.each(variations)('with %s', (_, aids) => {
    it.each(sample)('%s', (_, lang, s) => {
      const original = play(lang, s, { acceptSuggestions: aids.autocomplete, service: hasService(lang), aids, typist: { seed: 5, typos: 0.03 } })
      expect(original.phase).toBe('done')
      expectSameRun(replay(lang, s, aids, encodeLog(original.log)), original)
    })
  })
})

describe('the log format', () => {
  const lang = LANGUAGES.find((l) => l.id === 'javascript')!
  const s = lang.snippets.find((x) => x.length === 'long')!
  const original = play(lang, s, { acceptSuggestions: true, service: true, typist: { seed: 3, typos: 0.05 } })
  const log = encodeLog(original.log)

  it('uses every kind of entry a run produces, and survives JSON', () => {
    const kinds = new Set(log.map((e) => e[0]))
    for (const k of ['k', 'b', 'a', 'p', 'r', 't']) expect(kinds, k).toContain(k)
    expect(JSON.parse(JSON.stringify(log))).toEqual(log)
  })

  it('stores times as whole milliseconds that add up to the original times', () => {
    const bad = log.filter((e) => !Number.isInteger(e[e.length - 1]) || (e[e.length - 1] as number) < 0)
    expect(bad).toEqual([])
    const decoded = decodeLog(log)
    const t0 = original.log[0].now
    decoded.forEach((a, i) => expect(Math.abs(a.now - (original.log[i].now - t0))).toBeLessThanOrEqual(0.5))
  })

  it('records an accepted suggestion as the text it inserted', () => {
    const inserts = original.log.filter((a) => a.type === 'insert')
    expect(inserts.length).toBeGreaterThan(0)
    for (const a of inserts) expect(s.code.slice(a.start).startsWith(a.text)).toBe(true)
  })

  it('logs nothing for keys that change nothing (after the run, or Backspace at the start)', () => {
    expect(play(lang, s, { acceptSuggestions: false, service: false }).log.every((a) => a.type !== 'back')).toBe(true)
  })
})

describe('run records', () => {
  const lang = LANGUAGES.find((l) => l.id === 'python')!
  const s = lang.snippets[0]

  it('fingerprints a snippet by its exact text', async () => {
    const a = await fingerprint(s.code)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await fingerprint(s.code)).toBe(a)
    expect(await fingerprint(s.code + ' ')).not.toBe(a)
  })

  it('records a finished run with its result, aids and log', async () => {
    const end = play(lang, s, { acceptSuggestions: true, service: false, typist: { seed: 9, typos: 0.02 } })
    const aids = { autoIndent: true, autoClose: true, autocomplete: true }
    const r = await recordRun(lang, end, aids, new Date('2026-11-25T12:00:00Z'))
    expect(r).toMatchObject({ language: 'python', snippet: s.name, length: s.length, aids, finishedAt: '2026-11-25T12:00:00.000Z' })
    expect(r.wpm).toBeCloseTo(resultOf(end).wpm, 6)
    expect(r.fingerprint).toBe(await fingerprint(s.code))
    expectSameRun(replay(lang, s, aids, r.log), end)
  })

  it('refuses a run that has not finished', async () => {
    const unfinished = { ...play(lang, s, { acceptSuggestions: false, service: false }), phase: 'running' as const }
    await expect(recordRun(lang, unfinished, { autoIndent: true, autoClose: true, autocomplete: true })).rejects.toThrow()
  })
})
