// Writes the site's pages after `vite build`: dist/index.html and one page per
// language (dist/python.html, served at /python), each with its own title,
// description, canonical URL, link preview tags and structured data, and an
// intro, FAQ and language list in the HTML itself, readable before any script
// runs. Also writes dist/sitemap.xml and dist/robots.txt. Everything comes from
// src/seo/site.ts and the language list, loaded through Vite (the languages
// import their snippets with ?raw, which only Vite understands).
import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'

const dist = 'dist'
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
let seo, LANGUAGES
try {
  seo = await server.ssrLoadModule('/src/seo/site.ts')
  ;({ LANGUAGES } = await server.ssrLoadModule('/src/languages/index.ts'))
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
  ['Is it free? Do I need an account?', 'It is free and there is no account. Everything runs in your browser, and your settings, personal bests and run history stay on your device.'],
]

function about(page) {
  const links = LANGUAGES.map((l) => {
    const here = l.id === page.languageId ? ' aria-current="page"' : ''
    return `          <li><a href="/${l.id}"${here}>${esc(l.name)} typing test</a></li>`
  }).join('\n')
  const qa = faq.map(([q, a]) => `          <dt>${esc(q)}</dt>\n          <dd>${esc(a)}</dd>`).join('\n')
  return `    <section class="about" id="about" aria-labelledby="about-heading">
      <h2 id="about-heading">${esc(page.heading)}</h2>
      <p>${esc(page.intro)}</p>
      <div class="about-columns">
        <div>
          <h3>Questions</h3>
          <dl>
${qa}
          </dl>
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
fs.writeFileSync(path.join(dist, 'sitemap.xml'), seo.sitemapXml(pages))
fs.writeFileSync(path.join(dist, 'robots.txt'), seo.robotsTxt())
console.log(`${dist}/: ${pages.length} pages, ${seo.RUNS_PAGE.file}, sitemap.xml, robots.txt`)
