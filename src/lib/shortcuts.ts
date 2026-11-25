/**
 * Keyboard shortcuts. Every plain key is typing, so each shortcut needs Ctrl
 * (⌘ on a Mac; either works everywhere). Esc is not a shortcut: it only closes
 * things (suggestions, pickers), so it can never throw away a run.
 *
 * - Ctrl/⌘+Enter: new snippet
 * - Ctrl/⌘+Shift+L: change language
 * - Ctrl/⌘+K, then T: change theme. Two steps, like VS Code's Ctrl+K Ctrl+T;
 *   the second is a plain T because browsers keep Ctrl+T for a new tab.
 */
export type Command = 'newSnippet' | 'language' | 'theme' | 'chordStart' | 'chordCancel'

export interface KeyLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/** Keys that don't end a two-step shortcut on their own: pressing them is part of pressing the next key. */
const MODIFIERS = new Set(['Control', 'Meta', 'Shift', 'Alt', 'AltGraph', 'CapsLock', 'OS'])

/**
 * The command a key press means, if any. `chordPending`: Ctrl/⌘+K was just
 * pressed, so this key completes (or cancels) the two-step shortcut.
 */
export function shortcut(e: KeyLike, chordPending: boolean): Command | null {
  const key = e.key.toLowerCase()
  if (chordPending) {
    if (MODIFIERS.has(e.key)) return null
    return key === 't' && !e.altKey ? 'theme' : 'chordCancel'
  }
  const mod = (e.ctrlKey || e.metaKey) && !e.altKey
  if (!mod) return null
  if (key === 'enter' && !e.shiftKey) return 'newSnippet'
  if (key === 'l' && e.shiftKey) return 'language'
  if (key === 'k' && !e.shiftKey) return 'chordStart'
  return null
}

/** A two-step shortcut gives up waiting after this long. */
export const CHORD_TIMEOUT_MS = 3000

const isMac = () => {
  if (typeof navigator === 'undefined') return false
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform
  return /mac|iphone|ipad/i.test(platform)
}

/** Key names as this computer labels them: ⌘ and ⇧ on a Mac, ctrl and shift elsewhere. */
export const keyLabels = () => (isMac() ? { mod: '⌘', shift: '⇧' } : { mod: 'ctrl', shift: 'shift' })

/** Shortcuts written out for tooltips, e.g. "Ctrl+Shift+L" or "⌘⇧L". */
export function shortcutText(command: 'newSnippet' | 'language' | 'theme'): string {
  const mac = isMac()
  const mod = mac ? '⌘' : 'Ctrl+'
  if (command === 'newSnippet') return `${mod}${mac ? '↩' : 'Enter'}`
  if (command === 'language') return mac ? '⌘⇧L' : 'Ctrl+Shift+L'
  return `${mod}K, then T`
}
