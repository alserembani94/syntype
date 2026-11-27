/**
 * The shape of a leaderboard name, shared by the name step's hint (as the
 * player types) and the server (worker/lib/names.ts), which also turns away
 * reserved and offensive names.
 */

const NAME_MIN = 3
export const NAME_MAX = 24

/** Collapses runs of spaces and trims, so "  Ada   L " becomes "Ada L". */
export const tidyName = (raw: string) => raw.replace(/\s+/g, ' ').trim()

/** Why a name has the wrong shape, in words a player can act on; null when the shape is fine. */
export function nameShapeProblem(raw: string): string | null {
  const name = tidyName(raw)
  if (name.length < NAME_MIN) return `Use at least ${NAME_MIN} characters.`
  if (name.length > NAME_MAX) return `Use at most ${NAME_MAX} characters.`
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) return 'Use letters, numbers, spaces, - and _ only.'
  if (!/[A-Za-z0-9]/.test(name)) return 'Include at least one letter or number.'
  return null
}
