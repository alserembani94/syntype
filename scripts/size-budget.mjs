/**
 * The first-load budget: what every visitor's first visit to the typing page
 * downloads, gzipped. `npm run build` fails above it (scripts/build-pages.mjs
 * checks it last), so an import that drags a picker or a React Aria piece into
 * the first load can't deploy unnoticed. `npm run report:size` prints the same
 * numbers. On-demand chunks aren't limited: only the people who open them pay.
 *
 * Raising a limit is allowed, deliberately: say why in a comment beside it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

/** KB gzip. Set at about 5% above the size on 28 Nov 2026 (137.3 KB JS, 22.9 KB CSS). */
export const BUDGET = { js: 145, css: 24 }

const kb = (bytes) => Math.round(bytes / 102.4) / 10

/** The scripts and stylesheets a page names directly (loaded first, before any lazy chunk). */
export const firstLoadFiles = (dist, html) => [
  ...new Set(
    [...readFileSync(join(dist, html), 'utf8').matchAll(/(?:src|href)="\.?\/?((?:admin-)?assets\/[^"]+\.(?:js|css))"/g)].map(
      (m) => m[1],
    ),
  ),
]

/** Files' total size as served (gzip level 9), in KB. */
export const gzipKb = (...files) => kb(files.reduce((t, f) => t + gzipSync(readFileSync(f), { level: 9 }).length, 0))

/** The typing page's first load: JS and CSS, in KB gzip. */
export function firstLoad(dist) {
  const files = firstLoadFiles(dist, 'index.html').map((f) => join(dist, f))
  return { js: gzipKb(...files.filter((f) => f.endsWith('.js'))), css: gzipKb(...files.filter((f) => f.endsWith('.css'))) }
}

/** Each part over its limit, with a message saying by how much and what to do; empty when within budget. */
export function overBudget(size, budget = BUDGET) {
  const names = { js: 'JavaScript', css: 'CSS' }
  return Object.keys(budget)
    .filter((part) => size[part] > budget[part])
    .map(
      (part) =>
        `First-load ${names[part]} is ${size[part]} KB gzip, over its ${budget[part]} KB budget by ` +
        `${Math.round((size[part] - budget[part]) * 10) / 10} KB.`,
    )
}

export const OVER_BUDGET_HELP =
  'Find what grew with `npm run report:bundle` (often a static import of something that should load on demand, ' +
  'see CLAUDE.md, Performance) and load it with lazy() or import(). If the growth is worth it, raise the limit ' +
  'in scripts/size-budget.mjs with a comment saying why.'
