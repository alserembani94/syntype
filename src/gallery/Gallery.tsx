/**
 * The design system gallery (/admin/gallery, and the review artifact built by
 * npm run build:gallery): every shadcn component and composite, in each
 * state, in any theme. Made-up content only: no data, no API, no sign-in.
 */
import { useState } from 'react'
import { PaletteIcon } from 'lucide-react'
import { Picker } from '@/components/composites/picker'
import { Button } from '@/components/ui/button'
import { applyTheme, getTheme, loadTheme, saveTheme, THEME_SECTIONS, THEMES } from '@/themes'
import { CONTENTS } from './contents'
import { Actions } from './sections/actions'
import { Composites } from './sections/composites'
import { Display, Navigation } from './sections/display'
import { Forms } from './sections/forms'
import { Overlays } from './sections/overlays'

const GROUPS: Record<string, () => React.ReactNode> = { Actions, Forms, Overlays, Navigation, Display, Composites }

function ThemeSwitcher() {
  const [current, setCurrent] = useState(loadTheme)
  const [open, setOpen] = useState(false)
  const close = () => (applyTheme(current), setOpen(false))
  return (
    <>
      <Button variant="outline" onPress={() => setOpen(true)}>
        <PaletteIcon data-icon="inline-start" /> {getTheme(current).name}
      </Button>
      {open && (
        <Picker
          label="Choose a theme"
          placeholder="Search themes"
          items={THEMES}
          sections={THEME_SECTIONS}
          sectionOf={(t) => t.section}
          idOf={(t) => t.id}
          textOf={(t) => t.name}
          currentId={current}
          renderItem={(t) => (
            <span className="grid">
              <span>{t.name}</span>
              <span className="text-xs text-muted-foreground">{t.credit}</span>
            </span>
          )}
          onActive={(t) => applyTheme(t.id)}
          onSelect={(id) => {
            applyTheme(id)
            saveTheme(id)
            setCurrent(id)
            setOpen(false)
          }}
          onClose={close}
          empty="No theme matches."
        />
      )}
    </>
  )
}

export function Gallery() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="font-display text-2xl font-bold">
            Syn<span className="text-primary">type</span> <span className="text-base font-medium text-muted-foreground">design system</span>
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[12rem_1fr]">
        <nav aria-label="Contents" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="grid list-none gap-3 p-0 text-sm">
            {CONTENTS.map(([group, items]) => (
              <li key={group}>
                <p className="font-medium">{group}</p>
                <ul className="mt-1 grid list-none p-0">
                  {items.map(([id, title]) => (
                    <li key={id}>
                      <a href={`#${id}`} className="block py-1 text-muted-foreground no-underline hover:text-foreground">
                        {title}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
        <main className="grid min-w-0 gap-10">
          <p className="max-w-prose text-sm text-muted-foreground">
            Every component and composite of the design system, in its states. The theme button switches the whole page (with a live preview); “Compare themes” on a section shows it in all {THEMES.length - 1} themes at once. Contents are made up.
          </p>
          {CONTENTS.map(([group]) => {
            const Group = GROUPS[group]
            return (
              <div key={group} className="grid gap-6">
                <h2 className="font-display text-3xl font-bold">{group}</h2>
                <Group />
              </div>
            )
          })}
        </main>
      </div>
    </div>
  )
}
