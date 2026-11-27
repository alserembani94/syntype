import type { SnippetLength } from '../languages/types'

/** Personal bests keyed by "languageId:length", plus a suffix for each assist that was on. */
export type Bests = Record<string, number>

/**
 * Bests saved before the rename used ":intellisense" in their keys. Bests for
 * the old "any" length mixed snippet lengths, so they're dropped.
 */
export const migrateBests = (bests: Bests): Bests =>
  Object.fromEntries(
    Object.entries(bests)
      .filter(([k]) => k.split(':')[1] !== 'any')
      .map(([k, v]) => [k.replace(/:intellisense$/, ':autocomplete'), v]),
  )

/** A saved length, with the old "any" (or anything unknown) becoming medium. */
export const savedLength = (value: unknown): SnippetLength =>
  value === 'short' || value === 'medium' || value === 'long' ? value : 'medium'
