import { THEME_SECTIONS, THEMES, type Theme } from '../themes'
import { fuzzyMatch } from '../lib/suggest'
import { Picker } from './Picker'

interface Props {
  currentId: string
  /** Shows a theme while it's highlighted; closing without choosing puts the saved one back. */
  onPreview: (id: string) => void
  onSelect: (id: string) => void
  onClose: () => void
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

const sectionOf = (t: Theme) => t.section
const idOf = (t: Theme) => t.id

/** A few of the theme's own colours, drawn from its CSS by scoping the theme to the swatch. */
function Swatch({ themeId }: { themeId: string }) {
  return (
    <span className="swatch" data-syntype-theme={themeId} aria-hidden="true">
      <i style={{ background: 'var(--fg)' }} />
      <i style={{ background: 'var(--accent)' }} />
      <i style={{ background: 'var(--tok-kw)' }} />
      <i style={{ background: 'var(--tok-str)' }} />
    </span>
  )
}

/** The theme list, opened from the theme button in the footer. */
export function ThemePicker({ currentId, onPreview, onSelect, onClose }: Props) {
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
      onActive={(t) => onPreview(t.id)}
      onSelect={onSelect}
      onClose={onClose}
      empty={(q) => <>No theme matches “{q}”</>}
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
