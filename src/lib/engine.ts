/**
 * Pure typing engine. Every function returns a new Run; nothing here knows
 * about React, the DOM or the clock.
 */

/** ok/bad = typed by the user; auto = indentation skipped for them. */
export type CharState = 'ok' | 'bad' | 'auto' | undefined

export interface Run {
  chars: string[]
  states: CharState[]
  pos: number
  autoIndent: boolean
  keystrokes: number
  correctKeystrokes: number
  symbolTotal: number
  symbolCorrect: number
  /** Expected character -> how many times the user typed something else. */
  missed: Record<string, number>
}

const isSymbol = (ch: string) => /[^\w\s]/.test(ch)
const isWordChar = (ch: string) => /[\w$]/.test(ch)

export function createRun(code: string, autoIndent: boolean): Run {
  const chars = [...code]
  const run: Run = {
    chars,
    states: new Array(chars.length).fill(undefined),
    pos: 0,
    autoIndent,
    keystrokes: 0,
    correctKeystrokes: 0,
    symbolTotal: 0,
    symbolCorrect: 0,
    missed: {},
  }
  skipIndent(run)
  return run
}

export const isFinished = (run: Run) => run.pos >= run.chars.length

/** Mutates a freshly-copied run: marks leading spaces of the current line as auto. */
function skipIndent(run: Run) {
  if (!run.autoIndent) return
  const { chars, states } = run
  if (run.pos > 0 && chars[run.pos - 1] !== '\n') return
  while (run.pos < chars.length && chars[run.pos] === ' ') {
    states[run.pos] = 'auto'
    run.pos++
  }
}

const copy = (run: Run): Run => ({ ...run, states: run.states.slice(), missed: { ...run.missed } })

export function typeChar(prev: Run, ch: string): Run {
  if (isFinished(prev)) return prev
  const run = copy(prev)
  const expected = run.chars[run.pos]
  const good = ch === expected
  run.keystrokes++
  if (good) run.correctKeystrokes++
  else run.missed[expected] = (run.missed[expected] ?? 0) + 1
  if (isSymbol(expected)) {
    run.symbolTotal++
    if (good) run.symbolCorrect++
  }
  run.states[run.pos] = good ? 'ok' : 'bad'
  run.pos++
  if (expected === '\n') skipIndent(run)
  return run
}

/** Backspace; with `word`, deletes back to the start of the current word (Ctrl+Backspace). */
export function backspace(prev: Run, word = false): Run {
  if (prev.pos === 0) return prev
  const run = copy(prev)
  const step = () => {
    while (run.pos > 0 && run.states[run.pos - 1] === 'auto') run.states[--run.pos] = undefined
    if (run.pos > 0) run.states[--run.pos] = undefined
  }
  step()
  if (word) {
    while (run.pos > 0 && isWordChar(run.chars[run.pos - 1]) && run.states[run.pos - 1] !== 'auto') step()
  }
  // Never leave the caret inside indentation that auto-indent would skip.
  skipIndent(run)
  return run
}

export function counts(run: Run) {
  let correct = 0
  let incorrect = 0
  for (const s of run.states) {
    if (s === 'ok') correct++
    else if (s === 'bad') incorrect++
  }
  return { correct, incorrect }
}

/** Line (1-based) and column (1-based) of the caret. */
export function caretPosition(run: Run) {
  const p = Math.min(run.pos, run.chars.length - 1)
  let line = 1
  let col = 1
  for (let i = 0; i < p; i++) {
    if (run.chars[i] === '\n') {
      line++
      col = 1
    } else col++
  }
  return { line, col }
}
