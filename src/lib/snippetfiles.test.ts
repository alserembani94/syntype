import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '../languages'
import { computePairs } from './pairs'
import { expandPairs, snippetFiles } from './snippetfiles'

describe('snippet data files for the server', () => {
  it('covers every snippet once, with a fingerprint of its own', async () => {
    const files = await snippetFiles(LANGUAGES)
    expect(files.length).toBe(LANGUAGES.reduce((n, l) => n + l.snippets.length, 0))
    expect(new Set(files.map((f) => f.fingerprint)).size).toBe(files.length)
  })

  it('pairs come back exactly as the game computes them', async () => {
    const files = await snippetFiles(LANGUAGES)
    for (const f of files) {
      const lang = LANGUAGES.find((l) => l.id === f.language)!
      expect(expandPairs(f.pairs, f.code.length), `${f.language}/${f.name}`).toEqual(computePairs(f.code, lang))
    }
  })

  it('each file is small', async () => {
    const sizes = (await snippetFiles(LANGUAGES)).map((f) => JSON.stringify(f).length)
    expect(Math.max(...sizes)).toBeLessThan(8000)
  })
})
