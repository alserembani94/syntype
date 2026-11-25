/** Leaderboard names (docs/leaderboard.md, "Display name"). */

export const NAME_MIN = 3
export const NAME_MAX = 24
/** Renaming is allowed once a week; the first confirmation doesn't count. */
export const RENAME_EVERY_MS = 7 * 24 * 60 * 60 * 1000

const RESERVED = ['admin', 'administrator', 'moderator', 'mod', 'syntype', 'staff', 'support', 'system', 'root', 'anonymous', 'deleted', 'null', 'undefined']
/**
 * Words a name may not contain, matched without spaces, dashes, underscores
 * or digits standing in for letters. Kept short on purpose: the admin page
 * can rename or hide anyone this misses.
 */
const BLOCKED = ['fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'nazi', 'hitler', 'rape', 'porn', 'nigg', 'fagg', 'retard', 'kys']

/** Collapses runs of spaces and trims, so "  Ada   L " becomes "Ada L". */
export const tidyName = (raw: string) => raw.replace(/\s+/g, ' ').trim()

/** The key names are unique on: case doesn't matter. */
export const nameKey = (name: string) => tidyName(name).toLowerCase()

const deLeet = (s: string) =>
  s.toLowerCase().replace(/[\s_-]+/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/\$/g, 's').replace(/@/g, 'a')

/** Why a name can't be used, in words a player can act on; null when it's fine. */
export function nameProblem(raw: string): string | null {
  const name = tidyName(raw)
  if (name.length < NAME_MIN) return `Use at least ${NAME_MIN} characters.`
  if (name.length > NAME_MAX) return `Use at most ${NAME_MAX} characters.`
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) return 'Use letters, numbers, spaces, - and _ only.'
  if (!/[A-Za-z0-9]/.test(name)) return 'Include at least one letter or number.'
  if (RESERVED.includes(name.toLowerCase().replace(/[\s_-]+/g, ''))) return 'That name is reserved.'
  if (BLOCKED.some((w) => deLeet(name).includes(w))) return 'Please choose a different name.'
  return null
}

/** A name to prefill: the GitHub username, or a Google first name plus digits (never a full name). */
export function suggestName(profile: { login?: string; givenName?: string }, digits: () => string): string {
  const clean = (s: string) => tidyName(s.replace(/[^A-Za-z0-9 _-]/g, '')).slice(0, NAME_MAX)
  if (profile.login) {
    const login = clean(profile.login)
    if (!nameProblem(login)) return login
  }
  const first = clean((profile.givenName ?? '').split(' ')[0]).toLowerCase().slice(0, NAME_MAX - 4)
  const base = first.length >= 2 && !nameProblem(`${first}-${digits()}`) ? first : 'typist'
  return `${base}-${digits()}`
}
