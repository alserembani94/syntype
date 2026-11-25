/**
 * Sending finished runs to the leaderboard (docs/leaderboard.md, "Submitting
 * a run"; the server side is worker/lib/runs.ts). A signed-in player with a
 * leaderboard name asks for a run token when a run starts, and submits the
 * run's record with it when it finishes.
 */
import type { RunRecord } from './runlog'

/** What happened to a run sent to the leaderboard, as kept with it in local history. */
export type Submission =
  | { status: 'accepted'; at: string; runId: string; rank: number; best: boolean; bestForAids: boolean }
  | { status: 'rejected'; at: string; reason: string; message: string }
  | { status: 'failed'; at: string; message: string }

/** A run token for the snippet with this fingerprint, or null if the leaderboard can't be reached. */
export async function requestRunToken(fingerprint: string): Promise<string | null> {
  try {
    const res = await fetch('/api/runs/start', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint }),
    })
    if (!res.ok) return null
    return ((await res.json()) as { token?: string }).token ?? null
  } catch {
    return null
  }
}

export async function submitRun(record: RunRecord, token: string, turnstile: string): Promise<Submission> {
  const at = new Date().toISOString()
  try {
    const res = await fetch('/api/runs', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        aids: record.aids,
        log: record.log,
        result: { wpm: record.wpm, rawWpm: record.rawWpm, accuracy: record.accuracy, seconds: record.seconds },
        turnstile,
      }),
    })
    const body = (await res.json().catch(() => null)) as
      | { accepted: true; runId: string; rank: number; best: boolean; bestForAids: boolean }
      | { accepted: false; reason?: string; error?: string }
      | null
    if (body?.accepted) return { status: 'accepted', at, runId: body.runId, rank: body.rank, best: body.best, bestForAids: body.bestForAids }
    if (body && 'reason' in body && body.reason && res.status !== 400 && res.status !== 401) {
      return { status: 'rejected', at, reason: body.reason, message: body.error ?? 'The run wasn’t accepted.' }
    }
    return { status: 'failed', at, message: body?.error ?? `The leaderboard answered ${res.status}.` }
  } catch {
    return { status: 'failed', at, message: 'The leaderboard couldn’t be reached.' }
  }
}
