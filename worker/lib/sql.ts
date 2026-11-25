/**
 * SQL that several queries share, so a board's order and who appears on it
 * are written once. Each expects `bests b` joined with `players p`.
 */

/** Players who show on the boards: not hidden by themselves or a moderator. */
export const VISIBLE = 'p.hidden = 0 AND p.moderator_hidden = 0'

/** A board's order: fastest first; ties go to higher accuracy, then whoever got there first. */
export const ORDER = 'b.wpm DESC, b.accuracy DESC, b.finished_at'

/** Rows strictly ahead of a run in ORDER. Binds: wpm, wpm, accuracy, accuracy, finished_at. */
export const AHEAD = '(b.wpm > ? OR (b.wpm = ? AND (b.accuracy > ? OR (b.accuracy = ? AND b.finished_at < ?))))'
