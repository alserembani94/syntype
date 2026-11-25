import type { LengthFilter } from '../data/snippets'

const LENGTHS: LengthFilter[] = ['short', 'medium', 'long', 'any']

interface Props {
  length: LengthFilter
  autoIndent: boolean
  onLength: (l: LengthFilter) => void
  onToggleIndent: () => void
}

export function ConfigBar({ length, autoIndent, onLength, onToggleIndent }: Props) {
  return (
    <div className="config" role="toolbar" aria-label="Test settings">
      <span className="label">length</span>
      {LENGTHS.map((l) => (
        <button key={l} id={`len-${l}`} className="chip" aria-pressed={length === l} onClick={() => onLength(l)}>
          {l}
        </button>
      ))}
      <span className="sep" />
      <button
        id="opt-indent"
        className="chip"
        aria-pressed={autoIndent}
        title="Skip leading spaces after Enter, like an editor would"
        onClick={onToggleIndent}
      >
        auto-indent
      </button>
    </div>
  )
}
