import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { tokenize } from '../lib/tokenize'
import type { Run } from '../lib/engine'
import type { HighlightRules } from '../languages'
import type { SuggestState } from '../hooks/useTypingTest'
import { SuggestBox } from './SuggestBox'

interface Props {
  code: string
  highlight: HighlightRules
  run: Run
  typing: boolean
  /** Omitted for a read-only view (a replay): no input, no focus overlay. */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  onMobileInput?: (text: string, deleted: boolean) => void
  suggest?: SuggestState | null
  onAccept?: (index: number) => void
  /** Shown over the code when keys can't reach the game. */
  overlay?: 'start' | 'paused' | null
  touch?: boolean
  /**
   * A caret that glides between letters instead of jumping. When it moves
   * several letters at once (an accepted suggestion), a comet tail and a flash
   * show the stretch it crossed.
   */
  smoothCaret?: boolean
  /** Keep text that came from suggestions marked, as Review does (replays). */
  markSuggested?: boolean
}

/** Kept in the hidden textarea so a mobile Backspace still fires an input event. */
const SENTINEL = ' '

/**
 * The snippet as the player types it. Rendered line by line, each line
 * memoised: a keystroke changes one or two characters, so only the caret's
 * line (and the one it left) re-renders, not every character of the snippet.
 * CodeView itself is memoised too, so the once-a-second clock tick skips it.
 */
export const CodeView = memo(function CodeView({
  code,
  highlight,
  run,
  typing,
  inputRef,
  onMobileInput,
  suggest = null,
  onAccept = () => {},
  overlay = null,
  touch = false,
  smoothCaret = false,
  markSuggested = false,
}: Props) {
  const readOnly = !inputRef
  const classes = useMemo(() => tokenize(code, highlight), [code, highlight])
  const lines = useMemo(() => lineRanges(code), [code])
  const lineCount = lines.length
  const scrollerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const codeRef = useRef<HTMLPreElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)

  // Keep the caret's line in view.
  useLayoutEffect(() => {
    const sc = scrollerRef.current
    const el = caretRef.current
    if (!sc || !el) return
    const top = el.offsetTop
    if (top < sc.scrollTop + 20) sc.scrollTop = top - 40
    else if (top + el.offsetHeight > sc.scrollTop + sc.clientHeight - 20) sc.scrollTop = top - sc.clientHeight / 2
  }, [run.pos])

  useLayoutEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0
  }, [code])

  // The smooth caret, its comet tail and the flash: moved here directly, not
  // re-rendered, so they never slow typing down.
  const barRef = useRef<HTMLSpanElement>(null)
  const trailRef = useRef<HTMLSpanElement>(null)
  const flashRef = useRef<HTMLSpanElement>(null)
  const last = useRef<{ code: string; pos: number; x: number; y: number } | null>(null)
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined)
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!smoothCaret || !bar) return
    const el = caretRef.current
    if (!el) {
      bar.style.opacity = '0'
      last.current = null
      return
    }
    const x = el.offsetLeft
    const y = el.offsetTop
    const h = el.offsetHeight
    const prev = last.current?.code === code ? last.current : null
    // Glide along a line; jump to a new line rather than slide diagonally across the text.
    const sameLine = !!prev && Math.abs(prev.y - y) < 1
    bar.style.transition = sameLine ? '' : 'none'
    bar.style.opacity = '1'
    bar.style.height = `${h}px`
    bar.style.transform = `translate(${x}px, ${y}px)`
    // No blinking while it moves, as in an editor.
    bar.classList.add('moving')
    clearTimeout(settle.current)
    settle.current = setTimeout(() => bar.classList.remove('moving'), 500)

    if (prev && sameLine && run.pos - prev.pos >= 2 && x > prev.x) {
      const replay = (node: HTMLSpanElement | null) => {
        if (!node) return
        node.style.transform = `translate(${prev.x}px, ${y}px)`
        node.style.width = `${x - prev.x}px`
        node.style.height = `${h}px`
        node.classList.remove('show')
        void node.offsetWidth // restart the animation
        node.classList.add('show')
      }
      replay(trailRef.current)
      // The flash only for text a suggestion put there.
      if (run.completed.slice(prev.pos, run.pos).some(Boolean)) replay(flashRef.current)
    }
    last.current = { code, pos: run.pos, x, y }
  }, [run.pos, run.completed, code, smoothCaret])
  useLayoutEffect(() => () => clearTimeout(settle.current), [])

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    const v = ta.value
    onMobileInput?.(v.slice(SENTINEL.length).replace(/\r/g, '\n'), v.length < SENTINEL.length)
    ta.value = SENTINEL
    ta.setSelectionRange(1, 1)
  }

  return (
    <div
      ref={editorRef}
      className={`editor${typing ? ' typing' : ''}${overlay ? ' unfocused' : ''}${smoothCaret ? ' smooth' : ''}`}
      onClick={() => inputRef?.current?.focus({ preventScroll: true })}>
      {!readOnly && (
        <textarea
          ref={inputRef}
          id="type-input"
          className="hidden-input"
          // The app's own key handler types for it (src/lib/keyTarget.ts leaves it to the app).
          data-typing-input=""
          defaultValue={SENTINEL}
          onInput={handleInput}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Type the code here"
        />
      )}
      <div className="scroller" ref={scrollerRef}>
        <pre className="gutter" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')}
        </pre>
        <pre className="code" key={code} ref={codeRef}>
          {/* Inside the code, so they share its coordinates (each letter's offsetLeft/Top). */}
          {smoothCaret && (
            <>
              <span ref={flashRef} className="caret-flash" aria-hidden="true" />
              <span ref={trailRef} className="caret-trail" aria-hidden="true" />
              <span ref={barRef} className="caret-bar" aria-hidden="true" />
            </>
          )}
          {lines.map(([start, end]) => (
            <Line key={start} run={run} start={start} end={end} classes={classes} markSuggested={markSuggested} caretRef={caretRef} />
          ))}
        </pre>
      </div>
      {overlay && (
        <button type="button" className="focus-overlay" onClick={() => inputRef?.current?.focus({ preventScroll: true })}>
          <strong>{overlay === 'paused' ? 'Paused' : touch ? 'Tap to start typing' : 'Click here to start typing'}</strong>
          <span>
            {overlay === 'paused'
              ? `${touch ? 'Tap' : 'Click'} to continue. Time away isn't counted.`
              : 'The clock starts on your first key.'}
          </span>
        </button>
      )}
      {suggest && !overlay && (
        <SuggestBox
          suggest={suggest}
          editorRef={editorRef}
          scrollerRef={scrollerRef}
          codeRef={codeRef}
          onAccept={onAccept}
        />
      )}
    </div>
  )
})

/** [first, last] character index of each line; a line's last character is its newline, if it has one. */
function lineRanges(code: string): [number, number][] {
  const chars = [...code]
  const out: [number, number][] = []
  let start = 0
  chars.forEach((ch, i) => {
    if (ch === '\n') {
      out.push([start, i])
      start = i + 1
    }
  })
  out.push([start, chars.length - 1])
  return out
}

interface LineProps {
  run: Run
  start: number
  end: number
  classes: string[]
  markSuggested: boolean
  caretRef: React.RefObject<HTMLSpanElement | null>
}

const Line = memo(
  function Line({ run, start, end, classes, markSuggested, caretRef }: LineProps) {
    const out: React.ReactNode[] = []
    for (let i = start; i <= end; i++) {
      const ch = run.chars[i]
      const state = run.states[i]
      const cur = i === run.pos
      const sug = markSuggested && run.completed[i] && state === 'ok'
      const cls = ['c', classes[i], state, ch === '\n' && 'nl', cur && 'cur', sug && 'sug'].filter(Boolean).join(' ')
      out.push(
        ch === '\n' ? (
          <span key={i}>
            <span className={cls} ref={cur ? caretRef : undefined}>
              ↵
            </span>
            {'\n'}
          </span>
        ) : (
          <span key={i} className={cls} ref={cur ? caretRef : undefined}>
            {ch}
          </span>
        ),
      )
    }
    return <>{out}</>
  },
  // Re-render only when something this line shows changed: a character's state, whether it
  // came from a suggestion, or the caret arriving or leaving.
  (a, b) => {
    if (a.start !== b.start || a.end !== b.end || a.classes !== b.classes || a.markSuggested !== b.markSuggested || a.run.chars !== b.run.chars) return false
    const has = (pos: number) => pos >= a.start && pos <= a.end
    if ((has(a.run.pos) || has(b.run.pos)) && a.run.pos !== b.run.pos) return false
    for (let i = a.start; i <= a.end; i++) {
      if (a.run.states[i] !== b.run.states[i] || a.run.completed[i] !== b.run.completed[i]) return false
    }
    return true
  },
)
