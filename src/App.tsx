import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { pickSnippet, type LengthFilter, type Snippet } from './data/snippets'
import { useTypingTest } from './hooks/useTypingTest'
import { accuracy, MIN_ACCURACY_FOR_BEST, summarize, wpm } from './lib/stats'
import { caretPosition, counts } from './lib/engine'
import { load, save } from './lib/storage'
import { CodeView } from './components/CodeView'
import { ConfigBar } from './components/ConfigBar'
import { Results } from './components/Results'

type Bests = Partial<Record<LengthFilter, number>>

export default function App() {
  const [length, setLength] = useState<LengthFilter>(() => load('length', 'medium'))
  const [autoIndent, setAutoIndent] = useState(() => load('autoIndent', true))
  const [bests, setBests] = useState<Bests>(() => load('bests', {}))
  const [firstSnippet] = useState(() => pickSnippet(length))
  const { state, elapsed, load: loadSnippet, type, back } = useTypingTest(firstSnippet, autoIndent)
  const [bestAtStart, setBestAtStart] = useState(() => bests[length] ?? 0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { run, phase, snippet } = state

  const result = useMemo(
    () => (phase === 'done' ? summarize(run, elapsed, state.samples) : null),
    [phase, run, elapsed, state.samples],
  )
  const isBest = !!result && result.wpm > bestAtStart && result.accuracy >= MIN_ACCURACY_FOR_BEST
  // Bests including the run that just finished.
  const currentBests = useMemo<Bests>(
    () => (isBest && result ? { ...bests, [length]: result.wpm } : bests),
    [isBest, result, bests, length],
  )

  useEffect(() => {
    if (isBest) save('bests', currentBests)
  }, [isBest, currentBests])

  const start = useCallback(
    (s: Snippet, opts: { length?: LengthFilter; autoIndent?: boolean } = {}) => {
      const len = opts.length ?? length
      setBests(currentBests)
      setBestAtStart(currentBests[len] ?? 0)
      loadSnippet(s, opts.autoIndent ?? autoIndent)
      inputRef.current?.focus({ preventScroll: true })
    },
    [length, autoIndent, currentBests, loadSnippet],
  )
  const next = useCallback(() => start(pickSnippet(length, snippet.name)), [start, length, snippet.name])
  const retry = useCallback(() => start(snippet), [start, snippet])

  // Keyboard: the whole page listens, so typing works without clicking first.
  const latest = useRef({ phase, autoIndent, next, retry, type, back })
  useLayoutEffect(() => {
    latest.current = { phase, autoIndent, next, retry, type, back }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = latest.current
      const onButton = e.target instanceof Element && e.target.closest('button')
      if (onButton && (e.key === 'Enter' || e.key === ' ')) return

      if (s.phase === 'done') {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          s.next()
        } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          s.retry()
        }
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        s.next()
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        s.back(e.ctrlKey || e.altKey || e.metaKey)
      } else if ((e.ctrlKey && !e.altKey) || e.metaKey) {
        return // leave browser shortcuts alone
      } else if (e.key === 'Enter') {
        e.preventDefault()
        s.type('\n')
      } else if (e.key === 'Tab') {
        e.preventDefault()
        if (!s.autoIndent) {
          s.type(' ')
          s.type(' ')
        }
      } else if (e.key.length === 1) {
        e.preventDefault()
        s.type(e.key)
      } else return
      inputRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => inputRef.current?.focus({ preventScroll: true }), [])

  const onMobileInput = (text: string, deleted: boolean) => {
    if (deleted) back(false)
    for (const ch of text) type(ch)
  }

  const changeLength = (l: LengthFilter) => {
    setLength(l)
    save('length', l)
    start(pickSnippet(l), { length: l })
  }
  const toggleIndent = () => {
    const v = !autoIndent
    setAutoIndent(v)
    save('autoIndent', v)
    start(snippet, { autoIndent: v })
  }

  const liveWpm = Math.round(wpm(counts(run).correct, elapsed))
  const { line, col } = caretPosition(run)
  const best = currentBests[length]

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <h1>
            Keystroke<span>.js</span>
          </h1>
          <small>typing speed, measured in code</small>
        </div>
        <ConfigBar length={length} autoIndent={autoIndent} onLength={changeLength} onToggleIndent={toggleIndent} />
      </header>

      <div className="live" style={{ visibility: phase === 'done' ? 'hidden' : undefined }}>
        <span>
          <b>{Math.floor(elapsed)}</b> s
        </span>
        <span>
          <b>{liveWpm}</b> wpm
        </span>
        <span>
          <b>{Math.round(accuracy(run))}</b> %
        </span>
        <span className="hint">
          <kbd>esc</kbd> new snippet · timer starts on your first key
        </span>
      </div>

      <section className="pane">
        <div className="tabbar">
          <div className="tab">
            <span className="dot" />
            <span>{snippet.name}</span>
          </div>
          <span className="lang">JavaScript</span>
        </div>

        {result ? (
          <Results key={state.runId} result={result} isBest={isBest} onNext={next} onRetry={retry} />
        ) : (
          <CodeView
            code={snippet.code}
            run={run}
            typing={phase === 'running'}
            inputRef={inputRef}
            onMobileInput={onMobileInput}
          />
        )}

        <div className="statusbar">
          <span>
            Ln {line}, Col {col}
          </span>
          <span>
            {run.pos} / {run.chars.length} chars
          </span>
          <span className="push">
            best ({length}): {best ? `${Math.round(best)} wpm` : '—'}
          </span>
          <span>Spaces: 2</span>
          <span>UTF-8</span>
        </div>
      </section>

      <footer>
        <span>WPM counts correct characters ÷ 5 per minute. Auto-skipped indentation is not counted.</span>
        <span>
          <kbd>ctrl</kbd>+<kbd>⌫</kbd> deletes a word
        </span>
      </footer>
    </div>
  )
}
