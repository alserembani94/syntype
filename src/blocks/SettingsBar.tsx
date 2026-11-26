/**
 * Everything that changes the run, next to the code it changes: the language
 * button, the length and typing-aid groups, and "new snippet". No clock or
 * score while typing. Memoised, with stable handlers from the app, so typing
 * never redraws it (CLAUDE.md, Performance).
 */
import { memo } from 'react'
import { CodeXmlIcon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tip } from '@/components/composites/tip'
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
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Test settings" data-settings="">
        <Tip label="Change language" shortcut={p.languageShortcut}>
          <Button id="language-button" variant="outline" aria-haspopup="dialog" onPress={p.onLanguage}>
            <CodeXmlIcon data-icon="inline-start" className="text-primary" />
            {p.languageName}
          </Button>
        </Tip>
        <ConfigBar
          length={p.length}
          autoIndent={p.autoIndent}
          autoClose={p.autoClose}
          autocomplete={p.autocomplete}
          onLength={p.onLength}
          onToggleIndent={p.onToggleIndent}
          onToggleClose={p.onToggleClose}
          onToggleAutocomplete={p.onToggleAutocomplete}
        />
        <Tip label="New snippet" shortcut={p.newSnippetShortcut}>
          <Button variant="outline" className="ml-auto" onPress={p.onNewSnippet}>
            <RefreshCwIcon data-icon="inline-start" />
            new snippet
          </Button>
        </Tip>
      </div>
    </RenderMark>
  )
})
