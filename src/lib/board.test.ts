import { describe, expect, it } from 'vitest'
import { duration, matchesAids, overview, snippetStats, TREND_RUNS, whenPlayed } from './board'
import type { StoredRun } from './history'

const ON = { autoIndent: true, autoClose: true, autocomplete: true }
const OFF = { autoIndent: false, autoClose: false, autocomplete: false }
let n = 0
function run(over: Partial<StoredRun> = {}): StoredRun {
  n++
  return {
    id: `r${n}`,
    language: 'python',
    snippet: 'clamp.py',
    fingerprint: 'f',
    snippetKey: 'python/clamp.py/f',
    length: 'medium',
    aids: ON,
    wpm: 60,
    rawWpm: 65,
    accuracy: 95,
    consistency: 80,
    seconds: 30,
    finishedAt: new Date(Date.UTC(2026, 10, 20, 10, n)).toISOString(),
    hasLog: true,
    ...over,
  }
}

describe('typing-aid filter', () => {
  it('any, all on, all off, or an exact combination', () => {
    const mixed = { autoIndent: true, autoClose: false, autocomplete: true }
    expect(matchesAids('any', mixed)).toBe(true)
    expect(matchesAids('on', ON)).toBe(true)
    expect(matchesAids('on', mixed)).toBe(false)
    expect(matchesAids('off', OFF)).toBe(true)
    expect(matchesAids('off', mixed)).toBe(false)
    expect(matchesAids(mixed, mixed)).toBe(true)
    expect(matchesAids(mixed, ON)).toBe(false)
  })
})

describe('snippet stats', () => {
  it('best is the fastest accurate run; averages cover every run', () => {
    const fastButSloppy = run({ wpm: 120, accuracy: 60 })
    const best = run({ wpm: 80 })
    const latest = run({ wpm: 50 })
    const s = snippetStats([latest, fastButSloppy, best])!
    expect(s.best?.id).toBe(best.id)
    expect(s.runs).toBe(3)
    expect(s.averageWpm).toBeCloseTo((50 + 120 + 80) / 3)
    expect(s.lastPlayed).toBe(latest.finishedAt)
  })

  it('has no best when no run was accurate enough', () => {
    expect(snippetStats([run({ accuracy: 50 })])!.best).toBeNull()
  })

  it(`trends the last ${TREND_RUNS} runs, oldest first, whatever order they come in`, () => {
    const runs = Array.from({ length: 15 }, (_, i) => run({ wpm: i }))
    const s = snippetStats([...runs].reverse())!
    expect(s.trend).toEqual(runs.slice(-TREND_RUNS).map((r) => r.wpm))
  })

  it('is null for a snippet never played', () => {
    expect(snippetStats([])).toBeNull()
  })
})

describe('overview', () => {
  it('counts runs, languages and typing time, and finds the best of a length', () => {
    const runs = [run({ wpm: 70 }), run({ language: 'rust', wpm: 90 }), run({ length: 'long', wpm: 99 }), run({ wpm: 130, accuracy: 40 })]
    const o = overview(runs, 'medium')
    expect(o.runs).toBe(4)
    expect(o.languages).toBe(2)
    expect(o.seconds).toBe(120)
    expect(o.best?.wpm).toBe(90)
  })

  it('compares the last 10 runs with the 10 before, once there are 20', () => {
    const older = Array.from({ length: 10 }, () => run({ wpm: 50 }))
    const newer = Array.from({ length: 10 }, () => run({ wpm: 60 }))
    expect(overview(newer, 'medium')).toMatchObject({ last10: 60, previous10: null })
    expect(overview([...older, ...newer], 'medium')).toMatchObject({ last10: 60, previous10: 50 })
  })
})

describe('words for time', () => {
  it('durations', () => {
    expect(duration(45)).toBe('45s')
    expect(duration(12 * 60 + 5)).toBe('12m')
    expect(duration(102 * 60)).toBe('1h 42m')
  })

  it('when a run was played, by calendar day', () => {
    const now = new Date(2026, 10, 25, 9, 0)
    expect(whenPlayed(new Date(2026, 10, 25, 1, 0).toISOString(), now)).toBe('today')
    expect(whenPlayed(new Date(2026, 10, 24, 23, 59).toISOString(), now)).toBe('yesterday')
    expect(whenPlayed(new Date(2026, 10, 22, 12, 0).toISOString(), now)).toBe('3 days ago')
    expect(whenPlayed(new Date(2026, 10, 16, 12, 0).toISOString(), now)).toBe('last week')
    expect(whenPlayed(new Date(2026, 9, 1, 12, 0).toISOString(), now)).not.toMatch(/ago|week|day/)
  })
})
