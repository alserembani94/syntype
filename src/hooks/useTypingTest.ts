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
import {
  bufferText,
  filterEntries,
  getSuggestions,
  suggestContext,
  wordStart,
  type SuggestConfig,
  type Suggestion,
} from '../lib/suggest'
import type { ServiceEntry, ServiceRequest, ServiceResponse } from '../lib/service'
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
  /** Present when the list came from a completion service; refiltered locally as you type. */
  entries?: ServiceEntry[]
}

/** A completion request waiting for the service. */
export interface PendingRequest extends ServiceRequest {
  id: number
  start: number
}

export interface TestState {
  snippet: Snippet
  run: Run
  phase: Phase
  startedAt: number
  finishedAt: number
  now: number
  /** When the current pause began (page lost focus), or 0 when not paused. */
  pausedAt: number
  /** Total paused time so far, in ms; never counted as typing time. */
  pausedMs: number
  samples: Sample[]
  /** Keys typed / mistakes made since the last sample. */
  intervalTyped: number
  intervalErrors: number
  /** Bumps on every load so effects can tell runs apart. */
  runId: number
  suggestConfig: SuggestConfig | null
  suggest: SuggestState | null
  /** Whether the language's completion service can answer yet. */
  serviceReady: boolean
  request: PendingRequest | null
  nextRequestId: number
}

export type Action =
  | { type: 'load'; snippet: Snippet; options: TestOptions }
  | { type: 'key'; ch: string; now: number }
  | { type: 'move'; dir: Move; now: number }
  | { type: 'back'; word: boolean }
  | { type: 'tick'; now: number }
  | { type: 'suggestNav'; delta: number }
  | { type: 'accept'; index?: number; now: number }
  | { type: 'dismiss' }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'serviceStatus'; ready: boolean }
  | { type: 'serviceResult'; id: number; response: ServiceResponse }
  | { type: 'serviceFailed'; id: number }

/** Seconds of typing time at `now`: wall time since the first key, minus pauses. */
export function activeSeconds(s: TestState, now: number): number {
  if (s.phase === 'ready') return 0
  const end = s.pausedAt || now
  return Math.max(0, (end - s.startedAt - s.pausedMs) / 1000)
}

function resumed(s: TestState, now: number): TestState {
  return s.pausedAt ? { ...s, pausedAt: 0, pausedMs: s.pausedMs + (now - s.pausedAt) } : s
}

const usesService = (s: TestState) => !!s.suggestConfig?.service && s.serviceReady

/** VS Code selects a recommended item when the list opens; otherwise the first. */
const firstSelection = (items: Suggestion[]) => Math.max(0, items.findIndex((i) => i.preselect))

/** Narrows a service list to the letters typed since it opened. Closes when nothing matches. */
function refilter(run: Run, list: SuggestState): SuggestState | null {
  if (!list.entries || run.pos < list.start) return null
  const prefix = run.typed.slice(list.start, run.pos).join('')
  const items = filterEntries(list.entries, prefix)
  return items.length ? { ...list, items, selected: firstSelection(items) } : null
}

/** Asks the service what can go at the caret; the hook's effect sends it. */
function requestAt(s: TestState, start: number, trigger?: string): TestState {
  const { text, offset } = bufferText(s.run)
  return {
    ...s,
    suggest: null,
    request: { id: s.nextRequestId, start, text, offset, trigger, mode: s.suggestConfig?.serviceMode },
    nextRequestId: s.nextRequestId + 1,
  }
}

/** Without a service (or while it starts): keywords, the language's packs and typed words, computed here. */
function localSuggest(s: TestState, open: boolean): SuggestState | null {
  const cfg = s.suggestConfig
  if (!cfg || (!open && !s.suggest) || isFinished(s.run)) return null
  const ctx = suggestContext(s.run, cfg)
  if (!ctx) return null
  const items = getSuggestions(s.run, ctx, cfg)
  return items.length ? { start: ctx.start, items, selected: 0 } : null
}

/**
 * After a character is typed: VS Code opens suggestions on a trigger character
 * or at the start of a word (outside strings and comments), and refilters an
 * open list as the word grows. Anything else closes it.
 */
function afterTyping(s: TestState, ch: string): TestState {
  const cfg = s.suggestConfig
  if (!cfg || isFinished(s.run)) return { ...s, suggest: null, request: null }
  const isWord = cfg.wordChar.test(ch)

  if (!usesService(s)) {
    const open = isWord || cfg.memberTriggers.some((t) => t.endsWith(ch))
    return { ...s, suggest: localSuggest(s, open), request: null }
  }

  if (cfg.triggerCharacters.includes(ch)) return requestAt(s, s.run.pos, ch)
  if (!isWord) return { ...s, suggest: null, request: null }

  const ws = wordStart(s.run, cfg)
  // An open list keeps filtering while the word it opened for grows.
  if (s.suggest?.entries && (s.suggest.start === ws || (ws < 0 && s.suggest.start < s.run.pos)))
    return { ...s, suggest: refilter(s.run, s.suggest) }
  // Still waiting on a request for this word: the answer is filtered on arrival.
  if (s.request && s.request.start === ws) return s
  if (ws >= 0 && ws === s.run.pos - 1 && !cfg.quiet[ws]) return requestAt(s, ws)
  return { ...s, suggest: null, request: null }
}

/** Accepts a suggestion: one keystroke, which replaces the word typed so far. */
function accept(s: TestState, item: Suggestion, start: number, now: number): TestState {
  const before = s.run.correctKeystrokes
  const run = acceptCompletion(s.run, start, item.insertText ?? item.label)
  return {
    ...s,
    run,
    now,
    suggest: null,
    request: null,
    intervalTyped: s.intervalTyped + 1,
    intervalErrors: s.intervalErrors + (run.correctKeystrokes === before ? 1 : 0),
  }
}

function sample(s: TestState, now: number): Sample {
  const t = activeSeconds(s, now)
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
    suggest: null,
    request: null,
  }
}

export function init(snippet: Snippet, options: TestOptions, runId: number): TestState {
  return {
    snippet,
    run: createRun(snippet.code, options),
    phase: 'ready',
    startedAt: 0,
    finishedAt: 0,
    now: 0,
    pausedAt: 0,
    pausedMs: 0,
    samples: [],
    intervalTyped: 0,
    intervalErrors: 0,
    runId,
    suggestConfig: options.suggest ?? null,
    suggest: null,
    serviceReady: options.suggest?.service?.status() === 'ready',
    request: null,
    nextRequestId: 1,
  }
}

export function reducer(s: TestState, a: Action): TestState {
  switch (a.type) {
    case 'load':
      return init(a.snippet, a.options, s.runId + 1)

    case 'key': {
      if (s.phase === 'done') return s
      // A key can only arrive with focus back, so any pause is over.
      let cur = resumed(s, a.now)
      // VS Code commit characters: accept the selected item, then type the character.
      const selected = cur.suggest?.items[cur.suggest.selected]
      if (cur.suggest && selected?.commit?.includes(a.ch)) cur = accept(cur, selected, cur.suggest.start, a.now)
      if (isFinished(cur.run)) return finishIfDone(cur, a.now)

      const started = cur.phase === 'ready' ? { phase: 'running' as const, startedAt: a.now } : {}
      const before = cur.run.correctKeystrokes
      const run = typeChar(cur.run, a.ch)
      const next: TestState = {
        ...cur,
        ...started,
        run,
        now: a.now,
        intervalTyped: cur.intervalTyped + 1,
        intervalErrors: cur.intervalErrors + (run.correctKeystrokes === before ? 1 : 0),
      }
      return finishIfDone(afterTyping(next, a.ch), a.now)
    }

    case 'move': {
      if (s.phase !== 'running') return s
      return finishIfDone({ ...s, run: move(s.run, a.dir), now: a.now, suggest: null, request: null }, a.now)
    }

    case 'back': {
      if (s.phase === 'done') return s
      const next = { ...s, run: backspace(s.run, a.word) }
      if (next.request && next.run.pos <= next.request.start) next.request = null
      if (s.suggest?.entries) next.suggest = next.run.pos > s.suggest.start ? refilter(next.run, s.suggest) : null
      else next.suggest = localSuggest(next, false)
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
      return finishIfDone(accept(s, item, s.suggest.start, a.now), a.now)
    }

    case 'dismiss':
      return s.suggest || s.request ? { ...s, suggest: null, request: null } : s

    case 'pause':
      return s.phase === 'running' && !s.pausedAt ? { ...s, pausedAt: a.now, suggest: null, request: null } : s

    case 'resume':
      return resumed(s, a.now)

    case 'serviceStatus':
      return s.serviceReady === a.ready ? s : { ...s, serviceReady: a.ready, suggest: null, request: null }

    case 'serviceResult': {
      if (!s.request || s.request.id !== a.id || s.phase !== 'running') return s
      const list = refilter(s.run, { start: s.request.start, items: [], selected: 0, entries: a.response.entries })
      return { ...s, request: null, suggest: list }
    }

    case 'serviceFailed':
      return s.request?.id === a.id ? { ...s, request: null } : s

    case 'tick':
      if (s.phase !== 'running' || s.pausedAt) return s
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

  // Follow the completion service as it starts up (or fails).
  const service = state.suggestConfig?.service ?? null
  useEffect(() => {
    if (!service) return
    const sync = () => dispatch({ type: 'serviceStatus', ready: service.status() === 'ready' })
    sync()
    return service.onStatus(sync)
  }, [service])

  // Send each new request; answers that arrive late are ignored by the reducer.
  const request = state.request
  useEffect(() => {
    if (!request || !service) return
    const { id, text, offset, trigger, mode } = request
    service.complete({ text, offset, trigger, mode }).then(
      (response) => dispatch({ type: 'serviceResult', id, response }),
      () => dispatch({ type: 'serviceFailed', id }),
    )
  }, [request, service])

  const load = useCallback((snippet: Snippet, opts: TestOptions) => dispatch({ type: 'load', snippet, options: opts }), [])
  const suggestNav = useCallback((delta: number) => dispatch({ type: 'suggestNav', delta }), [])
  const acceptSelected = useCallback((index?: number) => dispatch({ type: 'accept', index, now: performance.now() }), [])
  const dismiss = useCallback(() => dispatch({ type: 'dismiss' }), [])
  const pause = useCallback(() => dispatch({ type: 'pause', now: performance.now() }), [])
  const resume = useCallback(() => dispatch({ type: 'resume', now: performance.now() }), [])
  const moveCaret = useCallback((dir: Move) => dispatch({ type: 'move', dir, now: performance.now() }), [])
  const type = useCallback((ch: string) => dispatch({ type: 'key', ch, now: performance.now() }), [])
  const back = useCallback((word: boolean) => dispatch({ type: 'back', word }), [])

  const elapsed = activeSeconds(state, state.phase === 'done' ? state.finishedAt : state.now)

  return {
    state,
    elapsed,
    load,
    type,
    back,
    move: moveCaret,
    suggestNav,
    accept: acceptSelected,
    dismiss,
    pause,
    resume,
  }
}
