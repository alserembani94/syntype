import { counts, type Run } from './engine'

export interface Sample {
  /** Seconds since the first key. */
  t: number
  /** Cumulative net WPM at t. */
  wpm: number
  /** Raw WPM during the interval ending at t. */
  raw: number
  /** Mistakes made during the interval ending at t. */
  errors: number
}

export interface Result {
  /** Typing speed: only characters the user typed. */
  wpm: number
  /** Code speed: every right character on screen, including suggested and auto-inserted ones. */
  codeWpm: number
  /** Keystrokes saved by accepting suggestions. */
  keysSaved: number
  rawWpm: number
  accuracy: number
  seconds: number
  correct: number
  incorrect: number
  symbolAccuracy: number | null
  symbolTotal: number
  missed: [string, number][]
  samples: Sample[]
}

/** Standard WPM: five characters count as one word. */
export const wpm = (chars: number, seconds: number) => (seconds > 0 ? chars / 5 / (seconds / 60) : 0)

export const accuracy = (run: Run) =>
  run.keystrokes ? (run.correctKeystrokes / run.keystrokes) * 100 : 100

export function summarize(run: Run, seconds: number, samples: Sample[]): Result {
  const { correct, incorrect, code, suggested } = counts(run)
  return {
    wpm: wpm(correct, seconds),
    codeWpm: wpm(code, seconds),
    keysSaved: Math.max(0, suggested - run.completions),
    rawWpm: wpm(correct + incorrect, seconds),
    accuracy: accuracy(run),
    seconds,
    correct,
    incorrect,
    symbolAccuracy: run.symbolTotal ? (run.symbolCorrect / run.symbolTotal) * 100 : null,
    symbolTotal: run.symbolTotal,
    missed: Object.entries(run.missed)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6),
    samples,
  }
}

/** Personal bests only count runs that were reasonably accurate. */
export const MIN_ACCURACY_FOR_BEST = 75
