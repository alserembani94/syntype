import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'

interface Props<T> {
  /** The dialog's accessible name, e.g. "Choose a language". */
  label: string
  placeholder: string
  items: T[]
  /** Section headings, in the order they're shown; items are grouped under them. */
  sections: readonly string[]
  sectionOf: (item: T) => string
  idOf: (item: T) => string
  matches: (item: T, query: string) => boolean
  currentId: string
  /** The row's content, after the check mark. */
  renderItem: (item: T) => ReactNode
  /** Called as the highlighted row changes, by keyboard or mouse (theme preview). */
  onActive?: (item: T) => void
  onSelect: (id: string) => void
  onClose: () => void
  empty: (query: string) => ReactNode
}

/** A searchable, sectioned list in a modal: the language and theme pickers. */
export function Picker<T>(props: Props<T>) {
  const { label, placeholder, items, sections, sectionOf, idOf, matches, currentId, renderItem, onActive, onSelect, onClose, empty } = props
  const [query, setQuery] = useState('')
  // Start on the current item, counted in the grouped order the list shows.
  const [active, setActive] = useState(() =>
    Math.max(0, sections.flatMap((c) => items.filter((i) => sectionOf(i) === c)).findIndex((i) => idOf(i) === currentId)),
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  // Grouped by section; sections with no match are left out.
  const grouped = useMemo(
    () =>
      sections
        .map((section) => ({ section, list: items.filter((i) => sectionOf(i) === section && matches(i, query)) }))
        .filter((s) => s.list.length > 0),
    [sections, items, sectionOf, matches, query],
  )
  // The keyboard moves through items in the order they're shown, skipping headers.
  const shown = useMemo(() => grouped.flatMap((s) => s.list), [grouped])
  const index = Math.min(active, Math.max(0, shown.length - 1))
  const activeItem = shown[index]

  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])
  const onActiveRef = useRef(onActive)
  useEffect(() => {
    onActiveRef.current = onActive
  })
  useEffect(() => {
    if (activeItem) onActiveRef.current?.(activeItem)
  }, [activeItem])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!shown.length) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((index + step + shown.length) % shown.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeItem) onSelect(idOf(activeItem))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Tab') {
      // Keep focus in the dialog: the search box is its only stop.
      e.preventDefault()
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="picker" role="dialog" aria-modal="true" aria-label={label} onKeyDown={onKeyDown}>
        <label className="picker-search">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeItem ? `${listId}-${idOf(activeItem)}` : undefined}
          />
          <kbd>esc</kbd>
        </label>
        <ul ref={listRef} id={listId} role="listbox" className="picker-list">
          {grouped.map(({ section, list }) => (
            <li key={section} role="presentation" className="section">
              <span className="section-label" id={`${listId}-${section}`}>
                {section}
              </span>
              <ul role="group" aria-labelledby={`${listId}-${section}`}>
                {list.map((item) => {
                  const id = idOf(item)
                  const i = shown.indexOf(item)
                  return (
                    <li
                      key={id}
                      id={`${listId}-${id}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === index}
                      className={i === index ? 'active' : undefined}
                      onMouseMove={() => i !== index && setActive(i)}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        onSelect(id)
                      }}
                    >
                      <span className="check" aria-hidden="true">
                        {id === currentId ? '✓' : ''}
                      </span>
                      {renderItem(item)}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
          {!shown.length && <li className="empty">{empty(query)}</li>}
        </ul>
      </div>
    </div>
  )
}
