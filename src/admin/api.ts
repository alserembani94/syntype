/** The admin page's calls to /api/admin (worker/lib/moderation.ts has the other side). */
import type { AdminAction, AdminPlayer, Entry, PlayerAction, ReportGroup, ReportReason as Reason, RunInfo } from '../lib/apiTypes'

export type { AdminAction, AdminPlayer, Entry, PlayerAction, Reason, RunInfo, ReportGroup }

export class AdminError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
  // Access's login page (an expired Access session) instead of our JSON.
  if (!res.headers.get('Content-Type')?.includes('json')) throw new AdminError('Your Cloudflare Access session has ended. Reload the page to sign in again.', res.status)
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new AdminError(data.error ?? `Request failed (${res.status})`, res.status)
  return data
}

export const whoAmI = () => call<{ email: string }>('/me')
export const findPlayers = (q: string) => call<{ players: AdminPlayer[] }>(`/players?q=${encodeURIComponent(q)}`).then((r) => r.players)
export const actOnPlayer = (id: string, action: PlayerAction, body: object = {}) =>
  call<{ player: AdminPlayer }>(`/players/${encodeURIComponent(id)}/${action}`, body).then((r) => r.player)
export const reportQueue = (status: 'open' | 'closed') => call<{ groups: ReportGroup[] }>(`/reports?status=${status}`).then((r) => r.groups)
export const closeReports = (player: string, run: string | null, status: 'resolved' | 'dismissed') =>
  call<{ closed: number }>('/reports/close', { player, run, status })
export const actionLog = (before?: string) => call<{ actions: AdminAction[] }>(`/actions${before ? `?before=${encodeURIComponent(before)}` : ''}`).then((r) => r.actions)
/** Takes one of a player's runs off the boards (the player id lets the server find it without scanning every score). */
export const removeRun = (runId: string, playerId: string) => call<{ removed: number }>(`/runs/${encodeURIComponent(runId)}/remove`, { player: playerId })
export const playerRuns = (id: string) => call<{ entries: Entry[] }>(`/players/${encodeURIComponent(id)}/runs`).then((r) => r.entries)
