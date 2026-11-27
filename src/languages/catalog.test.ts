import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '.'
import { CATALOG, knownLanguageId, loadedLanguage, loadLanguage } from './catalog'

const identity = (l: (typeof CATALOG)[number]) => ({
  id: l.id,
  name: l.name,
  category: l.category,
  aliases: l.aliases,
  basedOn: l.basedOn,
  symbolic: l.symbolic,
  extension: l.extension,
  snippets: l.snippets.map((s) => ({ name: s.name, length: s.length })),
})

describe('the language catalog', () => {
  it('lists every language, in the order of LANGUAGES, with the same identity and snippets', () => {
    expect(CATALOG.map(identity)).toEqual(LANGUAGES.map(identity))
  })

  it('loads each language as the same object LANGUAGES holds', async () => {
    for (const l of LANGUAGES) {
      expect(await loadLanguage(l.id)).toBe(l)
      expect(loadedLanguage(l.id)).toBe(l)
    }
  })

  it('treats an unknown id as the first language, as before', () => {
    expect(knownLanguageId('klingon')).toBe(CATALOG[0].id)
    expect(knownLanguageId(null)).toBe(CATALOG[0].id)
  })
})

// The full list bundles every language's rules and snippet text; code the browser loads uses the catalog.
describe('the first load stays free of other languages', () => {
  const src = join(__dirname, '..')
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []))
  const browserCode = files(src).filter((f) => {
    const rel = relative(src, f)
    return !/\.test\.tsx?$|\.d\.ts$/.test(rel) && !rel.startsWith('languages/') && !rel.startsWith('test/')
  })

  it.each(browserCode.map((f) => [relative(src, f), f]))('%s imports languages only through the catalog and types', (_, f) => {
    const imports = [...readFileSync(f, 'utf8').matchAll(/from\s+'([^']*languages(?:\/[a-z]+)*)'/g)].map((m) => m[1])
    for (const path of imports) expect(path, `${path} in ${f}`).toMatch(/languages\/(catalog|types|snippets)$/)
  })
})
