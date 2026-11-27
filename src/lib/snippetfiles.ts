/**
 * The snippets as data files for the server (docs/leaderboard.md, "Submitting
 * a run"). The build writes one file per snippet, dist/data/snippets/<fingerprint>.json,
 * plus an index of every current snippet; the Worker reads them through its
 * static assets to replay a submitted run against the exact text, and its
 * auto-close pairs, that the game used. A fingerprint the files don't have is
 * not a snippet the game offers, so it can't be submitted.
 */
import { computePairs, type Pairs } from './pairs'
import { fingerprint } from './runcore'
import type { Language, SnippetLength } from '../languages/types'

export const SNIPPET_DATA_PATH = '/data/snippets'

/** Pairs, without the long arrays of "nothing here". */
export interface CompactPairs {
  /** [opener, closer] positions. */
  close: [number, number][]
  /** Positions where auto-close may happen. */
  allowed: number[]
  before: string
}

export interface SnippetFile {
  fingerprint: string
  language: string
  name: string
  length: SnippetLength
  code: string
  pairs: CompactPairs
}

export interface SnippetIndexEntry {
  fingerprint: string
  language: string
  name: string
  length: SnippetLength
}

function compactPairs(p: Pairs): CompactPairs {
  const close: [number, number][] = []
  const allowed: number[] = []
  p.closeOf.forEach((c, i) => c >= 0 && close.push([i, c]))
  p.allowed.forEach((a, i) => a && allowed.push(i))
  return { close, allowed, before: p.autoCloseBefore }
}

export function expandPairs(c: CompactPairs, length: number): Pairs {
  const closeOf = new Array<number>(length).fill(-1)
  const allowed = new Array<boolean>(length).fill(false)
  for (const [i, j] of c.close) closeOf[i] = j
  for (const i of c.allowed) allowed[i] = true
  return { closeOf, allowed, autoCloseBefore: c.before }
}

/** Every snippet of every language, as the files the build writes. */
export async function snippetFiles(languages: Language[]): Promise<SnippetFile[]> {
  const files: SnippetFile[] = []
  for (const lang of languages) {
    for (const s of lang.snippets) {
      files.push({
        fingerprint: await fingerprint(s.code),
        language: lang.id,
        name: s.name,
        length: s.length,
        code: s.code,
        pairs: compactPairs(computePairs(s.code, lang)),
      })
    }
  }
  return files
}
