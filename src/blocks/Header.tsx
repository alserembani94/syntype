/**
 * The top bar: brand, the Type / My runs / Leaderboard nav, the account
 * button, About and the theme button. Memoised, with stable handlers from the
 * app, so typing never redraws it (CLAUDE.md, Performance).
 */
import { memo } from 'react'
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

export const Header = memo(function Header({ view, onSite, onView, onAccountOpenChange, onPlayer, history, hasAbout, onAbout, themeName, themeShortcut, onTheme }: Props) {
  // Inside the memo: the mark only reports when this block itself renders.
  return (
    <RenderMark id="header">
      <header className="top">
        <div className="brand">
          <h1>
            Syn<span>type</span>
          </h1>
        </div>
        <nav className="tabs" aria-label="Sections">
          <button type="button" aria-current={view === 'type' ? 'page' : undefined} onClick={() => onView('type')}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Type</span>
          </button>
          <button type="button" aria-current={view === 'runs' ? 'page' : undefined} onClick={() => onView('runs')}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>My runs</span>
          </button>
          {onSite && (
            <button type="button" aria-current={view === 'board' ? 'page' : undefined} onClick={() => onView('board')}>
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                <path
                  d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Leaderboard</span>
            </button>
          )}
        </nav>
        <div className="top-actions">
          <Account available={onSite} onOpenChange={onAccountOpenChange} onMyRuns={() => onView('runs')} onPlayer={onPlayer} history={history} />
          {hasAbout && (
            <button type="button" className="icon-button" onClick={onAbout} aria-haspopup="dialog" aria-label="About Syntype" title="About Syntype">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M12 11v5.5M12 7.6v.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="icon-button theme-button"
            onClick={onTheme}
            aria-haspopup="dialog"
            aria-label={`Theme: ${themeName}. Change theme`}
            title={`Theme: ${themeName} (${themeShortcut})`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </header>
    </RenderMark>
  )
})
