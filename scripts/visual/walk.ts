/**
 * Opens every state at every viewport and shows it in every theme, calling
 * `visit` once per (state, theme, viewport). Themes only change colours, so a
 * state is opened once per viewport and the theme switched in place, as the
 * app does; the theme picker, whose highlighted item depends on the saved
 * theme, is reopened per theme.
 */
import { chromium, type Browser, type Page } from 'playwright'
import { BASE, FIXED_NOW, THEME_IDS, VIEWPORTS, type ViewportName } from './config'
import { fontsLoaded, HISTORY_PATH, settlePicker, STATES, type State } from './states'
import { SESSION_COOKIE, testSession } from './session'

export interface Filter {
  states?: string[]
  themes?: string[]
  viewports?: ViewportName[]
}

export type Visit = (page: Page, s: { state: State; theme: string; viewport: ViewportName }) => Promise<void>

async function openState(browser: Browser, state: State, viewport: ViewportName, theme: string) {
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport: VIEWPORTS[viewport],
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
  })
  if (state.signedIn) await ctx.addCookies([{ name: SESSION_COOKIE, value: await testSession(), url: BASE }])
  // The same "random" choices every run (the snippet a language opens on, for one).
  await ctx.addInitScript(() => {
    let seed = 1
    Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  })
  await ctx.addInitScript(
    ({ theme, aids }) => {
      if (sessionStorage.getItem('visual:seeded')) return
      sessionStorage.setItem('visual:seeded', '1')
      localStorage.setItem('syntype:theme', JSON.stringify(theme))
      localStorage.setItem('syntype:language', JSON.stringify('python'))
      localStorage.setItem('syntype:length', JSON.stringify('medium'))
      // The plain caret: the smooth one glides into place frame by frame and can rest a sub-pixel apart.
      localStorage.setItem('syntype:smoothCaret', 'false')
      for (const [k, v] of Object.entries(aids ?? {})) localStorage.setItem(`syntype:${k}`, JSON.stringify(v))
    },
    { theme, aids: state.aids },
  )
  const page = await ctx.newPage()
  await page.clock.install({ time: new Date(FIXED_NOW) })
  if (state.history) {
    await page.goto('/runs')
    await page.locator('input[type="file"]').setInputFiles(HISTORY_PATH)
    await page.getByText(/Imported|Added/).first().waitFor()
  }
  await state.open(page)
  await settle(page)
  return { ctx, page }
}

/** Fonts loaded, lazy views rendered, nothing pending. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await fontsLoaded(page)
  // Until the layout stops changing: every element's box and scroll position the same 300 ms apart
  // (transitions can resize things after opening, and lists scroll their current row into view).
  // Timed from here, not in the page: typing states pause the page's clock, timers included.
  const fingerprint = () =>
    page.evaluate(() => {
      let h = 0
      const text = [...document.querySelectorAll('body *')]
        .map((el) => {
          const r = el.getBoundingClientRect()
          return `${r.x},${r.y},${r.width},${r.height},${el.scrollTop}`
        })
        .join('|') + `|${scrollY}`
      for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
      return h
    })
  for (let tries = 0, before = await fingerprint(); tries < 50; tries++) {
    await page.waitForTimeout(300)
    const after = await fingerprint()
    if (after === before) break
    before = after
  }
  if (await page.locator('[data-slot="command-list"]').count()) await settlePicker(page)
  await page.waitForTimeout(100)
}

export async function walk(visit: Visit, filter: Filter = {}) {
  // Rendering that doesn't vary between runs: one colour profile, no font hinting or LCD text, software raster.
  const browser = await chromium.launch({
    args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--disable-gpu', '--disable-skia-runtime-opts', '--disable-partial-raster'],
  })
  const states = STATES.filter((s) => !filter.states || filter.states.includes(s.id))
  const themes = THEME_IDS.filter((t) => !filter.themes || filter.themes.includes(t))
  const viewports = (Object.keys(VIEWPORTS) as ViewportName[]).filter((v) => !filter.viewports || filter.viewports.includes(v))
  try {
    for (const state of states) {
      for (const viewport of viewports) {
        if (state.id === 'picker-theme') {
          for (const theme of themes) {
            const { ctx, page } = await openState(browser, state, viewport, theme)
            await visit(page, { state, theme, viewport })
            await ctx.close()
          }
          continue
        }
        const { ctx, page } = await openState(browser, state, viewport, themes[0])
        for (const theme of themes) {
          await page.evaluate((id) => document.documentElement.setAttribute('data-syntype-theme', id), theme)
          await settle(page)
          await visit(page, { state, theme, viewport })
        }
        await ctx.close()
      }
    }
  } finally {
    await browser.close()
  }
}

export function parseFilter(args: string[]): Filter {
  const list = (name: string) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1].split(',') : undefined
  }
  return { states: list('states'), themes: list('themes'), viewports: list('viewports') as ViewportName[] | undefined }
}
