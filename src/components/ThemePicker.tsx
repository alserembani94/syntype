import { useEffect, useRef } from 'react'
import { THEME_SECTIONS, THEMES, type Theme } from '../themes'
import { fuzzyMatch } from '../lib/suggest'
import { Picker } from './Picker'

interface Props {
  currentId: string
  /** Shows a theme while it's highlighted; closing without choosing puts the saved one back. */
  onPreview: (id: string) => void
  onSelect: (id: string) => void
  onClose: () => void
  smoothCaret: boolean
  onSmoothCaret: (on: boolean) => void
}

function matches(theme: Theme, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    theme.name.toLowerCase().includes(q) ||
    theme.section.toLowerCase().includes(q) ||
    (theme.credit ?? '').toLowerCase().includes(q) ||
    fuzzyMatch(q, theme.name) !== null
  )
}

/**
 * How long a row must stay highlighted before the page previews it, so
 * sweeping the mouse or holding an arrow key over the list doesn't flash
 * every theme on the way.
 */
export const PREVIEW_DELAY_MS = 350

const sectionOf = (t: Theme) => t.section
const idOf = (t: Theme) => t.id

/** A few of the theme's own colours, drawn from its CSS by scoping the theme to the swatch. */
function Swatch({ themeId }: { themeId: string }) {
  return (
    <span className="swatch" data-syntype-theme={themeId} aria-hidden="true">
      <i style={{ background: 'var(--foreground)' }} />
      <i style={{ background: 'var(--primary)' }} />
      <i style={{ background: 'var(--code-keyword)' }} />
      <i style={{ background: 'var(--code-string)' }} />
    </span>
  )
}

/** The theme list, opened from the theme button in the footer. */
export function ThemePicker({ currentId, onPreview, onSelect, onClose, smoothCaret, onSmoothCaret }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // A preview still waiting when the picker closes must not land afterwards.
  useEffect(() => () => clearTimeout(timer.current), [])
  const preview = (id: string) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onPreview(id), PREVIEW_DELAY_MS)
  }

  return (
    <Picker
      label="Choose a theme"
      placeholder="Theme…"
      items={THEMES}
      sections={THEME_SECTIONS}
      sectionOf={sectionOf}
      idOf={idOf}
      matches={matches}
      currentId={currentId}
      onActive={(t) => preview(t.id)}
      onSelect={onSelect}
      onClose={onClose}
      empty={(q) => <>No theme matches “{q}”</>}
      footer={
        <>
          <span className="footer-label">
            Smooth caret
            <small>glides between letters, with a trail when a suggestion fills in a word</small>
          </span>
          <button type="button" role="switch" aria-checked={smoothCaret} className="switch" onClick={() => onSmoothCaret(!smoothCaret)}>
            {smoothCaret ? 'on' : 'off'}
          </button>
        </>
      }
      renderItem={(theme) => (
        <>
          <span className="name">{theme.name}</span>
          {theme.credit && <span className="based">{theme.credit}</span>}
          <span className="swatches">
            {(theme.swatches ?? [theme.id]).map((id) => (
              <Swatch key={id} themeId={id} />
            ))}
          </span>
        </>
      )}
    />
  )
}
