/** The admin page's calls to /api/admin (worker/lib/moderation.ts has the other side). */
import type { AdminAction, AdminPlayer, Entry, PlayerAction, ReportGroup, ReportReason as Reason, RunInfo } from '../lib/apiTypes'

import { api } from '../lib/http'

export type { AdminAction, AdminPlayer, Entry, PlayerAction, Reason, RunInfo, ReportGroup }

export class AdminError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await api<T>(`/api/admin${path}`, { body })
  if (r.ok) return r.body
  // Access's login page (an expired Access session) instead of our JSON.
  if (r.status !== 0 && !r.body) throw new AdminError('Your Cloudflare Access session has ended. Reload the page to sign in again.', r.status)
  throw new AdminError(r.body?.error ?? (r.status ? `Request failed (${r.status})` : r.error), r.status)
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
