// Writes the site's pages after `vite build`: dist/index.html and one page per
// language (dist/python.html, served at /python), each with its own title,
// description, canonical URL, link preview tags and structured data, and an
// intro, FAQ and language list in the HTML itself, readable before any script
// runs. Also writes dist/sitemap.xml and dist/robots.txt, and the snippet data
// files the server replays submitted runs against (src/lib/snippetfiles.ts). Everything comes from
// src/seo/site.ts and the language list, loaded through Vite (the languages
// import their snippets with ?raw, which only Vite understands).
import crypto from 'node:crypto'
import fs from 'node:fs'
import { reactAriaStyles } from './react-aria-styles.mjs'
import path from 'node:path'
import { createServer } from 'vite'

const dist = 'dist'
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
let seo, LANGUAGES, snippetData, policies
try {
  seo = await server.ssrLoadModule('/src/seo/site.ts')
  policies = await server.ssrLoadModule('/src/seo/policies.ts')
  ;({ LANGUAGES } = await server.ssrLoadModule('/src/languages/index.ts'))
  snippetData = await server.ssrLoadModule('/src/lib/snippetfiles.ts')
} finally {
  await server.close()
}

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const between = (html, name, content) => {
  const re = new RegExp(`<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->`)
  if (!re.test(html)) throw new Error(`index.html has no <!-- ${name}:start --> … <!-- ${name}:end --> block`)
  return html.replace(re, `<!-- ${name}:start -->\n${content}\n    <!-- ${name}:end -->`)
}

const head_ = (page) => head(page)
function head(page) {
  const image = `${seo.SITE_URL}${seo.OG_IMAGE.path}`
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: seo.SITE_NAME,
    url: page.url,
    description: page.description,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    inLanguage: 'en',
    image,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  }
  return [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<link rel="canonical" href="${page.url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${seo.SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${page.url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="${seo.OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${seo.OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${esc(seo.OG_IMAGE.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    // "</" can't appear inside the script, or it would end it early.
    `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
  ]
    .map((l) => `    ${l}`)
    .join('\n')
}

const faq = [
  ['How is WPM counted?', 'Correct characters you typed yourself, divided by five, per minute. Text you accept from a suggestion or that the editor inserts for you counts toward a separate code speed, not your WPM.'],
  ['Can I turn the editor help off?', 'Yes. Auto-indent, auto-close and autocomplete each have a switch, and personal bests are kept apart depending on whether auto-close and autocomplete were on.'],
  ['Can I share my score?', 'Yes. On the results screen, the share button (or S) makes a square image of your run in your theme: speed, accuracy, language, snippet, the typing aids that were on and the date. Share it from your device, copy it to paste into a post, or download it. The image is made in your browser and never uploaded.'],
  ['Is it free? Do I need an account?', 'It is free, and you can play without an account: everything runs in your browser, and your settings, personal bests and run history stay on your device. Signing in with GitHub or Google is optional, and only gives you a name for the leaderboards.'],
]

/**
 * What the site is, written into each page for search engines and link previews. Once the app
 * runs it's hidden (.app-ready on <html>) and opens as a dialog (AboutDialog adds .open).
 */
const ABOUT = {
  section:
    'mx-auto mt-16 max-w-230 border-t pt-7 text-sm leading-relaxed text-muted-foreground max-sm:mt-10 in-[.app-ready]:not-[.open]:hidden [&.open]:m-0 [&.open]:max-w-none [&.open]:border-0 [&.open]:p-0',
  h2: 'm-0 mb-2 font-display text-xl font-bold tracking-tight text-foreground [.open_&]:pr-10',
  intro: 'm-0 mb-6 max-w-[72ch]',
  columns: 'grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-8 max-sm:grid-cols-1 max-sm:gap-5 [.open_&]:grid-cols-2 max-sm:[.open_&]:grid-cols-1',
  h3: 'm-0 mb-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase',
  dt: 'font-semibold text-foreground',
  dd: 'mx-0 mt-0.5 mb-3.5',
  rules: 'mt-3 mb-0 text-sm',
  rule: 'text-primary',
  list: 'm-0 list-none columns-2 gap-x-5 p-0',
  item: 'mb-1 break-inside-avoid',
  link: 'border-b text-foreground no-underline hover:border-primary hover:text-primary aria-[current=page]:border-transparent aria-[current=page]:text-primary',
}
function about(page) {
  const links = LANGUAGES.map((l) => {
    const here = l.id === page.languageId ? ' aria-current="page"' : ''
    return `          <li class="${ABOUT.item}"><a class="${ABOUT.link}" href="/${l.id}"${here}>${esc(l.name)} typing test</a></li>`
  }).join('\n')
  const qa = faq.map(([q, a]) => `          <dt class="${ABOUT.dt}">${esc(q)}</dt>\n          <dd class="${ABOUT.dd}">${esc(a)}</dd>`).join('\n')
  const rules = policies.policyPages().map((p) => `<a class="${ABOUT.rule}" href="${p.path}">${esc(p.label)}</a>`).join(' · ')
  return `    <section class="${ABOUT.section}" id="about" aria-labelledby="about-heading">
      <h2 id="about-heading" class="${ABOUT.h2}">${esc(page.heading)}</h2>
      <p class="${ABOUT.intro}">${esc(page.intro)}</p>
      <div class="${ABOUT.columns}">
        <div>
          <h3 class="${ABOUT.h3}">Questions</h3>
          <dl class="m-0">
${qa}
          </dl>
          <p class="${ABOUT.rules}">${rules}</p>
        </div>
        <nav aria-label="Languages">
          <h3 class="${ABOUT.h3}">Typing tests by language</h3>
          <ul class="${ABOUT.list}">
${links}
          </ul>
        </nav>
      </div>
    </section>`
}

// Each language's own file (rules and snippets, src/languages/catalog.ts) and the files it imports
// (a framework track's base language), from Vite's manifest, so a page can fetch the language it
// starts in alongside the app's script instead of after it. The manifest isn't deployed.
const manifestFile = path.join(dist, '.vite', 'manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
fs.rmSync(path.join(dist, '.vite'), { recursive: true })
const inEntry = new Set()
;(function walk(key) {
  if (inEntry.has(key)) return
  inEntry.add(key)
  for (const k of manifest[key].imports ?? []) walk(k)
})('index.html')
// A language another one imports statically (TypeScript imports JavaScript) becomes a shared chunk,
// listed by its chunk name rather than its source path.
function languageKey(id) {
  const key = manifest[`src/languages/${id}/index.ts`] ? `src/languages/${id}/index.ts` : Object.keys(manifest).find((k) => k.startsWith(`_${id}-`))
  if (!key) throw new Error(`No file for the language ${id} in Vite's manifest`)
  return key
}
const languageFiles = Object.fromEntries(
  LANGUAGES.map((l) => {
    const files = []
    ;(function walk(key) {
      if (inEntry.has(key) || files.includes(`./${manifest[key].file}`)) return
      for (const k of manifest[key].imports ?? []) walk(k)
      files.push(`./${manifest[key].file}`)
    })(languageKey(l.id))
    return [l.id, files]
  }),
)
const preload = (files) => files.map((f) => `    <link rel="modulepreload" crossorigin href="${f}" />`).join('\n')
/** A language page preloads its language; the others, the language the app will start in (src/lib/address.ts). */
function languageBlock(page, { query = false } = {}) {
  if (page.languageId) return preload(languageFiles[page.languageId])
  return `    <script id="language-boot">
      try {
        var files = ${JSON.stringify(languageFiles)}
        var id = ${query ? "new URLSearchParams(location.search).get('lang')" : 'null'}
        if (!files[id]) id = JSON.parse(localStorage.getItem('syntype:language'))
        if (!files[id]) id = ${JSON.stringify(LANGUAGES[0].id)}
        files[id].forEach(function (f) {
          var l = document.createElement('link')
          l.rel = 'modulepreload'
          l.crossOrigin = ''
          l.href = f
          document.head.appendChild(l)
        })
      } catch (e) {}
    </script>`
}

const pages = seo.allPages(LANGUAGES)
for (const page of pages) {
  let html = between(template, 'seo', head(page))
  html = between(html, 'about', about(page))
  html = between(html, 'language', languageBlock(page, { query: page.path === '/leaderboard' }))
  fs.writeFileSync(path.join(dist, page.file), html)
}
// The personal board: personal content kept on the device, so not indexed and not in the sitemap.
{
  const runs = seo.RUNS_PAGE
  const home = pages[0]
  let html = between(template, 'seo', [`    <title>${esc(runs.title)}</title>`, `    <meta name="robots" content="noindex" />`].join('\n'))
  html = between(html, 'about', about(home))
  html = between(html, 'language', languageBlock(runs, { query: true }))
  fs.writeFileSync(path.join(dist, runs.file), html)
}
// The privacy and fair-play pages: plain reading, no app (src/seo/policies.ts). Styled with the
// design system's utility classes, written here; src/styles/app.css scans this file for them.
const LINK = 'text-primary underline-offset-4 hover:underline'
const inline = (text) => esc(text).replace(/\[([^\]]+)\]\((https:[^)\s]+)\)/g, (_, words, href) => `<a class="${LINK}" href="${href}" rel="noreferrer">${words}</a>`)
/** The app header's nav links (src/blocks/Header.tsx), as plain links. */
const NAV_LINK =
  'inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground no-underline outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-accent aria-[current=page]:text-primary'
function policyHtml(page, all) {
  // The site's head (styles, fonts, saved theme), without the app's scripts.
  const head = between(template, 'seo', head_(page)).match(/<head>[\s\S]*<\/head>/)[0].replace(/\s*<script type="module"[^>]*><\/script>/g, '').replace(/\s*<link rel="modulepreload"[^>]*>/g, '')
  const nav = [{ path: '/', label: 'Typing test' }, { path: '/leaderboard', label: 'Leaderboards' }, ...all.map((p) => ({ path: p.path, label: p.label }))]
    .map((l) => `<a class="${NAV_LINK}" href="${l.path}"${l.path === page.path ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`)
    .join('\n          ')
  const sections = page.sections
    .map((sec) => {
      const blocks = []
      let list = []
      const flush = () => {
        if (list.length) blocks.push(`<ul class="m-0 grid list-disc gap-1 pl-5">${list.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`)
        list = []
      }
      for (const line of sec.body) {
        if (line.startsWith('- ')) {
          list.push(line.slice(2))
        } else {
          flush()
          blocks.push(`<p class="m-0">${inline(line)}</p>`)
        }
      }
      flush()
      return `      <section class="grid gap-2.5 border-t pt-4">\n        <h2 class="m-0 font-display text-xl font-bold tracking-tight">${esc(sec.heading)}</h2>\n        ${blocks.join('\n        ')}\n      </section>`
    })
    .join('\n')
  return `<!doctype html>
<html lang="en">
  ${head}
  <body>
    <div class="mx-auto grid max-w-3xl gap-6 leading-relaxed">
      <header class="flex flex-wrap items-center gap-3 sm:gap-5">
        <a class="text-foreground no-underline" href="/"><span class="font-display text-3xl font-bold tracking-tight [text-shadow:var(--code-glow)]">Syn<span class="text-primary">type</span></span></a>
        <nav aria-label="Site" class="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
          ${nav}
        </nav>
      </header>
      <main class="grid gap-6">
        <h1 class="m-0 mt-2 font-display text-4xl font-bold tracking-tight text-balance">${esc(page.heading)}</h1>
        <p class="m-0 text-lg">${esc(page.intro)}</p>
${sections}
      </main>
    </div>
  </body>
</html>
`
}
const policyList = policies.policyPages()
for (const page of policyList) fs.writeFileSync(path.join(dist, page.file), policyHtml(page, policyList))
fs.writeFileSync(path.join(dist, 'sitemap.xml'), seo.sitemapXml([...pages, ...policyList]))
// One file per snippet, and an index of the current ones.
const files = await snippetData.snippetFiles(LANGUAGES)
const dataDir = path.join(dist, snippetData.SNIPPET_DATA_PATH)
fs.mkdirSync(dataDir, { recursive: true })
for (const f of files) fs.writeFileSync(path.join(dataDir, `${f.fingerprint}.json`), JSON.stringify(f))
fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify(files.map(({ fingerprint, language, name, length }) => ({ fingerprint, language, name, length }))))
fs.writeFileSync(path.join(dist, 'robots.txt'), seo.robotsTxt())
// The Content Security Policy (public/_headers): only our own scripts, Turnstile,
// and the inline code the built pages actually contain, by hash.
// Enforced: every page type was checked on the live site in report-only mode first (Nov 2026).
const CSP_ENFORCED = true
const hashOf = (text) => `'sha256-${crypto.createHash('sha256').update(text).digest('base64')}'`
const decode = (v) => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const inlineScripts = new Set()
const inlineHandlers = new Set()
for (const file of fs.readdirSync(dist).filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(dist, file), 'utf8')
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!/type="application\/ld\+json"/.test(m[1]) && m[2].trim()) inlineScripts.add(hashOf(m[2]))
  }
  for (const m of html.matchAll(/\son[a-z]+="([^"]*)"/g)) inlineHandlers.add(hashOf(decode(m[1])))
}
const csp = [
  "default-src 'self'",
  // Cloudflare Web Analytics' beacon is injected by Cloudflare at its versioned address
  // (/beacon.min.js/v…), so the whole host is allowed; it reports to our own /cdn-cgi/rum.
  `script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com ${[...inlineScripts].join(' ')}${inlineHandlers.size ? ` 'unsafe-hashes' ${[...inlineHandlers].join(' ')}` : ''}`,
  // React Aria adds two fixed <style> elements at runtime (scripts/react-aria-styles.mjs); only those, by hash.
  `style-src 'self' https://fonts.googleapis.com ${reactAriaStyles().map(hashOf).join(' ')}`,
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data:",
  "connect-src 'self'",
  'frame-src https://challenges.cloudflare.com',
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')
const headersFile = path.join(dist, '_headers')
fs.writeFileSync(headersFile, fs.readFileSync(headersFile, 'utf8').replace('__CSP__', `${CSP_ENFORCED ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only'}: ${csp}`))

console.log(`${dist}/: ${pages.length} pages, ${seo.RUNS_PAGE.file}, ${policyList.map((p) => p.file).join(', ')}, sitemap.xml, robots.txt, ${files.length} snippet data files`)
