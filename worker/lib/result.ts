/** What a route's work returns: its answer, or an HTTP status and words for the player. */
export type Result<T = object> = ({ ok: true } & T) | { ok: false; status: number; error: string }

export const fail = (status: number, error: string) => ({ ok: false as const, status, error })

/** D1's error when an insert or update breaks a UNIQUE constraint (two requests racing for the same row). */
export const isUniqueViolation = (err: unknown) => /UNIQUE/i.test(String(err))
