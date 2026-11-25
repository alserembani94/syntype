/**
 * The server's check of a submitted run, on every snippet of every language:
 * honest runs (as the game records them) pass, and forged or inhuman ones
 * don't. Uses the build's snippet data files, as the Worker does.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { LANGUAGES } from '../../src/languages'
import { honestRun } from '../../src/test/harness'
import { replayLog, resultOf, type LogEntry, type TypingAids } from '../../src/lib/runcore'
import { snippetFiles, type SnippetFile } from '../../src/lib/snippetfiles'
import { checkRun, humanProblem, type Claim } from './runcheck'

const ON: TypingAids = { autoIndent: true, autoClose: true, autocomplete: true }
const OFF: TypingAids = { autoIndent: false, autoClose: false, autocomplete: false }
const snippets = LANGUAGES.flatMap((lang) => lang.snippets.map((s) => [`${lang.id}/${s.name}`, lang, s] as const))

let files: Map<string, SnippetFile>
beforeAll(async () => {
  files = new Map((await snippetFiles(LANGUAGES)).map((f) => [`${f.language}/${f.name}`, f]))
})

/** A run as the game would submit it. */
function honest(key: string, aids: TypingAids, seed = 7) {
  const [, lang, s] = snippets.find(([k]) => k === key)!
  const run = honestRun(lang, s, aids, { seed })
  return { log: run.log, claim: run.result as Claim }
}

describe('honest runs pass', () => {
  it.each(snippets)('%s', (key) => {
    for (const aids of [ON, OFF]) {
      const { log, claim } = honest(key, aids)
      const checked = checkRun(files.get(key)!, aids, log, claim)
      expect(checked, JSON.stringify(aids)).toMatchObject({ ok: true })
      if (checked.ok) expect(Math.abs(checked.run.wpm - claim.wpm)).toBeLessThan(0.01)
    }
  })
})

describe('forged runs fail', () => {
  const key = 'javascript/debounce.js'
  const fileOf = () => files.get(key) ?? [...files.values()].find((f) => f.language === 'javascript' && f.length === 'medium')!

  it('a log that is not the game’s shape', () => {
    const { claim } = honest(fileOf().language + '/' + fileOf().name, OFF)
    for (const bad of [null, [], 'kkk', [['x', 1]], [['k', 'ab', 5]], [['k', 'é', 5]], [['k', 'a', -5]], [['b', 2, 5]], [['m', 'up', 5]]]) {
      expect(checkRun(fileOf(), OFF, bad, claim)).toEqual({ ok: false, reason: 'invalid-log' })
    }
  })

  it('a suggestion accepted with autocomplete off, or one spanning lines', () => {
    const f = fileOf()
    const { log, claim } = honest(`${f.language}/${f.name}`, OFF)
    const withInsert: LogEntry[] = [['a', 0, 'const', 5], ...log]
    expect(checkRun(f, OFF, withInsert, claim)).toEqual({ ok: false, reason: 'invalid-log' })
    expect(checkRun(f, ON, [['a', 0, f.code, 5]], claim)).toEqual({ ok: false, reason: 'invalid-log' })
  })

  it('keystrokes that don’t finish the snippet, or a result they don’t give', () => {
    const f = fileOf()
    const { log, claim } = honest(`${f.language}/${f.name}`, OFF)
    expect(checkRun(f, OFF, log.slice(0, -5), claim)).toEqual({ ok: false, reason: 'not-finished' })
    expect(checkRun(f, OFF, log, { ...claim, wpm: claim.wpm + 20 })).toEqual({ ok: false, reason: 'result-mismatch' })
    expect(checkRun(f, OFF, log, { ...claim, accuracy: 100, wpm: claim.wpm })).toMatchObject(claim.accuracy > 99 ? { ok: true } : { ok: false, reason: 'result-mismatch' })
  })

  it('a log for another snippet', () => {
    const f = fileOf()
    const other = [...files.values()].find((x) => x.language === 'python' && x.length === f.length)!
    const { log, claim } = honest(`${other.language}/${other.name}`, OFF)
    expect(checkRun(f, OFF, log, claim)).toMatchObject({ ok: false })
  })

  it('under 75% accuracy', () => {
    const f = fileOf()
    // Each character preceded by a wrong key fixed with backspace: 50% accuracy.
    const log: LogEntry[] = []
    for (const ch of f.code) log.push(['k', ch === 'x' ? 'y' : 'x', 60 + (log.length % 7) * 9], ['b', 0, 70 + (log.length % 5) * 11], ['k', ch, 80 + (log.length % 3) * 13])
    const r = resultOf(replayLog({ name: f.name, code: f.code, length: f.length }, OFF, undefined, log))
    expect(r.accuracy).toBeLessThan(75)
    expect(checkRun(f, OFF, log, { wpm: r.wpm, rawWpm: r.rawWpm, accuracy: r.accuracy, seconds: r.seconds })).toEqual({ ok: false, reason: 'low-accuracy' })
  })
})

describe('inhuman typing fails', () => {
  /** Keys at the given gaps, cycling. */
  const keys = (n: number, gap: (i: number) => number): LogEntry[] => Array.from({ length: n }, (_, i) => ['k', 'a', i === 0 ? 0 : gap(i)])
  let seed = 3
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31

  it('passes human-like typing, fast and slow', () => {
    expect(humanProblem(keys(300, () => 60 + rand() * 120))).toBeNull()
    // A very fast typist: ~160 WPM with bursts.
    expect(humanProblem(keys(300, (i) => (i % 4 === 0 ? 20 : 60) + rand() * 60))).toBeNull()
    // A few rolled keys close together.
    expect(humanProblem(keys(300, (i) => (i % 10 < 3 ? 5 : 90 + rand() * 60)))).toBeNull()
  })

  it('long bursts of near-simultaneous keys', () => {
    expect(humanProblem(keys(100, (i) => (i > 40 && i < 60 ? 3 : 90 + rand() * 60)))).toBe('too-fast')
  })

  it('a sustained speed beyond about 250 WPM', () => {
    // 400 WPM: 30 ms a key, with variation.
    expect(humanProblem(keys(300, () => 20 + rand() * 20))).toBe('too-fast')
  })

  it('a machine-even rhythm', () => {
    expect(humanProblem(keys(200, () => 100))).toBe('too-even')
    expect(humanProblem(keys(200, () => 98 + rand() * 4))).toBe('too-even')
  })

  it('a pause splits the run, so the time away isn’t typing', () => {
    const log: LogEntry[] = [...keys(60, () => 80 + rand() * 60), ['p', 10], ['r', 3000], ...keys(60, () => 80 + rand() * 60)]
    expect(humanProblem(log)).toBeNull()
  })
})
