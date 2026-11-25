import { useLayoutEffect, useMemo, useRef } from 'react'
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

export function CodeView({
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
  const lineCount = useMemo(() => code.split('\n').length, [code])
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
          {run.chars.map((ch, i) => {
            const state = run.states[i]
            const cur = i === run.pos
            const sug = markSuggested && run.completed[i] && state === 'ok'
            const cls = ['c', classes[i], state, ch === '\n' && 'nl', cur && 'cur', sug && 'sug'].filter(Boolean).join(' ')
            return ch === '\n' ? (
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
            )
          })}
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
}
