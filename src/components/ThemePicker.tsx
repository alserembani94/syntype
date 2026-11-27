import { useEffect, useId, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { LabelledSwitch } from '@/components/composites/labelled'
import { Picker } from '@/components/composites/picker'
import { THEME_SECTIONS, THEMES, type Theme } from '../themes'
import { fuzzyMatch } from '../lib/suggest'

interface Props {
  currentId: string
  /** Shows a theme while it's highlighted; closing without choosing puts the saved one back. */
  onPreview: (id: string) => void
  onSelect: (id: string) => void
  onClose: () => void
  smoothCaret: boolean
  onSmoothCaret: (on: boolean) => void
}

/** Searches that list the themes meeting WCAG AA. */
const AA_WORDS = ['wcag', 'accessible', 'accessibility', 'aa']

function matches(theme: Theme, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    theme.name.toLowerCase().includes(q) ||
    theme.section.toLowerCase().includes(q) ||
    (theme.credit ?? '').toLowerCase().includes(q) ||
    (theme.wcag === 'AA' && AA_WORDS.some((w) => w.startsWith(q) || q.startsWith(w))) ||
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
const textOf = (t: Theme) => t.name

/** A few of the theme's own colours, drawn from its CSS by scoping the theme to the swatch. */
function Swatch({ themeId }: { themeId: string }) {
  return (
    <span className="inline-flex gap-0.75 rounded-md border bg-card px-1.5 py-1" data-syntype-theme={themeId} aria-hidden="true">
      <i className="size-2.25 rounded-full bg-foreground" />
      <i className="size-2.25 rounded-full bg-primary" />
      <i className="size-2.25 rounded-full bg-code-keyword" />
      <i className="size-2.25 rounded-full bg-code-string" />
    </span>
  )
}

/** The theme list, opened from the theme button in the footer. */
export function ThemePicker({ currentId, onPreview, onSelect, onClose, smoothCaret, onSmoothCaret }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hint = useId()
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
      textOf={textOf}
      matches={matches}
      currentId={currentId}
      onActive={(t) => preview(t.id)}
      onSelect={onSelect}
      onClose={onClose}
      empty="No theme matches."
      footer={
        <div className="grid gap-1">
          <LabelledSwitch label="Smooth caret" className="font-medium" isSelected={smoothCaret} onChange={onSmoothCaret} aria-describedby={hint} />
          <p id={hint} className="text-xs text-muted-foreground">
            Glides between letters, with a trail when a suggestion fills in a word.
          </p>
        </div>
      }
      renderItem={(theme) => (
        <>
          <span className="font-mono">{theme.name}</span>
          {theme.wcag === 'AA' && (
            <>
              <Badge variant="outline" aria-hidden="true" className="h-4 rounded-sm px-1 font-mono text-2xs text-muted-foreground">
                WCAG AA
              </Badge>
              <span className="sr-only">, meets WCAG AA contrast</span>
            </>
          )}
          {theme.credit && <span className="text-xs text-muted-foreground">{theme.credit}</span>}
          <span className="ml-auto flex gap-1.5">
            {(theme.swatches ?? [theme.id]).map((id) => (
              <Swatch key={id} themeId={id} />
            ))}
          </span>
        </>
      )}
    />
  )
}
