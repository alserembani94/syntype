import { useCallback, useEffect, useRef, useState } from 'react'
import type { Player } from '../lib/account'
import type { History } from '../lib/history'
import { fingerprint } from '../lib/runcore'
import type { RunRecord } from '../lib/runlog'
import { MIN_ACCURACY_FOR_BEST } from '../lib/stats'
import { requestRunToken, submitRun, type Submission } from '../lib/submit'
import { turnstileToken } from '../lib/turnstile'
import type { TestState } from '../lib/typing'

/** What the results screen says about the leaderboard. */
export type SubmitView =
  | { status: 'sending' }
  | { status: 'unnamed' }
  | { status: 'not-counted' }
  | Submission

/**
 * Sends a signed-in player's finished runs to the leaderboard: a run token
 * when the run starts, the run when it finishes, and its outcome kept with
 * the run in local history. Nothing happens for players who aren't signed in.
 */
export function useSubmission(player: Player | null, siteKey: string | null, state: TestState, history: Promise<History | null>) {
  const [views, setViews] = useState<{ runId: number; view: SubmitView } | null>(null)
  const token = useRef<{ runId: number; token: Promise<string | null> } | null>(null)
  const pending = useRef<{ runId: number; record: RunRecord } | null>(null)
  const canSubmit = !!player?.name && !!siteKey

  // A token as the run starts: the server notes the time, to check the run took as long as it says.
  const { phase, runId, snippet } = state
  useEffect(() => {
    if (phase !== 'running' || !canSubmit || token.current?.runId === runId) return
    token.current = { runId, token: fingerprint(snippet.code).then(requestRunToken) }
  }, [phase, runId, snippet, canSubmit])

  const send = useCallback(
    async (runId: number, record: RunRecord) => {
      const t = token.current?.runId === runId ? await token.current.token : null
      setViews({ runId, view: { status: 'sending' } })
      let outcome: Submission
      if (!t) outcome = { status: 'failed', at: new Date().toISOString(), message: 'The leaderboard couldn’t be reached when the run started.' }
      else {
        try {
          outcome = await submitRun(record, t, await turnstileToken(siteKey!))
        } catch (err) {
          outcome = { status: 'failed', at: new Date().toISOString(), message: err instanceof Error ? err.message : 'Turnstile failed.' }
        }
      }
      setViews((v) => (v?.runId === runId ? { runId, view: outcome } : v))
      await (await history)?.setSubmission(record.id, outcome)
    },
    [siteKey, history],
  )

  /** Called with each finished run's record. */
  const submit = useCallback(
    (runId: number, record: RunRecord) => {
      if (!player) return
      if (!player.name) return setViews({ runId, view: { status: 'unnamed' } })
      if (!canSubmit) return
      if (record.accuracy < MIN_ACCURACY_FOR_BEST) return setViews({ runId, view: { status: 'not-counted' } })
      pending.current = { runId, record }
      void send(runId, record)
    },
    [player, canSubmit, send],
  )

  /** Tries again after the leaderboard couldn't be reached (the token stays good for a while). */
  const retry = useCallback(() => {
    if (pending.current) void send(pending.current.runId, pending.current.record)
  }, [send])

  return { view: views?.runId === state.runId ? views.view : null, submit, retry }
}
