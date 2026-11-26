/**
 * The run's settings: length (one choice) and the typing aids (any). Each is
 * a toggle group, one Tab stop with ← → inside (the toolbar pattern, design
 * system step 10). src/lib/keyTarget.ts keeps the app's key handler from
 * taking those arrows; letters typed here still go to the editor.
 */
import type { Key } from 'react-aria-components'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tip } from '@/components/composites/tip'
import type { SnippetLength } from '../languages'

// No "any": every run belongs to one length, so speeds are only compared like for like.
const LENGTHS: SnippetLength[] = ['short', 'medium', 'long']

/**
 * Selected chips in the app's highlight: shadcn's own (bg-muted) is barely visible in light
 * themes and the same as hover. Set on the same attributes as shadcn's (aria-pressed for the
 * aids, aria-checked for the length), or its later rule wins.
 */
const SELECTED =
  'data-selected:bg-accent data-selected:text-primary aria-pressed:bg-accent aria-pressed:text-primary aria-checked:bg-accent aria-checked:text-primary hover:data-selected:bg-accent'

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
      <ToggleGroup
        aria-label="Length"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[length]}
        onSelectionChange={(keys) => {
          const [next] = keys as Set<Key>
          if (next && next !== length) onLength(next as SnippetLength)
        }}
      >
        {LENGTHS.map((l) => (
          <ToggleGroupItem key={l} id={l} className={SELECTED}>
            {l}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ToggleGroup
        aria-label="Typing aids"
        selectionMode="multiple"
        variant="outline"
        selectedKeys={AIDS.filter((a) => on[a.id]).map((a) => a.id)}
        onSelectionChange={(keys) => {
          // Exactly one aid changes per press: the one whose state differs.
          for (const a of AIDS) if ((keys as Set<Key>).has(a.id) !== on[a.id]) toggle[a.id]()
        }}
      >
        {AIDS.map((a) => (
          <Tip key={a.id} label={a.tip}>
            <ToggleGroupItem id={a.id} className={SELECTED}>
              {a.label}
            </ToggleGroupItem>
          </Tip>
        ))}
      </ToggleGroup>
    </div>
  )
}
