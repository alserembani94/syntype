import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CATEGORIES, type Language } from '../languages'
import { fuzzyMatch } from '../lib/suggest'

interface Props {
  languages: Language[]
  currentId: string
  onSelect: (id: string) => void
  onClose: () => void
}

/**
 * Matches on name, id, extension, aliases ("golang", "sql") or section
 * ("web" lists all web languages); fuzzy on the name, so "ts" finds TypeScript.
 */
function matches(lang: Language, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    lang.name.toLowerCase().includes(q) ||
    lang.id.includes(q) ||
    lang.extension.includes(q.replace(/^\./, '')) ||
    (lang.aliases ?? []).some((a) => a.includes(q)) ||
    lang.category.toLowerCase().includes(q) ||
    (lang.basedOn ?? '').toLowerCase().includes(q) ||
    fuzzyMatch(q, lang.name) !== null
  )
}

/** A searchable list of languages in a modal, opened from the language button. */
export function LanguagePicker({ languages, currentId, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  // Start on the current language, counted in the grouped order the list shows.
  const [active, setActive] = useState(() =>
    Math.max(0, CATEGORIES.flatMap((c) => languages.filter((l) => l.category === c)).findIndex((l) => l.id === currentId)),
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  // Grouped by section, in CATEGORIES order; sections with no match are left out.
  const sections = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        category,
        langs: languages.filter((l) => l.category === category && matches(l, query)),
      })).filter((s) => s.langs.length > 0),
    [languages, query],
  )
  // The keyboard moves through languages in the order they're shown, skipping headers.
  const shown = useMemo(() => sections.flatMap((s) => s.langs), [sections])
  const index = Math.min(active, Math.max(0, shown.length - 1))

  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!shown.length) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((index + step + shown.length) % shown.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (shown[index]) onSelect(shown[index].id)
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
      <div className="picker" role="dialog" aria-modal="true" aria-label="Choose a language" onKeyDown={onKeyDown}>
        <label className="picker-search">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            id="language-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder="Language…"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={shown[index] ? `${listId}-${shown[index].id}` : undefined}
          />
          <kbd>esc</kbd>
        </label>
        <ul ref={listRef} id={listId} role="listbox" className="picker-list">
          {sections.map(({ category, langs }) => (
            <li key={category} role="presentation" className="section">
              <span className="section-label" id={`${listId}-${category}`}>
                {category}
              </span>
              <ul role="group" aria-labelledby={`${listId}-${category}`}>
                {langs.map((lang) => {
                  const i = shown.indexOf(lang)
                  return (
                    <li
                      key={lang.id}
                      id={`${listId}-${lang.id}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === index}
                      className={i === index ? 'active' : undefined}
                      onMouseMove={() => i !== index && setActive(i)}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        onSelect(lang.id)
                      }}
                    >
                      <span className="check" aria-hidden="true">
                        {lang.id === currentId ? '✓' : ''}
                      </span>
                      <span className="name">{lang.name}</span>
                      <span className="ext">.{lang.extension}</span>
                      {lang.basedOn && <span className="based">on {lang.basedOn}</span>}
                      <span className="count">{lang.snippets.length} snippets</span>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
          {!shown.length && <li className="empty">No language matches “{query}”</li>}
        </ul>
      </div>
    </div>
  )
}
