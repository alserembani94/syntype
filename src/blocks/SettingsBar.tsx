/**
 * Everything that changes the run, next to the code it changes: the language
 * button, the length and typing-aid controls, and "new snippet". No clock or
 * score while typing. Memoised, with stable handlers from the app, so typing
 * never redraws it (CLAUDE.md, Performance).
 */
import { memo } from 'react'
import { ConfigBar } from '../components/ConfigBar'
import { RenderMark } from '../lib/renderMark'
import type { SnippetLength } from '../languages'

interface Props {
  languageName: string
  languageShortcut: string
  onLanguage: () => void
  length: SnippetLength
  autoIndent: boolean
  autoClose: boolean
  autocomplete: boolean
  onLength: (l: SnippetLength) => void
  onToggleIndent: () => void
  onToggleClose: () => void
  onToggleAutocomplete: () => void
  newSnippetShortcut: string
  onNewSnippet: () => void
}

export const SettingsBar = memo(function SettingsBar(p: Props) {
  // Inside the memo: the mark only reports when this block itself renders.
  return (
    <RenderMark id="settings">
      <div className="settings">
        <button type="button" id="language-button" className="lang-button" onClick={p.onLanguage} aria-haspopup="dialog" title={`Change language (${p.languageShortcut})`}>
          <span className="lang-icon" aria-hidden="true">
            {'</>'}
          </span>
          {p.languageName}
        </button>
        <ConfigBar
          length={p.length}
          autoIndent={p.autoIndent}
          autoClose={p.autoClose}
          onLength={p.onLength}
          onToggleIndent={p.onToggleIndent}
          onToggleClose={p.onToggleClose}
          autocomplete={p.autocomplete}
          onToggleAutocomplete={p.onToggleAutocomplete}
        />
        <button type="button" className="new-snippet" onClick={p.onNewSnippet} title={`New snippet (${p.newSnippetShortcut})`}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path
              d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          new snippet
        </button>
      </div>
    </RenderMark>
  )
})
