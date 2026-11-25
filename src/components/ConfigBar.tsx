import type { Language, LengthFilter } from '../languages'

const LENGTHS: LengthFilter[] = ['short', 'medium', 'long', 'any']

interface Props {
  languages: Language[]
  language: Language
  length: LengthFilter
  autoIndent: boolean
  autoClose: boolean
  intellisense: boolean
  onLanguage: (id: string) => void
  onLength: (l: LengthFilter) => void
  onToggleIndent: () => void
  onToggleClose: () => void
  onToggleIntellisense: () => void
}

export function ConfigBar({
  languages,
  language,
  length,
  autoIndent,
  autoClose,
  intellisense,
  onLanguage,
  onLength,
  onToggleIndent,
  onToggleClose,
  onToggleIntellisense,
}: Props) {
  return (
    <div className="config" role="toolbar" aria-label="Test settings">
      <div className="group">
        <span className="label">language</span>
        {languages.map((l) => (
          <button
            key={l.id}
            id={`lang-${l.id}`}
            className="chip"
            aria-pressed={language.id === l.id}
            onClick={() => onLanguage(l.id)}
          >
            {l.name}
          </button>
        ))}
      </div>
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
          id="opt-intellisense"
          className="chip"
          aria-pressed={intellisense}
          title="Suggest keywords and words you've already typed, like VS Code"
          onClick={onToggleIntellisense}
        >
          intellisense
        </button>
      </div>
    </div>
  )
}
