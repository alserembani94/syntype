import { CATEGORIES, type Language } from '../languages'
import { fuzzyMatch } from '../lib/suggest'
import { Picker } from '@/components/composites/picker'

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
const textOf = (l: Language) => l.name

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
      textOf={textOf}
      matches={matches}
      currentId={currentId}
      onSelect={onSelect}
      onClose={onClose}
      empty="No language matches."
      renderItem={(lang) => (
        <>
          <span className="font-mono">{lang.name}</span>
          <span className="font-mono text-muted-foreground">.{lang.extension}</span>
          {lang.basedOn && <span className="text-xs text-muted-foreground">on {lang.basedOn}</span>}
          <span className="ml-auto text-xs text-muted-foreground">{lang.snippets.length} snippets</span>
        </>
      )}
    />
  )
}
