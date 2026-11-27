import { useCallback, useEffect, useReducer } from 'react'
import type { Move } from '../lib/engine'
import { activeSeconds, init, reducer, type TestOptions } from '../lib/typing'
import type { Snippet } from '../languages/types'

export * from '../lib/typing'

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
  const back = useCallback((word: boolean) => dispatch({ type: 'back', word, now: performance.now() }), [])

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
