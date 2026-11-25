/**
 * The typing aids a run was typed with, in one place: their order, their
 * names, and the three-character key the server and the boards use ('110':
 * auto-indent on, auto-close on, autocomplete off).
 */
import type { TypingAids } from './runcore'

/** In key order. `short` is the tag on a row; `name` is the aid's full name. */
export const AIDS = [
  { id: 'autoIndent', name: 'auto-indent', short: 'indent' },
  { id: 'autoClose', name: 'auto-close', short: 'close' },
  { id: 'autocomplete', name: 'autocomplete', short: 'auto' },
] as const satisfies readonly { id: keyof TypingAids; name: string; short: string }[]

export const aidsKey = (a: TypingAids) => AIDS.map((x) => +a[x.id]).join('')
export const aidsOf = (key: string): TypingAids => ({ autoIndent: key[0] === '1', autoClose: key[1] === '1', autocomplete: key[2] === '1' })
/** The full names of the aids that are on. */
export const aidNames = (a: TypingAids): string[] => AIDS.filter((x) => a[x.id]).map((x) => x.name)
