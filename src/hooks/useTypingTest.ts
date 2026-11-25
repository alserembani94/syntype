import { useCallback, useEffect, useReducer } from 'react'
import {
  acceptCompletion,
  backspace,
  counts,
  createRun,
  isFinished,
  move,
  typeChar,
  type Move,
  type Run,
  type RunOptions,
} from '../lib/engine'
import { getSuggestions, suggestContext, type SuggestConfig, type Suggestion } from '../lib/suggest'
import { wpm, type Sample } from '../lib/stats'
import type { Snippet } from '../languages'

export type Phase = 'ready' | 'running' | 'done'

export interface TestOptions extends RunOptions {
  /** Null or missing turns suggestions off. */
  suggest?: SuggestConfig | null
}

/** The open suggestion list. */
export interface SuggestState {
  /** Where the word being completed starts. */
  start: number
  items: Suggestion[]
  selected: number
}

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
  suggestConfig: SuggestConfig | null
  suggest: SuggestState | null
}

type Action =
  | { type: 'load'; snippet: Snippet; options: TestOptions }
  | { type: 'key'; ch: string; now: number }
  | { type: 'move'; dir: Move; now: number }
  | { type: 'back'; word: boolean }
  | { type: 'tick'; now: number }
  | { type: 'suggestNav'; delta: number }
  | { type: 'accept'; index?: number; now: number }
  | { type: 'dismiss' }

/**
 * Recomputes the suggestion list after an edit. Typing a word character or a
 * member trigger such as "." opens it (VS Code's quick suggestions and trigger
 * characters); other edits only refilter an open list.
 */
function refreshSuggest(s: TestState, open: boolean): SuggestState | null {
  const cfg = s.suggestConfig
  if (!cfg || (!open && !s.suggest) || isFinished(s.run)) return null
  const ctx = suggestContext(s.run, cfg)
  if (!ctx) return null
  const items = getSuggestions(s.run, ctx, cfg)
  return items.length ? { start: ctx.start, items, selected: 0 } : null
}

const opensSuggest = (cfg: SuggestConfig | null, ch: string) =>
  !!cfg && (cfg.wordChar.test(ch) || cfg.memberTriggers.some((t) => t.endsWith(ch)))

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

function init(snippet: Snippet, options: TestOptions, runId: number): TestState {
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
    suggestConfig: options.suggest ?? null,
    suggest: null,
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
      next.suggest = refreshSuggest(next, opensSuggest(s.suggestConfig, a.ch))
      return finishIfDone(next, a.now)
    }

    case 'move': {
      if (s.phase !== 'running') return s
      return finishIfDone({ ...s, run: move(s.run, a.dir), now: a.now, suggest: null }, a.now)
    }

    case 'back': {
      if (s.phase === 'done') return s
      const next = { ...s, run: backspace(s.run, a.word) }
      next.suggest = refreshSuggest(next, false)
      return next
    }

    case 'suggestNav': {
      if (!s.suggest) return s
      const n = s.suggest.items.length
      return { ...s, suggest: { ...s.suggest, selected: (s.suggest.selected + a.delta + n) % n } }
    }

    case 'accept': {
      if (!s.suggest || s.phase !== 'running') return s
      const item = s.suggest.items[a.index ?? s.suggest.selected]
      const before = s.run.correctKeystrokes
      const run = acceptCompletion(s.run, s.suggest.start, item.label)
      return finishIfDone(
        {
          ...s,
          run,
          now: a.now,
          suggest: null,
          intervalTyped: s.intervalTyped + 1,
          intervalErrors: s.intervalErrors + (run.correctKeystrokes === before ? 1 : 0),
        },
        a.now,
      )
    }

    case 'dismiss':
      return s.suggest ? { ...s, suggest: null } : s

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

export function useTypingTest(first: Snippet, options: TestOptions) {
  const [state, dispatch] = useReducer(reducer, undefined, () => init(first, options, 0))

  // One sample per second while the clock runs.
  useEffect(() => {
    if (state.phase !== 'running') return
    const id = setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 1000)
    return () => clearInterval(id)
  }, [state.phase, state.runId])

  const load = useCallback((snippet: Snippet, opts: TestOptions) => dispatch({ type: 'load', snippet, options: opts }), [])
  const suggestNav = useCallback((delta: number) => dispatch({ type: 'suggestNav', delta }), [])
  const accept = useCallback((index?: number) => dispatch({ type: 'accept', index, now: performance.now() }), [])
  const dismiss = useCallback(() => dispatch({ type: 'dismiss' }), [])
  const moveCaret = useCallback((dir: Move) => dispatch({ type: 'move', dir, now: performance.now() }), [])
  const type = useCallback((ch: string) => dispatch({ type: 'key', ch, now: performance.now() }), [])
  const back = useCallback((word: boolean) => dispatch({ type: 'back', word }), [])

  const elapsed =
    state.phase === 'ready' ? 0 : ((state.phase === 'done' ? state.finishedAt : state.now) - state.startedAt) / 1000

  return { state, elapsed, load, type, back, move: moveCaret, suggestNav, accept, dismiss }
}
