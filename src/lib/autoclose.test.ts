import { describe, expect, it } from 'vitest'
import { backspace, counts, createRun, isFinished, move, typeChar, type Run } from './engine'
import { computePairs } from './pairs'
import { getLanguage } from '../languages'

const js = getLanguage('javascript')
const start = (code: string, autoIndent = true) =>
  createRun(code, { autoIndent, autoClose: true, pairs: computePairs(code, js) })
const typeAll = (run: Run, text: string) => [...text].reduce(typeChar, run)
const pendingText = (run: Run) => run.chars.filter((_, i) => run.states[i] === 'pending').join('')

describe('computePairs', () => {
  it('matches nested brackets', () => {
    const code = 'f(a[0], { b })'
    const { closeOf } = computePairs(code, js)
    expect(closeOf[1]).toBe(code.length - 1)
    expect(closeOf[3]).toBe(5)
    expect(closeOf[8]).toBe(12)
  })

  it('pairs quotes from string tokens and keeps brackets in strings separate', () => {
    const code = 'f(")", x)'
    const { closeOf } = computePairs(code, js)
    expect(closeOf[1]).toBe(code.length - 1)
    expect(closeOf[2]).toBe(4)
  })

  it('pairs braces inside template literals', () => {
    const code = 'const s = `${a}`;'
    const { closeOf, allowed } = computePairs(code, js)
    const open = code.indexOf('{')
    expect(closeOf[open]).toBe(code.indexOf('}'))
    expect(allowed[open]).toBe(true)
  })

  it("follows VS Code's notIn rules and the word-character rule for quotes", () => {
    const code = "const s = `it's`; x = a'b'"
    const { closeOf, allowed } = computePairs(code, js)
    // ' inside a template string: VS Code says notIn string.
    expect(closeOf[code.indexOf("'")]).toBe(-1)
    // A quote right after a word character never auto-closes.
    const afterWord = code.lastIndexOf("a'") + 1
    expect(closeOf[afterWord]).toBeGreaterThan(-1)
    expect(allowed[afterWord]).toBe(false)
  })

  it('ignores unbalanced closers', () => {
    const { closeOf } = computePairs('a) (b', js)
    expect(closeOf.every((c) => c === -1)).toBe(true)
  })
})

describe('auto-close like VS Code', () => {
  it('inserts the closer when the opener is typed', () => {
    const run = typeAll(start('foo(a);'), 'foo(')
    expect(pendingText(run)).toBe(')')
  })

  it('typing the closer overtypes it and counts as typed', () => {
    const run = typeAll(start('foo(a);'), 'foo(a);')
    expect(isFinished(run)).toBe(true)
    expect(counts(run)).toMatchObject({ correct: 7, incorrect: 0 })
  })

  it('→ and End move past auto-inserted closers without counting them', () => {
    let run = typeAll(start('f(g(1));'), 'f(g(1')
    expect(pendingText(run)).toBe('))')
    run = move(run, 'right')
    expect(run.states[5]).toBe('skipped')
    run = typeAll(typeChar(typeAll(start('f(g(1));'), 'f(g(1'), ')'), '')
    run = move(run, 'end')
    expect(run.chars[run.pos]).toBe(';')
    expect(counts(run).correct).toBe(6)
  })

  it('does not auto-close when the opener was mistyped', () => {
    const run = typeAll(start('foo(a);'), 'foo9')
    expect(pendingText(run)).toBe('')
  })

  it("only auto-closes before whitespace or one of VS Code's autoCloseBefore characters", () => {
    // Inside "a(b)", the pending closing quote follows the caret, so "(" is not auto-closed.
    const run = typeAll(start('x = "a(b)";'), 'x = "a(')
    expect(pendingText(run)).toBe('"')
  })

  it('auto-closes quotes and lets you type over them', () => {
    let run = typeAll(start('f("hi")'), 'f("')
    expect(pendingText(run)).toBe('")')
    run = typeAll(run, 'hi")')
    expect(isFinished(run)).toBe(true)
  })

  it('Enter between braces moves the closer to its own line, and ↓ moves past it', () => {
    const code = 'if (a) {\n  go();\n}'
    let run = typeAll(start(code), 'if (a) {\n')
    expect(pendingText(run)).toBe('\n}')
    run = typeAll(run, 'go();')
    expect(run.chars[run.pos]).toBe('\n')
    run = move(run, 'down')
    expect(isFinished(run)).toBe(true)
    expect(counts(run).incorrect).toBe(0)
  })

  it('↓ lands at the same column, leaving further closers to type or skip', () => {
    const code = 'f(() => {\n  go();\n});'
    let run = typeAll(start(code), 'f(() => {\ngo();')
    expect(pendingText(run)).toBe('\n})')
    run = move(run, 'down')
    // Column 7 on "  go();" is past the end of "})", so the caret lands at the end of the line.
    expect(run.chars[run.pos]).toBe(';')
  })

  it('Enter at an auto-inserted line break is a mistake, as VS Code would add a blank line', () => {
    let run = typeAll(start('if (a) {\n  go();\n}'), 'if (a) {\ngo();')
    run = typeChar(run, '\n')
    expect(counts(run).incorrect).toBe(1)
  })

  it('Backspace on an opener removes its auto-inserted closer', () => {
    let run = typeAll(start('foo(a);'), 'foo(')
    run = backspace(run)
    expect(pendingText(run)).toBe('')
    run = typeAll(run, '(')
    expect(pendingText(run)).toBe(')')
  })

  it('deleting an overtyped closer means it has to be typed again', () => {
    let run = typeAll(start('f(x);'), 'f(x)')
    run = backspace(run)
    expect(run.states[3]).toBeUndefined()
    expect(pendingText(run)).toBe('')
  })

  it('without auto-indent, Enter does not expand but the closer can still be typed over', () => {
    const code = 'if (a) {\n  go();\n}'
    const run = typeAll(start(code, false), code)
    expect(isFinished(run)).toBe(true)
    expect(counts(run).incorrect).toBe(0)
  })
})
