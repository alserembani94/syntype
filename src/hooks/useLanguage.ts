import { useEffect, useState } from 'react'
import { isLanguageLoaded, loadedLanguage, loadLanguage } from '../languages/catalog'
import type { Language } from '../languages/types'

/**
 * A language with its rules and snippets, fetched on first use (catalog.ts):
 * null while it loads. My runs, the leaderboard and replays show their usual
 * skeleton meanwhile. An unknown id means the first language, as everywhere.
 * `failed`: the file couldn't be fetched (offline, or a deploy replaced it).
 */
export function useLanguage(id: string | null): { language: Language | null; failed: boolean } {
  const [, setLoadedId] = useState<string | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)
  const ready = id !== null && isLanguageLoaded(id)

  useEffect(() => {
    if (id === null || isLanguageLoaded(id)) return
    let live = true
    loadLanguage(id).then(
      () => live && setLoadedId(id),
      () => live && setFailedId(id),
    )
    return () => {
      live = false
    }
  }, [id])

  return { language: ready ? loadedLanguage(id) : null, failed: id !== null && !ready && failedId === id }
}
