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
import { cn } from '@/lib/utils'
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

interface TestInfo {
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
/** The stat rows: label, value, caption. */
const ROW = 'm-0 grid gap-x-7 gap-y-4.5 max-sm:grid-cols-2 max-sm:gap-x-5 max-sm:gap-y-3.5 [&>div]:grid [&>div]:min-w-0 [&>div]:content-start [&>div]:gap-0.5'
const DT = 'font-mono text-sm text-muted-foreground'
const DD = 'm-0 font-mono text-sm font-medium'
const NUM = 'm-0 font-display text-2xl leading-tight font-bold text-primary tabular-nums [text-shadow:var(--code-glow)]'
const NUM2 = 'm-0 font-display text-xl leading-tight font-bold tabular-nums [text-shadow:var(--code-glow)]'
const SUB = 'm-0 font-mono text-xs text-muted-foreground [contain:inline-size]'

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
    <div className="grid gap-6 px-6.5 pt-6.5 pb-5.5 max-sm:px-4 max-sm:py-5" data-results="">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-7 max-sm:grid-cols-1 max-sm:gap-4.5">
        <div className="grid content-start gap-3.5 max-sm:flex max-sm:flex-wrap max-sm:items-end max-sm:gap-x-7 max-sm:gap-y-2.5">
          <div className="grid">
            <span className="font-mono text-2xl leading-tight font-medium text-muted-foreground">wpm</span>
            <span className="font-display text-display font-bold text-primary tabular-nums [text-shadow:var(--code-glow)] max-sm:text-display-sm">{Math.round(r.wpm)}</span>
          </div>
          <div className="grid">
            <span className="font-mono text-2xl leading-tight font-medium text-muted-foreground">acc</span>
            <span className="font-display text-display font-bold text-primary tabular-nums [text-shadow:var(--code-glow)] max-sm:text-display-sm">{Math.round(r.accuracy)}%</span>
          </div>
          {isBest && <span className="justify-self-start rounded-full border border-current px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-success">New personal best</span>}
        </div>
        <div className="grid min-w-0 gap-1.5">
          <SpeedChart samples={r.samples} />
          <div className="flex justify-center gap-4 font-mono text-xs text-muted-foreground">
            <span>
              <i className="mr-1.5 inline-block w-3.5 border-t-2 border-primary align-middle" />
              wpm
            </span>
            <span>
              <i className="mr-1.5 inline-block w-3.5 border-t-2 border-muted-foreground align-middle" />
              raw
            </span>
            <span>
              <i className="mr-1.5 font-bold text-destructive not-italic">✕</i>
              errors
            </span>
          </div>
        </div>
      </div>

      {leaderboard && <LeaderboardLine view={leaderboard} onResubmit={onResubmit} />}

      <dl className={`${ROW} grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(max-content,1fr)_repeat(2,minmax(0,1fr))] md:max-lg:grid-cols-[minmax(0,1fr)_minmax(max-content,1fr)_repeat(2,minmax(0,1fr))]`}>
        <div className="max-sm:col-span-full md:max-lg:col-span-full">
          <dt className={DT}>test</dt>
          <dd className={`${DD} text-primary`}>
            {info.language} · {info.length}
          </dd>
          <dd className={SUB}>
            {info.snippet}
            {info.assists.length > 0 && ` · ${info.assists.join(' · ')}`}
          </dd>
        </div>
        <div>
          <dt className={DT}>raw</dt>
          <dd className={NUM}>{Math.round(r.rawWpm)}</dd>
        </div>
        <div>
          <dt className={DT}>
            characters
            <Explain name="characters" label="Typed right / wrong / from suggestions / auto-inserted" />
          </dt>
          <dd className={NUM}>
            {/* <wbr>: on the narrowest screens the count may break after a slash. */}
            {r.correct}/<wbr />
            {r.incorrect}/<wbr />
            {r.suggested}/<wbr />
            {r.autoInserted}
          </dd>
          <dd className={SUB}>right / wrong / suggested / auto</dd>
        </div>
        <div>
          <dt className={DT}>
            consistency
            <Explain name="consistency" label="How steady your per-second speed was" />
          </dt>
          <dd className={NUM}>
            {pct(r.consistency)}
          </dd>
          {r.consistency === null && <dd className={SUB}>needs 3s or more</dd>}
        </div>
        <div>
          <dt className={DT}>time</dt>
          <dd className={NUM}>{r.seconds < 10 ? r.seconds.toFixed(1) : Math.round(r.seconds)}s</dd>
          {r.pausedSeconds >= 0.5 && <dd className={SUB}>paused {Math.round(r.pausedSeconds)}s, not counted</dd>}
        </div>
      </dl>

      <dl className={`${ROW} grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)] border-t pt-4.5`}>
        <div>
          <dt className={DT}>
            code speed
            <Explain name="code speed" label="Every right character on screen, including suggested and auto-inserted text" />
          </dt>
          <dd className={NUM2}>
            {Math.round(r.codeWpm)} wpm
          </dd>
        </div>
        <div>
          <dt className={DT}>
            keys saved
            <Explain name="keys saved" label="Keystrokes saved by accepting suggestions" />
          </dt>
          <dd className={NUM2}>
            {r.keysSaved}
          </dd>
        </div>
        <div>
          <dt className={DT}>symbol accuracy</dt>
          <dd className={NUM2}>
            {pct(r.symbolAccuracy)}
            {r.symbolAccuracy !== null && <small className="font-mono text-sm font-normal text-muted-foreground [text-shadow:none]"> of {r.symbolTotal}</small>}
          </dd>
        </div>
        <div className="max-sm:col-span-full">
          <dt className={DT}>missed most</dt>
          <dd className="m-0 flex flex-wrap gap-1.5">
            {r.missed.length ? (
              r.missed.map(([c, n]) => (
                <span key={c} className="inline-flex items-baseline gap-1.5 rounded-md border border-b-3 bg-muted px-2 py-0.5 font-mono text-sm font-semibold">
                  {keyLabel(c)}
                  <small className="text-xs font-normal text-destructive">×{n}</small>
                </span>
              ))
            ) : (
              <span className="font-mono text-sm text-muted-foreground">nothing, clean run</span>
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
    <p className={cn('m-0 -mt-2 flex flex-wrap items-baseline gap-2.5 text-sm', tone === 'ok' && 'font-semibold text-success', tone === 'muted' && 'text-muted-foreground', tone === 'problem' && 'text-destructive')} role="status">
      {text}
      {(view.status === 'failed' || (view.status === 'rejected' && view.reason === 'turnstile')) && onResubmit && (
        <Button variant="link" size="sm" className="h-auto p-0" onPress={onResubmit}>
          Try again
        </Button>
      )}
    </p>
  )
}
