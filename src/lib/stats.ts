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
  /** Typing time: excludes time paused while the page didn't have focus. */
  seconds: number
  pausedSeconds: number
  /** How steady the per-second speed was, 0-100; null when the run is too short to tell. */
  consistency: number | null
  /** Right characters the user typed. */
  correct: number
  incorrect: number
  /** Right characters inserted by accepted suggestions. */
  suggested: number
  /** Right characters inserted by auto-indent and auto-close. */
  autoInserted: number
  symbolAccuracy: number | null
  symbolTotal: number
  missed: [string, number][]
  samples: Sample[]
}

/** Standard WPM: five characters count as one word. */
export const wpm = (chars: number, seconds: number) => (seconds > 0 ? chars / 5 / (seconds / 60) : 0)

export const accuracy = (run: Run) =>
  run.keystrokes ? (run.correctKeystrokes / run.keystrokes) * 100 : 100

/** Fewer full seconds than this and consistency would be noise. */
export const MIN_SECONDS_FOR_CONSISTENCY = 3

/**
 * Consistency: 100% minus the coefficient of variation of the per-second raw
 * speed, so 100% means every second was typed at the same pace. The last,
 * partial second is left out.
 */
export function consistency(samples: Sample[]): number | null {
  const raws: number[] = []
  samples.forEach((s, i) => {
    const dt = s.t - (i ? samples[i - 1].t : 0)
    if (dt >= 0.9) raws.push(s.raw)
  })
  if (raws.length < MIN_SECONDS_FOR_CONSISTENCY) return null
  const mean = raws.reduce((a, b) => a + b, 0) / raws.length
  if (mean === 0) return 0
  const sd = Math.sqrt(raws.reduce((a, b) => a + (b - mean) ** 2, 0) / raws.length)
  return Math.max(0, Math.min(100, 100 * (1 - sd / mean)))
}

export function summarize(run: Run, seconds: number, samples: Sample[], pausedSeconds = 0): Result {
  const { correct, incorrect, code, suggested } = counts(run)
  return {
    pausedSeconds,
    consistency: consistency(samples),
    suggested,
    autoInserted: code - correct - suggested,
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
