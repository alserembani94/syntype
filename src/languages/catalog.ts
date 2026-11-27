/**
 * What the first load knows about every language: its identity (each folder's
 * meta.ts) and its snippets' names and lengths (snippets.txt?index, read at
 * build time), enough for the picker, the pages, the address, and the lists in
 * My runs and the leaderboard. A language's rules and snippet text are in its
 * own file, fetched by loadLanguage() for the language being played or shown,
 * and for all of them when the language picker opens.
 *
 * The full list (LANGUAGES, ./index.ts) is for Node only: tests, the server and
 * the build. catalog.test.ts keeps the two in step, and fails if code the
 * browser loads imports the full list.
 */
import type { Language, LanguageInfo, LanguageMeta, SnippetInfo } from './types'

/** The order of the picker, as LANGUAGES has it. */
const ORDER = ['javascript', 'typescript', 'python', 'c', 'cpp', 'csharp', 'rust', 'go', 'assembly', 'php', 'yaml', 'postgresql', 'cobol', 'brainfuck', 'lolcode', 'playwright', 'selenium', 'pytest']

const metas = import.meta.glob<LanguageMeta>('./*/meta.ts', { eager: true, import: 'meta' })
const indexes = import.meta.glob<SnippetInfo[]>('./*/snippets.txt', { eager: true, query: '?index', import: 'default' })
const modules = import.meta.glob<Record<string, unknown>>('./*/index.ts')

export const CATALOG: LanguageInfo[] = ORDER.map((id) => ({ ...metas[`./${id}/meta.ts`], snippets: indexes[`./${id}/snippets.txt`] }))

/** A known language id: the one given, or the first language. */
export const knownLanguageId = (id: string | null | undefined) => (CATALOG.some((l) => l.id === id) ? id! : CATALOG[0].id)

export const languageInfo = (id: string): LanguageInfo => CATALOG.find((l) => l.id === knownLanguageId(id))!

const loaded = new Map<string, Language>()
const loading = new Map<string, Promise<Language>>()

/** Fetches a language once; later calls return the same promise or value. */
export function loadLanguage(id: string): Promise<Language> {
  const key = knownLanguageId(id)
  const ready = loaded.get(key)
  if (ready) return Promise.resolve(ready)
  let p = loading.get(key)
  if (!p) {
    p = modules[`./${key}/index.ts`]().then((mod) => {
      const lang = Object.values(mod).find((v): v is Language => typeof v === 'object' && v !== null && (v as Language).id === key)
      if (!lang) throw new Error(`${key}/index.ts exports no language with id ${key}`)
      loaded.set(key, lang)
      return lang
    })
    p.catch(() => loading.delete(key))
    loading.set(key, p)
  }
  return p
}

/** A language already fetched by loadLanguage(); the app loads one before it switches to it. */
export function loadedLanguage(id: string): Language {
  const lang = loaded.get(knownLanguageId(id))
  if (!lang) throw new Error(`Language ${id} isn't loaded yet: await loadLanguage() first`)
  return lang
}

export const isLanguageLoaded = (id: string) => loaded.has(knownLanguageId(id))

/** Every language, in the background: when the picker opens, so choosing one is instant. */
export const loadAllLanguages = () => Promise.all(CATALOG.map((l) => loadLanguage(l.id)))
