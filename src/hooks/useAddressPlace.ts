/**
 * A view's place (which snippet, which replay…) kept in the address on the
 * site, so Back, Forward and shared links work: /runs?lang=…, /leaderboard?lang=….
 * The language and length are the app's, shared by every view; the rest is
 * the view's own. Off the site (the artifact, the preview) the place lives
 * in state only.
 */
import { useEffect, useRef, useState } from 'react'
import type { SnippetLength } from '../languages/types'

/** How a view's own part of the place reads from and writes to the query string. */
export interface AddressSpec<Own> {
  path: string
  empty: Own
  read: (q: URLSearchParams) => Own
  /** Adds the view's own parameters, leaving out defaults. */
  write: (own: Own, q: URLSearchParams) => void
}

type Place<Own> = Own & { language: string; length: SnippetLength }

const isLength = (s: string | null): s is SnippetLength => s === 'short' || s === 'medium' || s === 'long'

interface Shared {
  language: string
  length: SnippetLength
  onLanguage: (id: string) => void
  onLength: (l: SnippetLength) => void
  inAddress: boolean
}

export function useAddressPlace<Own extends object>(spec: AddressSpec<Own>, { language, length, onLanguage, onLength, inAddress }: Shared) {
  const fromAddress = (fallback: { language: string; length: SnippetLength }): Place<Own> => {
    const q = new URLSearchParams(location.search)
    const l = q.get('length')
    return { ...spec.read(q), language: q.get('lang') ?? fallback.language, length: isLength(l) ? l : fallback.length }
  }
  const [own, setOwn] = useState<Own>(() => (inAddress ? spec.read(new URLSearchParams(location.search)) : spec.empty))
  const place = { ...own, language, length } as Place<Own>

  // The back button steps out of a snippet or a replay, and can change the language and length too.
  const latest = useRef({ language, length, onLanguage, onLength, fromAddress })
  useEffect(() => {
    latest.current = { language, length, onLanguage, onLength, fromAddress }
  })
  useEffect(() => {
    if (!inAddress) return
    const onPop = () => {
      const now = latest.current
      const next = now.fromAddress(now)
      setOwn(next)
      if (next.language !== now.language) now.onLanguage(next.language)
      if (next.length !== now.length) now.onLength(next.length)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [inAddress])

  /** Moves to another place; `push` makes it a step Back returns from. */
  const go = (changes: Partial<Place<Own>>, push = false) => {
    const next = { ...place, ...changes }
    setOwn(next)
    if (next.language !== language) onLanguage(next.language)
    if (next.length !== length) onLength(next.length)
    if (!inAddress) return
    const q = new URLSearchParams({ lang: next.language, length: next.length })
    spec.write(next, q)
    const url = `${spec.path}?${q}`
    if (push) window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
  }

  return [place, go] as const
}
