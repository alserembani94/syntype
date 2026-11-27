/**
 * What search engines and link previews see: the site's address, and a page
 * per language (/python, /rust …) with its own title, description and intro.
 * scripts/build-pages.mjs writes the pages at build time; the app uses the
 * same titles when the language changes. src/seo/site.test.ts checks them.
 */
import type { Language } from '../languages/types'

export const SITE_URL = 'https://syntype.vercel.my'
export const SITE_NAME = 'Syntype'
/** The link preview image (public/og.png), 1200 × 630. */
export const OG_IMAGE = { path: '/og.png', width: 1200, height: 630, alt: 'Syntype: a typing speed test for real code' }

/**
 * One line on what each language's snippets cover, written from the snippets
 * themselves so every page says something specific. A new language needs one.
 */
export const BLURBS: Record<string, string> = {
  javascript: 'debounce, reducers, fetch helpers and an Express server',
  typescript: 'interfaces, generics and an LRU cache, with type-aware autocomplete',
  python: 'list comprehensions, dataclasses and async functions',
  c: 'pointers, structs, malloc and realloc, file I/O, qsort and a hash table',
  rust: 'structs, impl blocks, Result and iterators',
  go: 'structs, slices, interfaces and error handling',
  assembly: 'NASM syntax, syscalls, loops, string functions and a bubble sort',
  php: 'classes, enums, JSON responses and a repository class',
  yaml: 'GitHub Actions, Docker Compose, Kubernetes and OpenAPI files',
  postgresql: 'joins, window functions, upserts, recursive queries and triggers',
  cobol: 'fixed-format divisions, PERFORM loops, EVALUATE and reports',
  brainfuck: 'eight-symbol programs, from Hello World to uppercase conversion',
  lolcode: 'HAI to KTHXBYE: variables, loops, O RLY? and FizzBuzz',
  playwright: 'locators, web-first assertions, fixtures and page objects',
  selenium: 'WebDriver waits, dropdowns, headless runs and page objects',
  pytest: 'fixtures, parametrize, pytest.raises, monkeypatch and tmp_path',
}

export interface Page {
  /** "/" or "/python". */
  path: string
  /** The file the build writes, relative to dist/. */
  file: string
  url: string
  title: string
  description: string
  /** The page's main heading and intro paragraph, in the HTML before any script runs. */
  heading: string
  intro: string
  /** The language the page opens with, if it's a language page. */
  languageId?: string
}


const homePage = (languages: Language[]): Page => ({
  path: '/',
  file: 'index.html',
  url: `${SITE_URL}/`,
  title: 'Code Typing Test: Practice Typing Real Code | Syntype',
  description: `A typing speed test for programmers: type real code in ${languages.length} languages, from JavaScript and Python to COBOL, with VS Code-style autocomplete. Free.`,
  heading: 'Typing speed, measured in code',
  intro: `Syntype is a typing test for programmers. Instead of English words, you type real snippets in ${languages.length} languages, with the editor helping the way VS Code does: brackets close themselves, indentation follows you and suggestions appear as you type. No clock or score gets in the way; your WPM, accuracy and consistency appear when you finish.`,
})

export function languagePage(lang: Language): Page {
  const blurb = BLURBS[lang.id] ?? ''
  const on = lang.basedOn ? ` (${lang.basedOn})` : ''
  return {
    path: `/${lang.id}`,
    file: `${lang.id}.html`,
    url: `${SITE_URL}/${lang.id}`,
    title: `${lang.name} Typing Test for Programmers | Syntype`,
    description: `Practice typing real ${lang.name}${on} code: ${blurb}. Free typing test with WPM and accuracy.`,
    heading: `${lang.name} typing test`,
    intro: `Type real ${lang.name}${on} code: ${blurb}. ${lang.snippets.length} snippets in short, medium and long lengths, with auto-close and autocomplete as in VS Code. Your WPM, accuracy and the keys you missed appear when you finish.`,
    languageId: lang.id,
  }
}

/** The global leaderboards, at /leaderboard: public, so indexed and in the sitemap. */
export const leaderboardPage = (languages: Language[]): Page => ({
  path: '/leaderboard',
  file: 'leaderboard.html',
  url: `${SITE_URL}/leaderboard`,
  title: 'Code Typing Leaderboards by Language | Syntype',
  description: `The fastest typists of real code on every Syntype snippet, in ${languages.length} languages. Each board ranks players by WPM, with replays of the top runs.`,
  heading: 'Code typing leaderboards',
  intro: `Every snippet in Syntype has its own leaderboard: the fastest signed-in players, ranked by WPM with at least 75% accuracy, each run checked by replaying its keystrokes. Filter by typing aids, and watch replays of the top runs.`,
})

export const allPages = (languages: Language[]): Page[] => [homePage(languages), ...languages.map(languagePage), leaderboardPage(languages)]

/** The language a page address names (/python, /python.html, /python/), if any. */
export function languageFromPath(pathname: string, languages: Language[]): string | null {
  const slug = pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '')
  return languages.some((l) => l.id === slug) ? slug : null
}

/**
 * The personal board, at /runs. Its content is personal and lives on the
 * device, so search engines are told not to index it, and it's left out of
 * the sitemap.
 */
export const RUNS_PAGE = { path: '/runs', file: 'runs.html', title: 'My runs | Syntype' }

export const isRunsPath = (pathname: string) => /^\/runs(\.html)?\/?$/.test(pathname)

export const isLeaderboardPath = (pathname: string) => /^\/leaderboard(\.html)?\/?$/.test(pathname)

/** Whether this page is the site itself (home, a language page, /runs or /leaderboard), so it can keep the address in step with what's shown. */
export function isSitePath(pathname: string, languages: Language[]): boolean {
  return /^\/(index\.html)?$/.test(pathname) || languageFromPath(pathname, languages) !== null || isRunsPath(pathname) || isLeaderboardPath(pathname)
}

export function sitemapXml(pages: Page[]): string {
  const urls = pages.map((p) => `  <url><loc>${p.url}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
