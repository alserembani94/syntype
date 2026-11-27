/**
 * What the page's address says, read once at startup. On the site itself
 * (home or a language page such as /python), the address names the language:
 * opening /python starts in Python, and choosing another language moves to its
 * page. Elsewhere (the single-file artifact) the address is left alone.
 */
import { CATALOG, knownLanguageId } from '../languages/catalog'
import { isLeaderboardPath, isRunsPath, isSitePath, languageFromPath } from '../seo/site'
import { load } from './storage'

export const onSite = typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && isSitePath(location.pathname, CATALOG)
/** The language and length a page's address names: /python, or ?lang= and ?length= on /runs and /leaderboard. One setting for the whole app. */
const boardQuery = onSite && (isRunsPath(location.pathname) || isLeaderboardPath(location.pathname)) ? new URLSearchParams(location.search) : null
const languageInAddress = onSite
  ? (languageFromPath(location.pathname, CATALOG) ?? (CATALOG.some((l) => l.id === boardQuery?.get('lang')) ? boardQuery!.get('lang') : null))
  : null
export const lengthInAddress = boardQuery?.get('length') ?? null

/** The language to start in: a language page (/python) wins over the one saved from last time. main.tsx loads it before the first render. */
export const startLanguageId = () => knownLanguageId(languageInAddress ?? load('language', ''))
