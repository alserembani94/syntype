import type { SubmitView } from '../hooks/useSubmission'
import { useEffect, useRef, useState } from 'react'
import type { Result } from '../lib/stats'
import type { Run } from '../lib/engine'
import type { HighlightRules } from '../languages'
import { SpeedChart } from './SpeedChart'
import { Review } from './Review'
import { AdSlot } from './AdSlot'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Toggle } from '@/components/ui/toggle'
import { Tip } from '@/components/composites/tip'
import { InfoIcon } from 'lucide-react'

/** What a stat means, in a tooltip on a small info button: reachable by keyboard and touch, unlike a title. */
function Explain({ name, label }: { name: string; label: string }) {
  return (
    <Tip label={label}>
      <Button variant="ghost" size="icon-xs" className="ml-0.5 size-4 align-[-2px] text-muted-foreground" aria-label={`About ${name}`}>
        <InfoIcon />
      </Button>
    </Tip>
  )
}

export interface TestInfo {
  language: string
  length: string
  snippet: string
  assists: string[]
}

interface Props {
  result: Result
  isBest: boolean
  info: TestInfo
  run: Run
  highlight: HighlightRules
  onNext: () => void
  onRetry: () => void
  /** What happened on the leaderboard, for signed-in players. */
  leaderboard?: SubmitView | null
  onResubmit?: () => void
}

const keyLabel = (c: string) => (c === '\n' ? 'enter' : c === ' ' ? 'space' : c)
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`)

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const ICONS = {
  next: 'M9 5l7 7-7 7',
  retry: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5',
  review: 'M4 6h16M4 12h16M4 18h10',
}

export function Results({ result: r, isBest, info, run, highlight, onNext, onRetry, leaderboard, onResubmit }: Props) {
  const nextRef = useRef<HTMLButtonElement>(null)
  const [reviewing, setReviewing] = useState(false)
  useEffect(() => nextRef.current?.focus({ preventScroll: true }), [])

  // V toggles the review; Enter and R are handled by the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return
      if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setReviewing((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="results">
      <div className="r-hero">
        <div className="r-main">
          <div className="big">
            <span className="k">wpm</span>
            <span className="v">{Math.round(r.wpm)}</span>
          </div>
          <div className="big">
            <span className="k">acc</span>
            <span className="v">{Math.round(r.accuracy)}%</span>
          </div>
          {isBest && <span className="pb">New personal best</span>}
        </div>
        <div className="r-chart">
          <SpeedChart samples={r.samples} />
          <div className="legend">
            <span>
              <i className="wpm" />
              wpm
            </span>
            <span>
              <i className="raw" />
              raw
            </span>
            <span>
              <i className="er">✕</i>
              errors
            </span>
          </div>
        </div>
      </div>

      {leaderboard && <LeaderboardLine view={leaderboard} onResubmit={onResubmit} />}

      <dl className="r-row">
        <div className="test">
          <dt>test</dt>
          <dd>
            {info.language} · {info.length}
          </dd>
          <dd className="sub">
            {info.snippet}
            {info.assists.length > 0 && ` · ${info.assists.join(' · ')}`}
          </dd>
        </div>
        <div>
          <dt>raw</dt>
          <dd className="num">{Math.round(r.rawWpm)}</dd>
        </div>
        <div>
          <dt>
            characters
            <Explain name="characters" label="Typed right / wrong / from suggestions / auto-inserted" />
          </dt>
          <dd className="num">
            {/* <wbr>: on the narrowest screens the count may break after a slash. */}
            {r.correct}/<wbr />
            {r.incorrect}/<wbr />
            {r.suggested}/<wbr />
            {r.autoInserted}
          </dd>
          <dd className="sub">right / wrong / suggested / auto</dd>
        </div>
        <div>
          <dt>
            consistency
            <Explain name="consistency" label="How steady your per-second speed was" />
          </dt>
          <dd className="num">
            {pct(r.consistency)}
          </dd>
          {r.consistency === null && <dd className="sub">needs 3s or more</dd>}
        </div>
        <div>
          <dt>time</dt>
          <dd className="num">{r.seconds < 10 ? r.seconds.toFixed(1) : Math.round(r.seconds)}s</dd>
          {r.pausedSeconds >= 0.5 && <dd className="sub">paused {Math.round(r.pausedSeconds)}s, not counted</dd>}
        </div>
      </dl>

      <dl className="r-row secondary">
        <div>
          <dt>
            code speed
            <Explain name="code speed" label="Every right character on screen, including suggested and auto-inserted text" />
          </dt>
          <dd className="num">
            {Math.round(r.codeWpm)} wpm
          </dd>
        </div>
        <div>
          <dt>
            keys saved
            <Explain name="keys saved" label="Keystrokes saved by accepting suggestions" />
          </dt>
          <dd className="num">
            {r.keysSaved}
          </dd>
        </div>
        <div>
          <dt>symbol accuracy</dt>
          <dd className="num">
            {pct(r.symbolAccuracy)}
            {r.symbolAccuracy !== null && <small> of {r.symbolTotal}</small>}
          </dd>
        </div>
        <div className="missed">
          <dt>missed most</dt>
          <dd className="keys">
            {r.missed.length ? (
              r.missed.map(([c, n]) => (
                <span key={c} className="keycap">
                  {keyLabel(c)}
                  <small>×{n}</small>
                </span>
              ))
            ) : (
              <span className="none">nothing, clean run</span>
            )}
          </dd>
        </div>
      </dl>

      {reviewing && <Review run={run} highlight={highlight} />}

      <div className="flex justify-center gap-4">
        <Tip label="Next snippet" shortcut="Enter">
          <Button ref={nextRef} variant="ghost" size="icon-lg" aria-label="Next snippet" onPress={onNext}>
            <Icon d={ICONS.next} />
          </Button>
        </Tip>
        <Tip label="Retry this snippet" shortcut="R">
          <Button variant="ghost" size="icon-lg" aria-label="Retry this snippet" onPress={onRetry}>
            <Icon d={ICONS.retry} />
          </Button>
        </Tip>
        <Tip label="Review your code" shortcut="V">
          <Toggle size="lg" className="aria-pressed:bg-accent aria-pressed:text-primary data-selected:bg-accent data-selected:text-primary" aria-label="Review your code" isSelected={reviewing} onChange={setReviewing}>
            <Icon d={ICONS.review} />
          </Toggle>
        </Tip>
      </div>
      <p className="m-0 -mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground max-sm:hidden">
        <Kbd>Enter</Kbd> next · <Kbd>R</Kbd> retry · <Kbd>V</Kbd> review
      </p>
      {/* Below the actions, so the stats and buttons never move when it fills. */}
      <AdSlot slot="results" />
    </div>
  )
}

/** One line on what the leaderboard made of the run. */
function LeaderboardLine({ view, onResubmit }: { view: SubmitView; onResubmit?: () => void }) {
  const [text, tone] = ((): [string, 'ok' | 'muted' | 'problem'] => {
    switch (view.status) {
      case 'sending':
        return ['Sending to the leaderboard…', 'muted']
      case 'unnamed':
        return ['Choose your leaderboard name (top right) to put your runs on the leaderboard.', 'muted']
      case 'not-counted':
        return ['Runs under 75% accuracy don’t go on the leaderboard.', 'muted']
      case 'accepted':
        return view.best ? [`New best on this snippet’s leaderboard: #${view.rank}`, 'ok'] : [`Your best on this snippet stays at #${view.rank} on the leaderboard.`, 'muted']
      case 'rejected':
        return [`Not on the leaderboard: ${view.message}`, 'problem']
      case 'failed':
        return [`Couldn’t send to the leaderboard. ${view.message}`, 'problem']
    }
  })()
  return (
    <p className={`r-board ${tone}`} role="status">
      {text}
      {(view.status === 'failed' || (view.status === 'rejected' && view.reason === 'turnstile')) && onResubmit && (
        <button type="button" className="link" onClick={onResubmit}>
          Try again
        </button>
      )}
    </p>
  )
}
