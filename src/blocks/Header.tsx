/**
 * The top bar: brand, the Type / My runs / Leaderboard nav, the account
 * button, About and the theme button. Memoised, with stable handlers from the
 * app, so typing never redraws it (CLAUDE.md, Performance).
 */
import { memo } from 'react'
import { ChartColumnIcon, CodeXmlIcon, ContrastIcon, InfoIcon, TrophyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tip } from '@/components/composites/tip'
import { Account } from '../components/Account'
import { RenderMark } from '../lib/renderMark'
import type { Player } from '../lib/account'
import type { History } from '../lib/history'

/** Typing, the personal board (My runs, at /runs) or the global leaderboards (/leaderboard). */
export type View = 'type' | 'runs' | 'board'

interface Props {
  view: View
  /** On the site itself (the leaderboard and account exist only there). */
  onSite: boolean
  onView: (v: View) => void
  onAccountOpenChange: (open: boolean) => void
  onPlayer: (p: Player | null, siteKey: string | null) => void
  history: Promise<History | null>
  /** The site's about section, when the page has one. */
  hasAbout: boolean
  onAbout: () => void
  themeName: string
  themeShortcut: string
  onTheme: () => void
}

const NAV: { view: View; label: string; Icon: typeof CodeXmlIcon; siteOnly?: boolean }[] = [
  { view: 'type', label: 'Type', Icon: CodeXmlIcon },
  { view: 'runs', label: 'My runs', Icon: ChartColumnIcon },
  { view: 'board', label: 'Leaderboard', Icon: TrophyIcon, siteOnly: true },
]

export const Header = memo(function Header({ view, onSite, onView, onAccountOpenChange, onPlayer, history, hasAbout, onAbout, themeName, themeShortcut, onTheme }: Props) {
  // Inside the memo: the mark only reports when this block itself renders.
  return (
    <RenderMark id="header">
      <header className="flex flex-wrap items-center gap-3 sm:gap-5">
        <h1 className="m-0 font-display text-3xl font-bold tracking-tight text-shadow-glow">
          Syn<span className="text-primary">type</span>
        </h1>
        <nav aria-label="Sections" className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {NAV.filter((n) => onSite || !n.siteOnly).map(({ view: v, label, Icon }) => (
            <Button
              key={v}
              variant="ghost"
              aria-current={view === v ? 'page' : undefined}
              className="text-muted-foreground aria-[current=page]:bg-accent aria-[current=page]:text-primary"
              onPress={() => onView(v)}
            >
              <Icon data-icon="inline-start" />
              {/* On phones only the icon shows; the name stays for screen readers. */}
              <span className="max-sm:sr-only">{label}</span>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Account available={onSite} onOpenChange={onAccountOpenChange} onMyRuns={() => onView('runs')} onPlayer={onPlayer} history={history} />
          {hasAbout && (
            <Tip label="About Syntype">
              <Button variant="outline" size="icon" aria-haspopup="dialog" aria-label="About Syntype" onPress={onAbout}>
                <InfoIcon />
              </Button>
            </Tip>
          )}
          <Tip label={`Theme: ${themeName}`} shortcut={themeShortcut}>
            <Button variant="outline" size="icon" className="theme-button" aria-haspopup="dialog" aria-label={`Theme: ${themeName}. Change theme`} onPress={onTheme}>
              <ContrastIcon />
            </Button>
          </Tip>
        </div>
      </header>
    </RenderMark>
  )
})
