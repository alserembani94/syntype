import { useEffect } from 'react'
import { CATEGORIES, type LanguageInfo } from '../languages/types'
import { loadAllLanguages } from '../languages/catalog'
import { fuzzyMatch } from '../lib/suggest'
import { Picker } from '@/components/composites/picker'

interface Props {
  languages: LanguageInfo[]
  currentId: string
  onSelect: (id: string) => void
  onClose: () => void
  /** What each row says at its end; the number of snippets unless given (My runs shows your run count). */
  detail?: (lang: LanguageInfo) => string
}

/**
 * Matches on name, id, extension, aliases ("golang", "sql") or section
 * ("web" lists all web languages); fuzzy on the name, so "ts" finds TypeScript.
 */
function matches(lang: LanguageInfo, query: string): boolean {
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

const sectionOf = (l: LanguageInfo) => l.category
const idOf = (l: LanguageInfo) => l.id
const textOf = (l: LanguageInfo) => l.name

/** A searchable list of languages in a modal, opened from the language button. */
export function LanguagePicker({ languages, currentId, onSelect, onClose, detail = (l) => `${l.snippets.length} snippets` }: Props) {
  // Opening the picker fetches every language (each 1–4 KB, cached), so choosing one is instant.
  useEffect(() => {
    loadAllLanguages().catch(() => {
      /* each choice retries its own language, and says so if it still can't */
    })
  }, [])
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
          <span className="ml-auto text-xs text-muted-foreground">{detail(lang)}</span>
        </>
      )}
    />
  )
}
