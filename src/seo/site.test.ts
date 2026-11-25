/**
 * SEO rules: every language has its own page, and every page has a title and
 * description of its own, short enough for search results to show whole.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '../languages'
import { allPages, BLURBS, isSitePath, languageFromPath, robotsTxt, SITE_URL, sitemapXml } from './site'

/** Longest title and description search results show without cutting them off. */
export const MAX_TITLE = 60
export const DESCRIPTION = { min: 70, max: 160 }

const pages = allPages(LANGUAGES)

describe('SEO pages', () => {
  it('every language has its own line on what its snippets cover, and no line is left over', () => {
    expect(Object.keys(BLURBS).sort()).toEqual(LANGUAGES.map((l) => l.id).sort())
  })

  it('there is a home page and one page per language, each with its own address, title and description', () => {
    expect(pages.length).toBe(LANGUAGES.length + 1)
    for (const key of ['path', 'file', 'url', 'title', 'description'] as const) {
      const values = pages.map((p) => p[key])
      expect(new Set(values).size, `${key}s repeat`).toBe(values.length)
    }
  })

  it.each(pages.map((p) => [p.path, p] as const))('%s has a title and description search results show whole', (_, p) => {
    expect(p.title.length, p.title).toBeLessThanOrEqual(MAX_TITLE)
    expect(p.description.length, p.description).toBeGreaterThanOrEqual(DESCRIPTION.min)
    expect(p.description.length, p.description).toBeLessThanOrEqual(DESCRIPTION.max)
    expect(p.url).toBe(SITE_URL + p.path)
  })

  it('a page address names its language, however it is written', () => {
    for (const l of LANGUAGES) {
      for (const path of [`/${l.id}`, `/${l.id}/`, `/${l.id}.html`]) expect(languageFromPath(path, LANGUAGES)).toBe(l.id)
    }
    expect(languageFromPath('/', LANGUAGES)).toBeNull()
    expect(languageFromPath('/nope', LANGUAGES)).toBeNull()
  })

  it('only the home page and language pages count as the site, so the app leaves other addresses alone', () => {
    expect(isSitePath('/', LANGUAGES)).toBe(true)
    expect(isSitePath('/index.html', LANGUAGES)).toBe(true)
    expect(isSitePath('/rust', LANGUAGES)).toBe(true)
    expect(isSitePath('/code/artifact/abc', LANGUAGES)).toBe(false)
  })

  it('the sitemap lists every page, and robots.txt points to it', () => {
    const xml = sitemapXml(pages)
    for (const p of pages) expect(xml).toContain(`<loc>${p.url}</loc>`)
    expect(robotsTxt()).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
  })

  it('index.html has the blocks the page builder fills in', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    for (const block of ['seo', 'about']) {
      expect(html).toContain(`<!-- ${block}:start -->`)
      expect(html).toContain(`<!-- ${block}:end -->`)
    }
  })
})
