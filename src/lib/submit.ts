/**
 * Sending finished runs to the leaderboard (docs/leaderboard.md, "Submitting
 * a run"; the server side is worker/lib/runs.ts). A signed-in player with a
 * leaderboard name asks for a run token when a run starts, and submits the
 * run's record with it when it finishes.
 */
import type { RunRecord } from './runlog'
import type { SubmittedRun } from './apiTypes'
import { api } from './http'

/** What happened to a run sent to the leaderboard, as kept with it in local history. */
export type Submission =
  | { status: 'accepted'; at: string; runId: string; rank: number; best: boolean; bestForAids: boolean }
  | { status: 'rejected'; at: string; reason: string; message: string }
  | { status: 'failed'; at: string; message: string }

/** A run token for the snippet with this fingerprint, or null if the leaderboard can't be reached. */
export async function requestRunToken(fingerprint: string): Promise<string | null> {
  const r = await api<{ token: string }>('/api/runs/start', { body: { fingerprint } })
  return r.ok ? r.body.token : null
}

export async function submitRun(record: RunRecord, token: string, turnstile: string): Promise<Submission> {
  const at = new Date().toISOString()
  const r = await api<{ accepted: true } & SubmittedRun>('/api/runs', {
    body: {
      token,
      aids: record.aids,
      log: record.log,
      result: { wpm: record.wpm, rawWpm: record.rawWpm, accuracy: record.accuracy, seconds: record.seconds },
      turnstile,
    },
  })
  if (r.ok) return { status: 'accepted', at, runId: r.body.runId, rank: r.body.rank, best: r.body.best, bestForAids: r.body.bestForAids }
  // A run the checks turned away; 400 and 401 are a broken request or an ended session instead.
  if (r.body?.reason && r.status !== 400 && r.status !== 401) return { status: 'rejected', at, reason: r.body.reason, message: r.body.error ?? 'The run wasn’t accepted.' }
  return { status: 'failed', at, message: r.status === 0 ? 'The leaderboard couldn’t be reached.' : (r.body?.error ?? `The leaderboard answered ${r.status}.`) }
}
