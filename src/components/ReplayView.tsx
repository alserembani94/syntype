import { useEffect, useMemo, useRef, useState } from 'react'
import type { Language, Snippet } from '../languages'
import type { LogEntry, TypingAids } from '../lib/runcore'
import { buildReplay, frameAt, type Replay } from '../lib/replay'
import { duration, speed as runSpeed } from '../lib/format'
import { PauseIcon, PlayIcon, XIcon } from 'lucide-react'
import { Choice } from '@/components/composites/choices'
import { Crumbs } from '@/components/composites/crumbs'
import { Tip } from '@/components/composites/tip'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { CodeView } from './CodeView'
import { Note, ViewHead } from './ViewParts'

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

const SPEEDS = (['0.5', '1', '2', '4'] as const).map((s) => ({ id: s, label: `${s}×` }))

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
  const when = new Date(run.finishedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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
    <section className="grid min-w-0 gap-4" aria-labelledby="replay-title">
      <ViewHead
        action={
          <Tip label="Close the replay" shortcut="Esc">
            <Button variant="outline" onPress={onClose}>
              <XIcon />
              Close
            </Button>
          </Tip>
        }
      >
        <Crumbs
          trail={crumbs.map((label, i) => ({ label, onPress: i === crumbs.length - 1 ? onClose : undefined }))}
          currentId="replay-title"
          current={`replay${by ? ` of ${by}` : ''} from ${when}`}
        />
      </ViewHead>
      <div className="pane replay" style={{ '--tab-size': lang.indentSize ?? 2 } as React.CSSProperties}>
        <div className="tabbar">
          <div className="tab">
            <span className="dot" />
            <span>{snippet.name} · replay</span>
          </div>
          <span className="lang">
            {runSpeed(run)}
          </span>
        </div>
        {replay === 'missing' ? (
          <div className="p-4">
            <Note title="No replay">This run’s keystrokes weren’t kept, so it can’t be replayed.</Note>
          </div>
        ) : frame && replay ? (
          <>
            <CodeView code={snippet.code} highlight={lang.highlight} run={frame.run} typing smoothCaret markSuggested />
            <div className="flex flex-wrap items-center gap-3 border-t bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
              <Tip label={playing ? 'Pause' : 'Play'}>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={playing ? 'Pause' : 'Play'}
                  onPress={() => {
                    if (!playing && t >= replay.duration) setT(0)
                    setPlaying(!playing)
                  }}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </Button>
              </Tip>
              <Choice label="Speed" options={SPEEDS} value={String(speed) as (typeof SPEEDS)[number]['id']} onChange={(v) => setSpeed(Number(v))} />
              <Slider
                aria-label="Position in the replay"
                className="min-w-32 flex-1"
                minValue={0}
                maxValue={Math.max(1, Math.round(replay.duration))}
                value={Math.round(t)}
                onChange={(v) => {
                  setPlaying(false)
                  setT(v as number)
                }}
              />
              <span className="tabular-nums">
                {duration(t / 1000)} / {duration(replay.duration / 1000)}
              </span>
            </div>
          </>
        ) : (
          <div className="min-h-48" aria-busy="true" aria-label="Loading the replay" />
        )}
      </div>
    </section>
  )
}
