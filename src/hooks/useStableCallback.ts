import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * A handler with a fixed identity that always calls the latest `fn`, so a
 * memoised block it's passed to doesn't redraw just because its parent did
 * (docs/design-system rule: while typing, only the editor and status bar
 * render). For event handlers only: never call it while rendering, where it
 * could still be the previous render's function.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn)
  useLayoutEffect(() => {
    latest.current = fn
  })
  return useCallback((...args: A) => latest.current(...args), [])
}
