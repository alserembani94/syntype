import type { SnippetLength } from '../languages'

// No "any": every run belongs to one length, so speeds are only compared like for like.
const LENGTHS: SnippetLength[] = ['short', 'medium', 'long']

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

export function ConfigBar({
  length,
  autoIndent,
  autoClose,
  autocomplete,
  onLength,
  onToggleIndent,
  onToggleClose,
  onToggleAutocomplete,
}: Props) {
  return (
    <div className="config" role="toolbar" aria-label="Test settings">
      <div className="group">
        <span className="label">length</span>
        {LENGTHS.map((l) => (
          <button key={l} id={`len-${l}`} className="chip" aria-pressed={length === l} onClick={() => onLength(l)}>
            {l}
          </button>
        ))}
      </div>
      <div className="group">
        <button
          id="opt-indent"
          className="chip"
          aria-pressed={autoIndent}
          title="Skip leading spaces after Enter, like an editor would"
          onClick={onToggleIndent}
        >
          auto-indent
        </button>
        <button
          id="opt-close"
          className="chip"
          aria-pressed={autoClose}
          title="Insert closing brackets and quotes as you type, like VS Code"
          onClick={onToggleClose}
        >
          auto-close
        </button>
        <button
          id="opt-autocomplete"
          className="chip"
          aria-pressed={autocomplete}
          title="Suggest keywords and words you've already typed, like VS Code"
          onClick={onToggleAutocomplete}
        >
          autocomplete
        </button>
      </div>
    </div>
  )
}
