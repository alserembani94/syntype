/**
 * The shapes the API sends, shared by the Worker (worker/lib/*), the game
 * (src/lib/account.ts, boards.ts, submit.ts) and the admin page
 * (src/admin/api.ts). Types only. The Worker's functions declare these as
 * their return types, so a change on either side that the other doesn't
 * expect fails the type check instead of showing up as a bug.
 */
import type { LogEntry } from './runcore'
import type { SnippetLength } from '../languages/types'

export type Provider = 'github' | 'google'

/** The signed-in player, as GET /api/me describes them. */
export interface Player {
  id: string
  provider: Provider
  /** Null until the player confirms a leaderboard name. */
  name: string | null
  suggestedName: string
  hidden: boolean
  /** Hidden from the leaderboards by a moderator. */
  hiddenByModerator: boolean
  nameChangedAt: string | null
  /** When the name may change again, if not yet. */
  renameAfter: string | null
}

// ——— Leaderboards ———

export interface BoardRow {
  rank: number
  player: { id: string; name: string }
  wpm: number
  accuracy: number
  /** '110': auto-indent, auto-close, autocomplete (src/lib/aids.ts). */
  aids: string
  finishedAt: string
  runId: string
  /** Its keystrokes are kept, so it can be replayed. */
  hasLog: boolean
}

/** A language's boards: each current snippet's top score, and older versions that have scores. */
export interface LanguageBoards {
  language: string
  snippets: { fingerprint: string; name: string; length: SnippetLength; top: { name: string; wpm: number } | null }[]
  archived: { fingerprint: string; name: string; length: SnippetLength; since: string }[]
}

/** One board: the snippet (with its text, if it's an older version) and its top rows for an aid filter. */
export interface Board {
  snippet: { fingerprint: string; language: string; name: string; length: SnippetLength; current: boolean; code?: string }
  aids: string
  rows: BoardRow[]
}

/** A kept run, for its replay. */
export interface BoardReplay {
  runId: string
  player: { id: string; name: string }
  wpm: number
  accuracy: number
  aids: string
  finishedAt: string
  snippet: { fingerprint: string; language: string; name: string; length: SnippetLength; code: string }
  log: LogEntry[]
}

/** A run the server accepted (POST /api/runs). */
export interface SubmittedRun {
  runId: string
  wpm: number
  rawWpm: number
  accuracy: number
  seconds: number
  /** A new best on the snippet's board. */
  best: boolean
  /** A new best for this combination of typing aids. */
  bestForAids: boolean
  /** The player's place on the board (their best, which may be an earlier run). */
  rank: number
}

/** One of a player's leaderboard entries: their overall best on a snippet version. */
export interface Entry {
  runId: string
  fingerprint: string
  language: string
  snippet: string
  length: SnippetLength
  wpm: number
  accuracy: number
  aids: string
  finishedAt: string
  hasLog: boolean
}

// ——— Moderation ———

export const REPORT_REASONS = ['cheating', 'name', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const PLAYER_ACTIONS = ['rename', 'hide', 'show', 'signout'] as const
export type PlayerAction = (typeof PLAYER_ACTIONS)[number]

export interface AdminPlayer {
  id: string
  provider: Provider
  providerId: string
  name: string | null
  suggestedName: string
  hidden: boolean
  hiddenByModerator: boolean
  nameChangedAt: string | null
  createdAt: string
  lastSeenAt: string
  openReports: number
}

/** A reported run as it stands on the boards; null once it's gone (removed, deleted, or replaced by a better run). */
export interface RunInfo {
  language: string
  snippet: string
  wpm: number
  accuracy: number
  aids: string
  finishedAt: string
  hasLog: boolean
}

export interface ReportGroup {
  player: AdminPlayer | null
  run: string | null
  runInfo: RunInfo | null
  count: number
  latest: string
  reports: { id: string; reason: ReportReason; note: string | null; status: string; createdAt: string; reporter: string | null; automatic: boolean }[]
}

export interface AdminAction {
  id: string
  action: string
  player: string | null
  playerName: string | null
  run: string | null
  detail: string | null
  admin: string | null
  createdAt: string
}
