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
  ['Is it free? Do I need an account?', 'It is free, and you can play without an account: everything runs in your browser, and your settings, personal bests and run history stay on your device. Signing in with GitHub or Google is optional, and only gives you a name for the leaderboards.'],
]

function about(page) {
  const links = LANGUAGES.map((l) => {
    const here = l.id === page.languageId ? ' aria-current="page"' : ''
    return `          <li><a href="/${l.id}"${here}>${esc(l.name)} typing test</a></li>`
  }).join('\n')
  const qa = faq.map(([q, a]) => `          <dt>${esc(q)}</dt>\n          <dd>${esc(a)}</dd>`).join('\n')
  const rules = policies.policyPages().map((p) => `<a href="${p.path}">${esc(p.label)}</a>`).join(' · ')
  return `    <section class="about" id="about" aria-labelledby="about-heading">
      <h2 id="about-heading">${esc(page.heading)}</h2>
      <p>${esc(page.intro)}</p>
      <div class="about-columns">
        <div>
          <h3>Questions</h3>
          <dl>
${qa}
          </dl>
          <p class="about-links">${rules}</p>
        </div>
        <nav aria-label="Languages">
          <h3>Typing tests by language</h3>
          <ul>
${links}
          </ul>
        </nav>
      </div>
    </section>`
}

const pages = seo.allPages(LANGUAGES)
for (const page of pages) {
  let html = between(template, 'seo', head(page))
  html = between(html, 'about', about(page))
  fs.writeFileSync(path.join(dist, page.file), html)
}
// The personal board: personal content kept on the device, so not indexed and not in the sitemap.
{
  const runs = seo.RUNS_PAGE
  const home = pages[0]
  let html = between(template, 'seo', [`    <title>${esc(runs.title)}</title>`, `    <meta name="robots" content="noindex" />`].join('\n'))
  html = between(html, 'about', about(home))
  fs.writeFileSync(path.join(dist, runs.file), html)
}
// The privacy and fair-play pages: plain reading, no app (src/seo/policies.ts).
const inline = (text) => esc(text).replace(/\[([^\]]+)\]\((https:[^)\s]+)\)/g, (_, words, href) => `<a href="${href}" rel="noreferrer">${words}</a>`)
function policyHtml(page, all) {
  // The site's head (styles, fonts, saved theme), without the app's scripts.
  const head = between(template, 'seo', head_(page)).match(/<head>[\s\S]*<\/head>/)[0].replace(/\s*<script type="module"[^>]*><\/script>/g, '').replace(/\s*<link rel="modulepreload"[^>]*>/g, '')
  const nav = [{ path: '/', label: 'Typing test' }, { path: '/leaderboard', label: 'Leaderboards' }, ...all.map((p) => ({ path: p.path, label: p.label }))]
    .map((l) => `<a href="${l.path}"${l.path === page.path ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`)
    .join('\n          ')
  const sections = page.sections
    .map((sec) => {
      const blocks = []
      let list = []
      const flush = () => {
        if (list.length) blocks.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`)
        list = []
      }
      for (const line of sec.body) {
        if (line.startsWith('- ')) {
          list.push(line.slice(2))
        } else {
          flush()
          blocks.push(`<p>${inline(line)}</p>`)
        }
      }
      flush()
      return `      <section>\n        <h2>${esc(sec.heading)}</h2>\n        ${blocks.join('\n        ')}\n      </section>`
    })
    .join('\n')
  return `<!doctype html>
<html lang="en">
  ${head}
  <body>
    <main class="policy">
      <header class="policy-top">
        <a class="brand-link" href="/"><span class="brand-word">Syn<span>type</span></span></a>
        <nav aria-label="Site">
          ${nav}
        </nav>
      </header>
      <h1>${esc(page.heading)}</h1>
      <p class="lede">${esc(page.intro)}</p>
${sections}
    </main>
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
const CSP_ENFORCED = false // report-only until the live pages are checked for violations
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
  "style-src 'self' https://fonts.googleapis.com",
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
