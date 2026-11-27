/**
 * The run's settings: length (one choice) and the typing aids (any). Each is
 * a toggle group, one Tab stop with ← → inside (the toolbar pattern, design
 * system step 10). src/lib/keyTarget.ts keeps the app's key handler from
 * taking those arrows; letters typed here still go to the editor.
 */
import { Choice, Toggles } from '@/components/composites/choices'
import type { SnippetLength } from '../languages/types'

// No "any": every run belongs to one length, so speeds are only compared like for like.
const LENGTHS = (['short', 'medium', 'long'] as const).map((l) => ({ id: l, label: l }))

const AIDS = [
  { id: 'indent', label: 'auto-indent', tip: 'Skip leading spaces after Enter, like an editor would' },
  { id: 'close', label: 'auto-close', tip: 'Insert closing brackets and quotes as you type, like VS Code' },
  { id: 'autocomplete', label: 'autocomplete', tip: 'Suggest keywords and words you’ve already typed, like VS Code' },
] as const

interface Props {
  length: SnippetLength
  autoIndent: boolean
  autoClose: boolean
  autocomplete: boolean
  onLength: (l: SnippetLength) => void
  onToggleIndent: () => void
  onToggleClose: () => void
  onToggleAutocomplete: () => void
}

export function ConfigBar({ length, autoIndent, autoClose, autocomplete, onLength, onToggleIndent, onToggleClose, onToggleAutocomplete }: Props) {
  const on = { indent: autoIndent, close: autoClose, autocomplete }
  const toggle = { indent: onToggleIndent, close: onToggleClose, autocomplete: onToggleAutocomplete }
  return (
    // On phones, language and new snippet share the first line and these take the second.
    <div className="flex flex-wrap items-center gap-2 max-sm:order-2 max-sm:w-full">
      <Choice label="Length" options={LENGTHS} value={length} onChange={onLength} />
      <Toggles label="Typing aids" options={AIDS} on={on} onToggle={(id) => toggle[id]()} />
    </div>
  )
}
