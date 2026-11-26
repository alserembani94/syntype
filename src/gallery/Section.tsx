/**
 * One gallery section: a component's states, in the page's theme, or with
 * "Compare themes" in all nine side by side. Overlays lock the page while
 * open, so nine can't be open at once: in compare mode an overlay section
 * shows its triggers once per theme, each opening the overlay in that theme
 * (its portal goes inside the themed panel, so it inherits the theme).
 */
import { useRef, useState, type ReactNode } from 'react'
import { UNSAFE_PortalProvider } from 'react-aria'
import { Switch } from '@/components/ui/switch'
import { GALLERY_THEMES } from './contents'

export function Section({ id, title, note, children }: { id: string; title: string; note?: ReactNode; children: ReactNode }) {
  const [compare, setCompare] = useState(false)
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid scroll-mt-20 gap-3 border-t border-border pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 id={`${id}-title`} className="font-display text-xl font-bold">
          {title}
        </h3>
        <span className="flex items-center gap-2 text-sm">
          <Switch isSelected={compare} onChange={setCompare} aria-labelledby={`${id}-compare`} />
          <span id={`${id}-compare`}>Compare themes</span>
        </span>
      </div>
      {note && <p className="max-w-prose text-sm text-muted-foreground">{note}</p>}
      {compare ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {GALLERY_THEMES.map((t) => (
            <ThemedPanel key={t.id} theme={t.id} name={t.name}>
              {children}
            </ThemedPanel>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-6">{children}</div>
      )}
    </section>
  )
}

function ThemedPanel({ theme, name, children }: { theme: string; name: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} data-syntype-theme={theme} className="grid gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
      <p className="text-xs font-medium text-muted-foreground">{name}</p>
      <UNSAFE_PortalProvider getContainer={() => ref.current}>{children}</UNSAFE_PortalProvider>
    </div>
  )
}

/** A labelled row of one state (Default, Disabled, Invalid…). */
export function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

/** States laid out in a responsive grid. */
export function States({ children }: { children: ReactNode }) {
  return <div className="grid gap-6 md:grid-cols-2">{children}</div>
}
