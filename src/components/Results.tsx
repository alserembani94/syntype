import { useEffect, useRef, useState } from 'react'
import type { Result } from '../lib/stats'
import type { Run } from '../lib/engine'
import type { HighlightRules } from '../languages'
import { SpeedChart } from './SpeedChart'
import { Review } from './Review'

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

export function Results({ result: r, isBest, info, run, highlight, onNext, onRetry }: Props) {
  const nextRef = useRef<HTMLButtonElement>(null)
  const [reviewing, setReviewing] = useState(false)
  useEffect(() => nextRef.current?.focus({ preventScroll: true }), [])

  // V toggles the review; Enter and R are handled by the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
          <dt>characters</dt>
          <dd className="num" title="typed right / wrong / from suggestions / auto-inserted">
            {r.correct}/{r.incorrect}/{r.suggested}/{r.autoInserted}
          </dd>
          <dd className="sub">right / wrong / suggested / auto</dd>
        </div>
        <div>
          <dt>consistency</dt>
          <dd className="num" title="How steady your per-second speed was">
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
          <dt>code speed</dt>
          <dd className="num" title="Every right character on screen, including suggested and auto-inserted text">
            {Math.round(r.codeWpm)} wpm
          </dd>
        </div>
        <div>
          <dt>keys saved</dt>
          <dd className="num" title="Keystrokes saved by accepting suggestions">
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

      <div className="r-actions">
        <button ref={nextRef} className="icon-btn" onClick={onNext} aria-label="Next snippet" title="Next snippet">
          <Icon d={ICONS.next} />
        </button>
        <button className="icon-btn" onClick={onRetry} aria-label="Retry this snippet" title="Retry this snippet">
          <Icon d={ICONS.retry} />
        </button>
        <button
          className="icon-btn"
          onClick={() => setReviewing((v) => !v)}
          aria-pressed={reviewing}
          aria-label="Review your code"
          title="Review your code"
        >
          <Icon d={ICONS.review} />
        </button>
      </div>
      <p className="r-hints">
        <kbd>enter</kbd> next · <kbd>r</kbd> retry · <kbd>v</kbd> review
      </p>
    </div>
  )
}
