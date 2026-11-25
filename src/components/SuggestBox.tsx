import { useLayoutEffect, useRef } from 'react'
import type { SuggestState } from '../hooks/useTypingTest'
import type { SuggestionKind } from '../lib/suggest'

const ROW_HEIGHT = 26
/** VS Code's default suggest.maxVisibleSuggestions is 12; 8 suits a smaller editor. */
const VISIBLE_ROWS = 8
const BOX_WIDTH = 300

const KIND_ICON: Record<SuggestionKind, string> = {
  keyword: 'kw',
  word: 'abc',
  function: 'ƒ',
  method: 'ƒ',
  variable: 'var',
  class: 'cls',
  property: 'prop',
  module: 'mod',
  interface: 'I',
  type: 'T',
  enum: 'E',
  enumMember: 'e',
  typeParameter: '<T>',
  string: '"a"',
}
const KIND_LABEL: Record<SuggestionKind, string> = {
  keyword: 'keyword',
  word: 'word in file',
  function: 'function',
  method: 'method',
  variable: 'variable',
  class: 'class',
  property: 'property',
  module: 'module',
  interface: 'interface',
  type: 'type',
  enum: 'enum',
  enumMember: 'enum member',
  typeParameter: 'type parameter',
  string: 'string',
}

const boxHeight = (count: number) => Math.min(count, VISIBLE_ROWS) * ROW_HEIGHT + 2

interface Props {
  suggest: SuggestState
  editorRef: React.RefObject<HTMLDivElement | null>
  scrollerRef: React.RefObject<HTMLDivElement | null>
  codeRef: React.RefObject<HTMLPreElement | null>
  onAccept: (index: number) => void
}

export function SuggestBox({ suggest, editorRef, scrollerRef, codeRef, onAccept }: Props) {
  const boxRef = useRef<HTMLUListElement>(null)
  const selectedRef = useRef<HTMLLIElement>(null)
  // Keep the selected row visible by scrolling the list only, never the page.
  useLayoutEffect(() => {
    const ul = boxRef.current
    const li = selectedRef.current
    if (!ul || !li) return
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight)
      ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight
  }, [suggest.selected])

  // Anchor under the start of the word, like VS Code; flip above when there's no room below.
  useLayoutEffect(() => {
    const box = boxRef.current
    const editor = editorRef.current
    const sc = scrollerRef.current
    if (!box || !editor || !sc) return
    const place = () => {
      const anchor = codeRef.current?.querySelectorAll<HTMLElement>('.c')[suggest.start]
      if (!anchor) return
      const a = anchor.getBoundingClientRect()
      const e = editor.getBoundingClientRect()
      const h = boxHeight(suggest.items.length)
      const below = a.bottom - e.top + 2
      const top = below + h > e.height && a.top - e.top - h - 2 > 0 ? a.top - e.top - h - 2 : below
      const left = Math.max(8, Math.min(a.left - e.left, e.width - BOX_WIDTH - 8))
      box.style.top = `${top}px`
      box.style.left = `${left}px`
    }
    place()
    sc.addEventListener('scroll', place)
    return () => sc.removeEventListener('scroll', place)
  })

  return (
    <ul
      ref={boxRef}
      className="suggest"
      role="listbox"
      aria-label="Suggestions"
      style={{ width: BOX_WIDTH, maxHeight: boxHeight(suggest.items.length) }}
    >
      {suggest.items.map((item, i) => {
        const selected = i === suggest.selected
        const matched = new Set(item.matches)
        return (
          <li
            key={item.label}
            ref={selected ? selectedRef : undefined}
            role="option"
            aria-selected={selected}
            className={selected ? 'selected' : undefined}
            style={{ height: ROW_HEIGHT }}
            // mousedown, not click, so the hidden input keeps focus.
            onMouseDown={(e) => {
              e.preventDefault()
              onAccept(i)
            }}
          >
            <span className={`icon ${item.kind}`}>{KIND_ICON[item.kind]}</span>
            <span className="label">
              {[...item.label].map((ch, j) =>
                matched.has(j) ? (
                  <b key={j}>{ch}</b>
                ) : (
                  <span key={j}>{ch}</span>
                ),
              )}
            </span>
            {selected && (
              <span className="detail">
                {KIND_LABEL[item.kind]}
                {item.detail && ` · ${item.detail}`}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
