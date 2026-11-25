import { useEffect, useRef } from 'react'
import type { Result } from '../lib/stats'
import { SpeedChart } from './SpeedChart'

interface Props {
  result: Result
  isBest: boolean
  onNext: () => void
  onRetry: () => void
}

const keyLabel = (c: string) => (c === '\n' ? 'enter' : c === ' ' ? 'space' : c)

export function Results({ result: r, isBest, onNext, onRetry }: Props) {
  const nextRef = useRef<HTMLButtonElement>(null)
  useEffect(() => nextRef.current?.focus({ preventScroll: true }), [])

  return (
    <div className="results">
      <div className="r-top">
        <div className="big">
          <span className="k">wpm</span>
          <span className="v">{Math.round(r.wpm)}</span>
        </div>
        <div className="big sm">
          <span className="k">accuracy</span>
          <span className="v">{Math.round(r.accuracy)}%</span>
        </div>
        {isBest && <span className="pb">New personal best</span>}
      </div>

      <div className="stats">
        <div className="stat">
          <span className="k">raw wpm</span>
          <span className="v">{Math.round(r.rawWpm)}</span>
        </div>
        <div className="stat">
          <span className="k">code speed</span>
          <span className="v" title="Every right character on screen, including suggested and auto-inserted ones">
            {Math.round(r.codeWpm)}
            <small> wpm</small>
          </span>
        </div>
        <div className="stat">
          <span className="k">time</span>
          <span className="v">{r.seconds.toFixed(1)}s</span>
        </div>
        <div className="stat">
          <span className="k">chars</span>
          <span className="v">
            {r.correct}
            <small> ok / </small>
            {r.incorrect}
            <small> wrong</small>
          </span>
        </div>
        <div className="stat">
          <span className="k">symbol accuracy</span>
          <span className="v">
            {r.symbolAccuracy === null ? (
              '—'
            ) : (
              <>
                {Math.round(r.symbolAccuracy)}%<small> of {r.symbolTotal}</small>
              </>
            )}
          </span>
        </div>
        <div className="stat">
          <span className="k">keys saved</span>
          <span className="v" title="Keystrokes saved by accepting suggestions">
            {r.keysSaved}
          </span>
        </div>
      </div>

      <div className="chart-box">
        <h3>
          speed over time
          <span className="legend">
            <span>
              <i />
              wpm
            </span>
            <span>
              <i className="raw" />
              raw
            </span>
            <span>
              <i className="er" />
              errors
            </span>
          </span>
        </h3>
        <SpeedChart samples={r.samples} />
      </div>

      <div className="missed">
        <h3>keys you missed most</h3>
        <div className="keys">
          {r.missed.length ? (
            r.missed.map(([c, n]) => (
              <span key={c} className="keycap">
                {keyLabel(c)}
                <small>×{n}</small>
              </span>
            ))
          ) : (
            <span className="none">None. Clean run.</span>
          )}
        </div>
      </div>

      <div className="actions">
        <button ref={nextRef} className="btn primary" onClick={onNext}>
          Next snippet
        </button>
        <button className="btn" onClick={onRetry}>
          Retry this one
        </button>
        <span className="hint">
          <kbd>enter</kbd> next · <kbd>r</kbd> retry
        </span>
      </div>
    </div>
  )
}
