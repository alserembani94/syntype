import { useSyncExternalStore } from 'react'

/** Phones and tablets: typing needs the hidden input focused so the on-screen keyboard is open. */
export const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

function snapshot(): boolean {
  if (document.visibilityState !== 'visible') return false
  if (isTouch()) return document.activeElement?.id === 'type-input'
  // Keys are caught page-wide, so on desktop it's enough that the page itself has focus.
  return document.hasFocus()
}

function subscribe(onChange: () => void) {
  const events: [EventTarget, string][] = [
    [window, 'focus'],
    [window, 'blur'],
    [document, 'visibilitychange'],
    [document, 'focusin'],
    [document, 'focusout'],
  ]
  for (const [t, e] of events) t.addEventListener(e, onChange)
  return () => {
    for (const [t, e] of events) t.removeEventListener(e, onChange)
  }
}

/** Whether keystrokes can reach the game right now. */
export function usePageFocus(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => true)
}
