/**
 * Language conformance: the rules every language must meet. They run for
 * each entry in LANGUAGES, so a new language is held to all of them as soon
 * as it's registered. CLAUDE.md lists the same rules in prose.
 */
import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '.'
import { CATEGORIES, type SnippetLength } from './types'
import { tokenize } from '../lib/tokenize'
import { counts } from '../lib/engine'
import { firstMistake, hasService, play, TEST_COMPLETERS } from '../test/harness'

/** R2: snippets per language and length, so a session has variety. */
export const MIN_SNIPPETS_PER_LENGTH = 4
/** R4: longest line, roughly what the editor shows on desktop without scrolling sideways. */
export const MAX_LINE_LENGTH = 88
const LENGTHS: SnippetLength[] = ['short', 'medium', 'long']

describe('R1 · every language has a unique id', () => {
  it('ids do not repeat', () => {
    const ids = LANGUAGES.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe.each(LANGUAGES.map((l) => [l.name, l] as const))('%s', (_, lang) => {
  const snippets = lang.snippets.map((s) => [s.name, s] as const)

  it('R1 · has a name, a picker section, a lowercase extension without a dot, and keywords', () => {
    expect(lang.name.trim()).not.toBe('')
    expect(CATEGORIES).toContain(lang.category)
    expect(lang.extension).toMatch(/^[a-z0-9]+$/)
    if (!lang.symbolic) expect(lang.highlight.keywords.length).toBeGreaterThan(0)
  })

  it.each(LENGTHS)(`R2 · has at least ${MIN_SNIPPETS_PER_LENGTH} %s snippets`, (length) => {
    expect(lang.snippets.filter((s) => s.length === length).length).toBeGreaterThanOrEqual(MIN_SNIPPETS_PER_LENGTH)
  })

  it('R3 · snippet names are unique and use the language extension', () => {
    const names = lang.snippets.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
    for (const n of names) expect(n.endsWith(`.${lang.extension}`), n).toBe(true)
  })

  it.each(snippets)('R4 · %s is formatted for typing', (name, s) => {
    const lines = s.code.split('\n')
    const indent = lang.indentSize ?? 2
    const tabs = !!lang.indentWithTabs
    const offset = lang.indentOffset ?? 0
    const maxLength = Math.min(MAX_LINE_LENGTH, lang.maxLineLength ?? MAX_LINE_LENGTH)
    expect(s.code, `${name}: printable ASCII only`).toMatch(tabs ? /^[\x20-\x7e\n\t]+$/ : /^[\x20-\x7e\n]+$/)
    for (const line of lines) {
      const lead = line.match(/^[ \t]*/)![0]
      expect(line, `${name}: trailing space`).not.toMatch(/[ \t]$/)
      expect(line.slice(lead.length), `${name}: tab outside indentation: ${line}`).not.toContain('\t')
      if (tabs) expect(lead, `${name}: indent with tabs only: ${JSON.stringify(line)}`).toMatch(/^\t*$/)
      else if (lead.length > 0) {
        const steps = lead.length - offset
        expect(steps >= 0 && steps % indent === 0, `${name}: indent ${offset} + ${indent}-space steps: ${line}`).toBe(true)
      }
      const columns = lead.length * (tabs ? indent : 1) + line.length - lead.length
      expect(columns, `${name}: line too long: ${line}`).toBeLessThanOrEqual(maxLength)
    }
    expect(lines[0].trim(), `${name}: starts with a blank line`).not.toBe('')
  })

  if (lang.symbolic)
    it('R5 · highlighting colours every command, and everything else reads as a comment', () => {
      const commands = lang.highlight.commands ?? {}
      expect(Object.keys(commands).length, 'a symbolic language lists its commands').toBeGreaterThan(0)
      for (const s of lang.snippets) {
        const classes = tokenize(s.code, lang.highlight)
        ;[...s.code].forEach((ch, i) => {
          if (commands[ch]) expect(classes[i], `${s.name}: ${ch}`).toBe(commands[ch])
          else if (!/\s/.test(ch)) expect(classes[i], `${s.name}: ${ch}`).toBe('com')
        })
      }
    })
  else it('R5 · highlighting colours every snippet and its keywords occur in them', () => {
    const keywords = new Set(lang.highlight.keywords)
    let keywordHits = 0
    for (const s of lang.snippets) {
      const classes = tokenize(s.code, lang.highlight)
      expect(classes.length).toBe(s.code.length)
      keywordHits += classes.filter((c) => c === 'kw').length
    }
    expect(keywords.size).toBeGreaterThan(0)
    expect(keywordHits, 'no keyword was highlighted in any snippet: check highlight rules').toBeGreaterThan(0)
  })

  it.each(snippets)('R6 · %s plays through with auto-close and basic suggestions, typing literally', (_, s) => {
    const end = play(lang, s, { acceptSuggestions: false, service: false })
    expect(end.phase).toBe('done')
    expect(firstMistake(end)).toBeNull()
  })

  if (hasService(lang)) {
    it('R7 · has a test completer standing in for its service', () => {
      expect(TEST_COMPLETERS[lang.id], `add ${lang.id} to TEST_COMPLETERS in src/test/harness.ts`).toBeDefined()
    })

    it.each(snippets)(
      'R8 · %s typed literally with the service never lets a commit character insert a wrong word',
      (_, s) => {
        const end = play(lang, s, { acceptSuggestions: false, service: true })
        expect(end.phase).toBe('done')
        expect(firstMistake(end)).toBeNull()
      },
    )
  }

  // R9 plays each snippet in its own test: played all in one, the TypeScript
  // service's languages took about 2 s idle and passed Vitest's 5 s limit when
  // the full suite loaded the machine. The overall check sums the same plays.
  const accepted = new Map<string, ReturnType<typeof play>>()
  const playAccepting = (s: (typeof lang.snippets)[number]) => {
    let end = accepted.get(s.name)
    if (!end) accepted.set(s.name, (end = play(lang, s, { acceptSuggestions: true, service: true })))
    return end
  }

  it.each(snippets)('R9 · %s finishes without mistakes when accepting suggestions', (_, s) => {
    const end = playAccepting(s)
    expect(end.phase).toBe('done')
    expect(firstMistake(end)).toBeNull()
  })

  // A symbolic language has no words for suggestions to complete.
  if (!lang.symbolic) {
    it('R9 · accepting suggestions saves keystrokes', () => {
      let saved = 0
      let keystrokes = 0
      for (const s of lang.snippets) {
        const end = playAccepting(s)
        const c = counts(end.run)
        saved += Math.max(0, c.suggested - end.run.completions)
        keystrokes += end.run.keystrokes
      }
      console.info(`${lang.name}: accepting suggestions takes ${keystrokes} keystrokes and saves ${saved}`)
      expect(saved).toBeGreaterThan(0)
    })
  }
})
