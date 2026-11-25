import { useCallback, useEffect, useReducer } from 'react'
import { backspace, counts, createRun, isFinished, move, typeChar, type Move, type Run, type RunOptions } from '../lib/engine'
import { wpm, type Sample } from '../lib/stats'
import type { Snippet } from '../languages'

export type Phase = 'ready' | 'running' | 'done'

export interface TestState {
  snippet: Snippet
  run: Run
  phase: Phase
  startedAt: number
  finishedAt: number
  now: number
  samples: Sample[]
  /** Keys typed / mistakes made since the last sample. */
  intervalTyped: number
  intervalErrors: number
  /** Bumps on every load so effects can tell runs apart. */
  runId: number
}

type Action =
  | { type: 'load'; snippet: Snippet; options: RunOptions }
  | { type: 'key'; ch: string; now: number }
  | { type: 'move'; dir: Move; now: number }
  | { type: 'back'; word: boolean }
  | { type: 'tick'; now: number }

function sample(s: TestState, now: number): Sample {
  const t = (now - s.startedAt) / 1000
  const since = t - (s.samples.at(-1)?.t ?? 0)
  return {
    t,
    wpm: wpm(counts(s.run).correct, t),
    raw: since > 0 ? wpm(s.intervalTyped, since) : 0,
    errors: s.intervalErrors,
  }
}

function finishIfDone(s: TestState, now: number): TestState {
  if (!isFinished(s.run)) return s
  return {
    ...s,
    phase: 'done',
    finishedAt: now,
    samples: [...s.samples, sample(s, now)],
    intervalTyped: 0,
    intervalErrors: 0,
  }
}

function init(snippet: Snippet, options: RunOptions, runId: number): TestState {
  return {
    snippet,
    run: createRun(snippet.code, options),
    phase: 'ready',
    startedAt: 0,
    finishedAt: 0,
    now: 0,
    samples: [],
    intervalTyped: 0,
    intervalErrors: 0,
    runId,
  }
}

function reducer(s: TestState, a: Action): TestState {
  switch (a.type) {
    case 'load':
      return init(a.snippet, a.options, s.runId + 1)

    case 'key': {
      if (s.phase === 'done') return s
      const started = s.phase === 'ready' ? { phase: 'running' as const, startedAt: a.now } : {}
      const before = s.run.correctKeystrokes
      const run = typeChar(s.run, a.ch)
      const next: TestState = {
        ...s,
        ...started,
        run,
        now: a.now,
        intervalTyped: s.intervalTyped + 1,
        intervalErrors: s.intervalErrors + (run.correctKeystrokes === before ? 1 : 0),
      }
      return finishIfDone(next, a.now)
    }

    case 'move': {
      if (s.phase !== 'running') return s
      return finishIfDone({ ...s, run: move(s.run, a.dir), now: a.now }, a.now)
    }

    case 'back':
      if (s.phase === 'done') return s
      return { ...s, run: backspace(s.run, a.word) }

    case 'tick':
      if (s.phase !== 'running') return s
      return {
        ...s,
        now: a.now,
        samples: [...s.samples, sample(s, a.now)],
        intervalTyped: 0,
        intervalErrors: 0,
      }
  }
}

export function useTypingTest(first: Snippet, options: RunOptions) {
  const [state, dispatch] = useReducer(reducer, undefined, () => init(first, options, 0))

  // One sample per second while the clock runs.
  useEffect(() => {
    if (state.phase !== 'running') return
    const id = setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 1000)
    return () => clearInterval(id)
  }, [state.phase, state.runId])

  const load = useCallback((snippet: Snippet, opts: RunOptions) => dispatch({ type: 'load', snippet, options: opts }), [])
  const moveCaret = useCallback((dir: Move) => dispatch({ type: 'move', dir, now: performance.now() }), [])
  const type = useCallback((ch: string) => dispatch({ type: 'key', ch, now: performance.now() }), [])
  const back = useCallback((word: boolean) => dispatch({ type: 'back', word }), [])

  const elapsed =
    state.phase === 'ready' ? 0 : ((state.phase === 'done' ? state.finishedAt : state.now) - state.startedAt) / 1000

  return { state, elapsed, load, type, back, move: moveCaret }
}
