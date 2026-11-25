/** The game's side of the leaderboards' API (worker/lib/boards.ts). */
import type { LogEntry, TypingAids } from './runcore'
import type { SnippetLength } from '../languages'

export interface BoardRow {
  rank: number
  player: { id: string; name: string }
  wpm: number
  accuracy: number
  /** '110': auto-indent, auto-close, autocomplete. */
  aids: string
  finishedAt: string
  runId: string
  hasLog: boolean
}

export interface LanguageBoards {
  snippets: { fingerprint: string; name: string; length: SnippetLength; top: { name: string; wpm: number } | null }[]
  archived: { fingerprint: string; name: string; length: SnippetLength; since: string }[]
}

export interface Board {
  snippet: { fingerprint: string; language: string; name: string; length: SnippetLength; current: boolean; code?: string }
  aids: string
  rows: BoardRow[]
}

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

export const aidsOf = (key: string): TypingAids => ({ autoIndent: key[0] === '1', autoClose: key[1] === '1', autocomplete: key[2] === '1' })
export const aidsKey = (a: TypingAids) => `${+a.autoIndent}${+a.autoClose}${+a.autocomplete}`

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok || !body) throw new Error(body?.error ?? 'The leaderboard couldn’t be reached.')
  return body
}

export const fetchLanguageBoards = (language: string) => get<LanguageBoards>(`/api/boards?lang=${encodeURIComponent(language)}`)
export const fetchBoard = (fingerprint: string, aids: string) => get<Board>(`/api/boards/${fingerprint}?aids=${aids}`)
export const fetchMyPlace = (fingerprint: string, aids: string) =>
  get<{ signedIn: boolean; row?: BoardRow | null }>(`/api/boards/${fingerprint}/me?aids=${aids}`).then((r) => r.row ?? null)
/** A kept run to replay; `admin` reads any run through the admin API (behind Cloudflare Access). */
export const fetchReplay = (runId: string, admin = false) => get<BoardReplay>(`${admin ? '/api/admin/replays' : '/api/replays'}/${encodeURIComponent(runId)}`)

export type ReportReason = 'cheating' | 'name' | 'other'

export async function sendReport(report: { player: string; run?: string; reason: ReportReason; note: string }): Promise<string | null> {
  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    })
    if (res.ok) return null
    return ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'The report couldn’t be sent.'
  } catch {
    return 'The report couldn’t be sent.'
  }
}
