import { useEffect, useMemo, useRef, useState } from 'react'
import type { Language, Snippet } from '../languages'
import type { LogEntry, TypingAids } from '../lib/runcore'
import { buildReplay, frameAt, type Replay } from '../lib/replay'
import { duration } from '../lib/board'
import { CodeView } from './CodeView'

interface Props {
  lang: Language
  snippet: Snippet
  /** The run's numbers, as shown above the replay. */
  run: { wpm: number; accuracy: number; finishedAt: string; aids: TypingAids }
  /** Its keystrokes, if they were kept. */
  loadLog: () => Promise<LogEntry[] | undefined>
  crumbs: string[]
  /** Who typed it, on a leaderboard. */
  by?: string
  onClose: () => void
}

const SPEEDS = [0.5, 1, 2, 4]

/** Plays a run back in the editor at its own pace, mistakes and all. */
export function ReplayView({ lang, snippet, run, loadLog, crumbs, by, onClose }: Props) {
  const [replay, setReplay] = useState<Replay | null | 'missing'>(null)
  const loadRef = useRef(loadLog)
  const { aids } = run
  useEffect(() => {
    let live = true
    loadRef
      .current()
      .catch(() => undefined)
      .then((log) => live && setReplay(log ? buildReplay(lang, snippet, aids, log) : 'missing'))
    return () => {
      live = false
    }
  }, [lang, snippet, aids])

  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const last = useRef<number | null>(null)

  useEffect(() => {
    if (!playing || !replay || replay === 'missing') return
    let id = 0
    const step = (now: number) => {
      const dt = last.current === null ? 0 : now - last.current
      last.current = now
      setT((prev) => {
        const next = Math.min(replay.duration, prev + dt * speed)
        if (next >= replay.duration) setPlaying(false)
        return next
      })
      id = requestAnimationFrame(step)
    }
    id = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(id)
      last.current = null
    }
  }, [playing, replay, speed])

  // Esc closes the replay, as it closes other views.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const frame = useMemo(() => (replay && replay !== 'missing' ? frameAt(replay, t) : null), [replay, t])

  return (
    <section className="runs" aria-labelledby="replay-title">
      <div className="runs-head">
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.join(' › ')} › <b id="replay-title">replay{by ? ` of ${by}` : ''} from {new Date(run.finishedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b>
        </nav>
        <button type="button" className="btn" onClick={onClose}>
          ✕ close
        </button>
      </div>
      <div className="pane replay" style={{ '--tab-size': lang.indentSize ?? 2 } as React.CSSProperties}>
        <div className="tabbar">
          <div className="tab">
            <span className="dot" />
            <span>{snippet.name} · replay</span>
          </div>
          <span className="lang">
            {Math.round(run.wpm)} wpm · {Math.round(run.accuracy)}%
          </span>
        </div>
        {replay === 'missing' ? (
          <p className="runs-note">This run’s keystrokes weren’t kept, so it can’t be replayed.</p>
        ) : frame && replay ? (
          <>
            <CodeView code={snippet.code} highlight={lang.highlight} run={frame.run} typing smoothCaret markSuggested />
            <div className="statusbar replay-controls">
              <button
                type="button"
                className="btn"
                aria-label={playing ? 'Pause' : 'Play'}
                onClick={() => {
                  if (!playing && t >= replay.duration) setT(0)
                  setPlaying(!playing)
                }}
              >
                {playing ? '❚❚' : '▶'}
              </button>
              <span className="speeds" role="group" aria-label="Speed">
                {SPEEDS.map((s) => (
                  <button key={s} type="button" className="chip" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                    {s}×
                  </button>
                ))}
              </span>
              <input
                className="scrub"
                type="range"
                min={0}
                max={Math.max(1, Math.round(replay.duration))}
                value={Math.round(t)}
                aria-label="Position in the replay"
                onChange={(e) => {
                  setPlaying(false)
                  setT(Number(e.target.value))
                }}
              />
              <span className="time">
                {duration(t / 1000)} / {duration(replay.duration / 1000)}
              </span>
            </div>
          </>
        ) : (
          <div aria-busy="true" />
        )}
      </div>
    </section>
  )
}
