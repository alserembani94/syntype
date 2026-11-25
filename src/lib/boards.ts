/** The game's side of the leaderboards' API (worker/lib/boards.ts). */
import type { Board, BoardReplay, BoardRow, LanguageBoards, ReportReason } from './apiTypes'

export type { Board, BoardReplay, BoardRow, LanguageBoards, ReportReason }


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
