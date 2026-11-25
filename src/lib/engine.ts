/**
 * Pure typing engine. Every function returns a new Run; nothing here knows
 * about React, the DOM or the clock.
 *
 * Auto-close follows VS Code: typing an opener inserts its closer after the
 * caret ("pending" text). Typing the closer overtypes it; → / End / ↓ move
 * past it. Enter between an opener and its pending closer moves the closer
 * down onto its own line, as VS Code does.
 */
import type { Pairs } from './pairs'

/**
 * ok/bad   typed by the user
 * auto     indentation skipped by auto-indent
 * pending  auto-inserted by auto-close, still ahead of the caret
 * skipped  auto-inserted text the caret moved past with →, End or ↓
 */
export type CharState = 'ok' | 'bad' | 'auto' | 'pending' | 'skipped' | undefined

export interface RunOptions {
  autoIndent: boolean
  autoClose: boolean
  /** Needed for auto-close; see computePairs. */
  pairs?: Pairs
}

export interface Run {
  chars: string[]
  states: CharState[]
  pos: number
  autoIndent: boolean
  /** Null when auto-close is off. */
  pairs: Pairs | null
  keystrokes: number
  correctKeystrokes: number
  symbolTotal: number
  symbolCorrect: number
  /** Expected character -> how many times the user typed something else. */
  missed: Record<string, number>
}

const isSymbol = (ch: string) => /[^\w\s]/.test(ch)
const isWordChar = (ch: string) => /[\w$]/.test(ch)

export function createRun(code: string, options: RunOptions): Run {
  const chars = [...code]
  const run: Run = {
    chars,
    states: new Array(chars.length).fill(undefined),
    pos: 0,
    autoIndent: options.autoIndent,
    pairs: options.autoClose && options.pairs ? options.pairs : null,
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

/** True when the caret sits on auto-inserted text it can move past. */
export const atPending = (run: Run) => run.states[run.pos] === 'pending'

const copy = (run: Run): Run => ({ ...run, states: run.states.slice(), missed: { ...run.missed } })

const lineStart = (chars: string[], i: number) => {
  while (i > 0 && chars[i - 1] !== '\n') i--
  return i
}

/** At the start of a line, marks its leading spaces as auto-indented. */
function skipIndent(run: Run) {
  if (!run.autoIndent) return
  const { chars, states } = run
  if (run.pos > 0 && chars[run.pos - 1] !== '\n') return
  while (run.pos < chars.length && chars[run.pos] === ' ' && (states[run.pos] ?? 'pending') === 'pending') {
    states[run.pos] = 'auto'
    run.pos++
  }
}

/** The first auto-inserted character after the caret, i.e. what VS Code would show right after it. */
function nextBufferChar(run: Run): string {
  for (let i = run.pos; i < run.chars.length; i++) if (run.states[i] === 'pending') return run.chars[i]
  return '\n' // end of line
}

/** VS Code: auto-close the opener just typed at `o`, if its rules allow. */
function autoClose(run: Run, o: number) {
  const p = run.pairs
  if (!p) return
  const c = p.closeOf[o]
  if (c < 0 || !p.allowed[o]) return
  if (!p.autoCloseBefore.includes(nextBufferChar(run))) return
  run.states[c] = 'pending'
}

/**
 * VS Code: Enter between an opener and its auto-inserted closer pushes the
 * closer down to its own line. Only applies when the snippet's closer really is
 * on its own line, so the result still matches the text being typed.
 */
function expandOnEnter(run: Run, nl: number) {
  const p = run.pairs
  if (!p || !run.autoIndent || nl === 0) return
  const o = nl - 1
  const c = p.closeOf[o]
  if (c < 0 || run.states[c] !== 'pending' || run.states[o] !== 'ok') return
  const ls = lineStart(run.chars, c)
  if (ls - 1 <= nl) return
  for (let i = ls; i < c; i++) if (run.chars[i] !== ' ') return
  for (let i = ls - 1; i < c; i++) if (run.states[i] === undefined) run.states[i] = 'pending'
}

export function typeChar(prev: Run, ch: string): Run {
  if (isFinished(prev)) return prev
  const run = copy(prev)
  const at = run.pos
  const expected = run.chars[at]
  // Typing at an auto-inserted line break inserts a new line in VS Code
  // instead of moving past it, so it can never be right.
  const good = ch === expected && !(run.states[at] === 'pending' && expected === '\n')
  run.keystrokes++
  if (good) run.correctKeystrokes++
  else run.missed[expected] = (run.missed[expected] ?? 0) + 1
  if (isSymbol(expected)) {
    run.symbolTotal++
    if (good) run.symbolCorrect++
  }
  run.states[at] = good ? 'ok' : 'bad'
  run.pos++
  if (good) autoClose(run, at)
  if (expected === '\n') {
    if (good) expandOnEnter(run, at)
    skipIndent(run)
  }
  return run
}

/** Clears position i; deleting an opener also removes what it auto-inserted (VS Code's autoClosingDelete). */
function clearAt(run: Run, i: number) {
  run.states[i] = undefined
  const c = run.pairs?.closeOf[i] ?? -1
  if (c < 0) return
  for (let j = i + 1; j <= c; j++) if (run.states[j] === 'pending') run.states[j] = undefined
}

/** Backspace; with `word`, deletes back to the start of the current word (Ctrl+Backspace). */
export function backspace(prev: Run, word = false): Run {
  if (prev.pos === 0) return prev
  const run = copy(prev)
  const step = () => {
    while (run.pos > 0 && run.states[run.pos - 1] === 'auto') clearAt(run, --run.pos)
    if (run.pos > 0) clearAt(run, --run.pos)
  }
  step()
  if (word) {
    while (run.pos > 0 && isWordChar(run.chars[run.pos - 1]) && run.states[run.pos - 1] !== 'auto') step()
  }
  // Never leave the caret inside indentation that auto-indent would skip.
  skipIndent(run)
  return run
}

export type Move = 'right' | 'end' | 'down'

/** → / End / ↓ over auto-inserted text. Anywhere else these keys do nothing. */
export function move(prev: Run, dir: Move): Run {
  if (!atPending(prev)) return prev
  const run = copy(prev)
  const { chars, states } = run
  const pass = () => {
    states[run.pos] = 'skipped'
    run.pos++
  }
  if (dir === 'right') pass()
  else if (dir === 'end') {
    while (states[run.pos] === 'pending' && chars[run.pos] !== '\n') pass()
  } else {
    // ↓ only moves when the caret is at the end of its line, before an auto-inserted line.
    if (chars[run.pos] !== '\n') return prev
    const col = run.pos - lineStart(chars, run.pos)
    pass()
    for (let k = 0; k < col && states[run.pos] === 'pending' && chars[run.pos] !== '\n'; k++) pass()
  }
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
