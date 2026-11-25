import { describe, expect, it } from 'vitest'
import { backspace, caretPosition, counts, createRun, isFinished, typeChar, type Run } from './engine'
import { summarize } from './stats'
import { SNIPPETS, parseSnippets } from '../data/snippets'
import { tokenize } from './tokenize'

const typeAll = (run: Run, text: string) => [...text].reduce(typeChar, run)

describe('engine', () => {
  const code = 'if (a) {\n  go();\n}'

  it('skips indentation after Enter when auto-indent is on', () => {
    const run = typeAll(createRun(code, true), 'if (a) {\n')
    expect(run.chars[run.pos]).toBe('g')
    expect(run.states.slice(9, 11)).toEqual(['auto', 'auto'])
  })

  it('makes you type indentation when auto-indent is off', () => {
    const run = typeAll(createRun(code, false), 'if (a) {\n')
    expect(run.chars[run.pos]).toBe(' ')
  })

  it('finishes a clean run with 100% accuracy and no auto chars counted', () => {
    const run = typeAll(createRun(code, true), 'if (a) {\ngo();\n}')
    expect(isFinished(run)).toBe(true)
    expect(counts(run)).toEqual({ correct: code.length - 2, incorrect: 0 })
    const r = summarize(run, 6, [])
    expect(r.accuracy).toBe(100)
    expect(r.wpm).toBeCloseTo((code.length - 2) / 5 / 0.1)
  })

  it('records mistakes against the expected key, including symbols', () => {
    const run = typeAll(createRun('a;', true), 'a:')
    expect(run.states).toEqual(['ok', 'bad'])
    expect(run.missed).toEqual({ ';': 1 })
    expect(run.symbolTotal).toBe(1)
    expect(run.symbolCorrect).toBe(0)
  })

  it('backspace from the start of an indented line goes back over the indent and newline', () => {
    let run = typeAll(createRun(code, true), 'if (a) {\n')
    run = backspace(run)
    expect(run.pos).toBe(8)
    expect(run.states[9]).toBeUndefined()
  })

  it('backspace keeps keystroke history, so corrections still cost accuracy', () => {
    let run = typeAll(createRun('ab', true), 'x')
    run = backspace(run)
    run = typeAll(run, 'ab')
    expect(counts(run)).toEqual({ correct: 2, incorrect: 0 })
    expect(run.keystrokes).toBe(3)
  })

  it('ctrl+backspace deletes the current word', () => {
    let run = typeAll(createRun('const value = 1', true), 'const valu')
    run = backspace(run, true)
    expect(run.pos).toBe(6)
  })

  it('reports line and column', () => {
    const run = typeAll(createRun(code, true), 'if (a) {\ngo')
    expect(caretPosition(run)).toEqual({ line: 2, col: 5 })
  })
})

describe('snippets', () => {
  it('parses every snippet with a name and code', () => {
    expect(SNIPPETS.length).toBeGreaterThan(20)
    for (const s of SNIPPETS) {
      expect(s.name).toMatch(/\.js$/)
      expect(s.code).not.toMatch(/\t|[ ]+$/m)
    }
  })

  it('buckets by length', () => {
    const [s] = parseSnippets('=== a.js\nconst a = 1;\n')
    expect(s).toEqual({ name: 'a.js', code: 'const a = 1;', length: 'short' })
  })
})

describe('tokenize', () => {
  it('colours keywords, strings, calls and numbers', () => {
    const code = 'const s = fn("x", 2);'
    const cls = tokenize(code)
    expect(cls[0]).toBe('kw')
    expect(cls[code.indexOf('fn')]).toBe('fn')
    expect(cls[code.indexOf('"')]).toBe('str')
    expect(cls[code.indexOf('2')]).toBe('num')
  })
})
