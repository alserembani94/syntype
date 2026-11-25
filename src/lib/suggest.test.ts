import { describe, expect, it } from 'vitest'
import { acceptCompletion, counts, createRun, typeChar, type Run } from './engine'
import { buildSuggestConfig, canSuggestAt, fuzzyMatch, getSuggestions, wordStart } from './suggest'
import { summarize } from './stats'
import { getLanguage } from '../languages'

const js = getLanguage('javascript')
const typeAll = (run: Run, text: string) => [...text].reduce(typeChar, run)
const setup = (code: string) => ({
  run: createRun(code, { autoIndent: true, autoClose: false }),
  cfg: buildSuggestConfig(code, js),
})
const labels = (run: Run, cfg: ReturnType<typeof setup>['cfg']) =>
  getSuggestions(run, wordStart(run, cfg), cfg).map((s) => s.label)

describe('fuzzyMatch', () => {
  it('matches prefixes and camelCase humps, like VS Code', () => {
    expect(fuzzyMatch('use', 'useCallback')?.matches).toEqual([0, 1, 2])
    expect(fuzzyMatch('uC', 'useCallback')?.matches).toEqual([0, 3])
    expect(fuzzyMatch('ucb', 'useCallback')).not.toBeNull()
  })

  it('requires the first letter at a word start or hump', () => {
    expect(fuzzyMatch('ec', 'useCallback')).toBeNull()
    expect(fuzzyMatch('st', 'useState')).not.toBeNull()
  })

  it('ranks a straight prefix above a scattered match', () => {
    const a = fuzzyMatch('con', 'const')!.score
    const b = fuzzyMatch('con', 'clearTimeoutNow')?.score ?? -1
    expect(a).toBeGreaterThan(b)
  })
})

describe('suggestions', () => {
  it('offers keywords as soon as a word starts', () => {
    const { run, cfg } = setup('const a = 1;')
    expect(labels(typeAll(run, 'co'), cfg)[0]).toBe('const')
  })

  it('offers words typed earlier in the snippet, but not ones not typed yet', () => {
    const code = 'const total = 1;\nlet totally = total + values;'
    const { run, cfg } = setup(code)
    const r = typeAll(run, 'const total = 1;\nlet to')
    expect(labels(r, cfg)).toContain('total')
    expect(labels(r, cfg)).not.toContain('values')
  })

  it("leaves out the word being typed and numbers, as VS Code's word-based list does", () => {
    const { run, cfg } = setup('let x = 100;\nlet abc = abc;')
    const r = typeAll(run, 'let x = 100;\nlet abc')
    expect(labels(r, cfg)).not.toContain('abc')
    expect(labels(r, cfg)).not.toContain('100')
  })

  it('keeps a keyword even when it is fully typed, so Enter accepts it like VS Code', () => {
    const { run, cfg } = setup('return x;')
    expect(labels(typeAll(run, 'return'), cfg)).toContain('return')
  })

  it('stays quiet inside strings and comments', () => {
    const { run, cfg } = setup('const s = "hello"; // note')
    let r = typeAll(run, 'const s = "he')
    expect(canSuggestAt(cfg, wordStart(r, cfg))).toBe(false)
    r = typeAll(r, 'llo"; // no')
    expect(canSuggestAt(cfg, wordStart(r, cfg))).toBe(false)
  })

  it('has no word to complete right after a symbol', () => {
    const { run, cfg } = setup('f(x);')
    expect(wordStart(typeAll(run, 'f('), cfg)).toBe(-1)
  })
})

describe('accepting a suggestion', () => {
  it('replaces the typed prefix, counts one keystroke, and marks the rest as suggested', () => {
    const { run } = setup('const value = 1;')
    let r = typeAll(run, 'co')
    r = acceptCompletion(r, 0, 'const')
    expect(r.pos).toBe(5)
    expect(r.keystrokes).toBe(3)
    expect(r.completed.slice(0, 5)).toEqual([false, false, true, true, true])
    expect(counts(r)).toMatchObject({ correct: 2, suggested: 3, incorrect: 0 })
  })

  it('checks a wrong suggestion letter by letter, like typing', () => {
    const { run } = setup('useCallback(f);')
    let r = typeAll(run, 'use')
    r = acceptCompletion(r, 0, 'useState')
    expect(counts(r).incorrect).toBeGreaterThan(0)
    expect(r.correctKeystrokes).toBe(3)
  })

  it('never runs past the end of the line', () => {
    const { run } = setup('let a\nb')
    const r = acceptCompletion(typeAll(run, 'let a'), 4, 'abcdef')
    expect(r.pos).toBe(5)
  })

  it('reports typing speed, code speed and keys saved separately', () => {
    const { run } = setup('const a;')
    let r = typeAll(run, 'co')
    r = acceptCompletion(r, 0, 'const')
    r = typeAll(r, ' a;')
    const res = summarize(r, 6, [])
    // Typed: "co" + " a;" = 5 chars; on screen: 8 chars.
    expect(res.wpm).toBeCloseTo(5 / 5 / 0.1)
    expect(res.codeWpm).toBeCloseTo(8 / 5 / 0.1)
    expect(res.keysSaved).toBe(2)
  })
})
