import { CATEGORIES, type Language } from '../languages'
import { fuzzyMatch } from '../lib/suggest'
import { Picker } from './Picker'

interface Props {
  languages: Language[]
  currentId: string
  onSelect: (id: string) => void
  onClose: () => void
}

/**
 * Matches on name, id, extension, aliases ("golang", "sql") or section
 * ("web" lists all web languages); fuzzy on the name, so "ts" finds TypeScript.
 */
function matches(lang: Language, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    lang.name.toLowerCase().includes(q) ||
    lang.id.includes(q) ||
    lang.extension.includes(q.replace(/^\./, '')) ||
    (lang.aliases ?? []).some((a) => a.includes(q)) ||
    lang.category.toLowerCase().includes(q) ||
    (lang.basedOn ?? '').toLowerCase().includes(q) ||
    fuzzyMatch(q, lang.name) !== null
  )
}

const sectionOf = (l: Language) => l.category
const idOf = (l: Language) => l.id

/** A searchable list of languages in a modal, opened from the language button. */
export function LanguagePicker({ languages, currentId, onSelect, onClose }: Props) {
  return (
    <Picker
      label="Choose a language"
      placeholder="Language…"
      items={languages}
      sections={CATEGORIES}
      sectionOf={sectionOf}
      idOf={idOf}
      matches={matches}
      currentId={currentId}
      onSelect={onSelect}
      onClose={onClose}
      empty={(q) => <>No language matches “{q}”</>}
      renderItem={(lang) => (
        <>
          <span className="name">{lang.name}</span>
          <span className="ext">.{lang.extension}</span>
          {lang.basedOn && <span className="based">on {lang.basedOn}</span>}
          <span className="count">{lang.snippets.length} snippets</span>
        </>
      )}
    />
  )
}
