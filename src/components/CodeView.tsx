import { useLayoutEffect, useMemo, useRef } from 'react'
import { tokenize } from '../lib/tokenize'
import type { Run } from '../lib/engine'

interface Props {
  code: string
  run: Run
  typing: boolean
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  onMobileInput: (text: string, deleted: boolean) => void
}

/** Kept in the hidden textarea so a mobile Backspace still fires an input event. */
const SENTINEL = ' '

export function CodeView({ code, run, typing, inputRef, onMobileInput }: Props) {
  const classes = useMemo(() => tokenize(code), [code])
  const lineCount = useMemo(() => code.split('\n').length, [code])
  const scrollerRef = useRef<HTMLDivElement>(null)
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

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    const v = ta.value
    onMobileInput(v.slice(SENTINEL.length).replace(/\r/g, '\n'), v.length < SENTINEL.length)
    ta.value = SENTINEL
    ta.setSelectionRange(1, 1)
  }

  return (
    <div className={`editor${typing ? ' typing' : ''}`} onClick={() => inputRef.current?.focus({ preventScroll: true })}>
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
      <div className="scroller" ref={scrollerRef}>
        <pre className="gutter" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')}
        </pre>
        <pre className="code" key={code}>
          {run.chars.map((ch, i) => {
            const state = run.states[i]
            const cur = i === run.pos
            const cls = ['c', classes[i], state, ch === '\n' && 'nl', cur && 'cur'].filter(Boolean).join(' ')
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
    </div>
  )
}
