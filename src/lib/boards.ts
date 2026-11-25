/** The game's side of the leaderboards' API (worker/lib/boards.ts). */
import type { Board, BoardReplay, BoardRow, LanguageBoards, ReportReason } from './apiTypes'
import { api } from './http'

export type { Board, BoardReplay, BoardRow, LanguageBoards, ReportReason }

/** Throws with words to show when the board can't be read. */
async function get<T>(path: string): Promise<T> {
  const r = await api<T>(path, { fallback: 'The leaderboard couldn’t be reached.' })
  if (!r.ok) throw new Error(r.error)
  return r.body
}

export const fetchLanguageBoards = (language: string) => get<LanguageBoards>(`/api/boards?lang=${encodeURIComponent(language)}`)
export const fetchBoard = (fingerprint: string, aids: string) => get<Board>(`/api/boards/${fingerprint}?aids=${aids}`)
export const fetchMyPlace = (fingerprint: string, aids: string) =>
  get<{ signedIn: boolean; row?: BoardRow | null }>(`/api/boards/${fingerprint}/me?aids=${aids}`).then((r) => r.row ?? null)
/** A kept run to replay; `admin` reads any run through the admin API (behind Cloudflare Access). */
export const fetchReplay = (runId: string, admin = false) => get<BoardReplay>(`${admin ? '/api/admin/replays' : '/api/replays'}/${encodeURIComponent(runId)}`)

/** Null once sent, or why it wasn't. */
export async function sendReport(report: { player: string; run?: string; reason: ReportReason; note: string }): Promise<string | null> {
  const r = await api<{ ok: true }>('/api/reports', { body: report, fallback: 'The report couldn’t be sent.' })
  return r.ok ? null : r.error
}
