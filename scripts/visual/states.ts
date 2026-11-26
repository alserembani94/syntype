/**
 * The screens and states the visual and accessibility checks capture. Each
 * one opens from a fresh browser context at the fixed time (config.ts); the
 * signed-in ones carry the test player's session, the My runs ones import
 * fixtures/history.json first. Typing states replay a recorded run from the
 * fixtures key by key, advancing the paused clock by each recorded gap, so a
 * run's results are the same every time.
 */
import type { Page } from 'playwright'
import { readFileSync } from 'node:fs'
import type { LogEntry } from '../../src/lib/runcore'

export interface State {
  id: string
  area: 'Typing' | 'Overlays' | 'My runs' | 'Leaderboards' | 'Pages' | 'Admin' | 'Gallery'
  title: string
  signedIn?: boolean
  /** Import the run history fixture before opening. */
  history?: boolean
  /** Typing aids to start with (saved settings), for the typing states. */
  aids?: { autoIndent: boolean; autoClose: boolean; autocomplete: boolean }
  open: (page: Page) => Promise<void>
}

interface HistoryFile {
  runs: { id: string; language: string; snippet: string; aids: { autoIndent: boolean; autoClose: boolean; autocomplete: boolean } }[]
  logs: { id: string; log: LogEntry[] }[]
}
export const HISTORY_PATH = 'scripts/visual/fixtures/history.json'
const history = (): HistoryFile => JSON.parse(readFileSync(HISTORY_PATH, 'utf8'))
const recorded = (id: string) => {
  const h = history()
  return { run: h.runs.find((r) => r.id === id)!, log: h.logs.find((l) => l.id === id)!.log }
}

const KEYS: Record<string, string> = { '\n': 'Enter', '\t': 'Tab', ' ': ' ' }
/** The moves a log records (src/lib/engine.ts): over auto-inserted text. */
const MOVES: Record<string, string> = { right: 'ArrowRight', end: 'End', down: 'ArrowDown' }

/**
 * Presses a recorded log's keys, advancing the paused clock by each entry's
 * gap. `wrongAt` swaps the key at that entry for a wrong one (the caret still
 * moves on, so the rest of the log stays in step); `until` stops early once
 * it's true, checked after each key.
 */
async function replayKeys(page: Page, log: LogEntry[], opts: { wrongAt?: number; until?: () => Promise<boolean> } = {}) {
  for (const [i, e] of log.entries()) {
    await page.clock.runFor(e[e.length - 1] as number)
    if (e[0] === 'k') await page.keyboard.press(i === opts.wrongAt ? (e[1] === 'q' ? 'z' : 'q') : (KEYS[e[1]] ?? e[1]))
    else if (e[0] === 'b') await page.keyboard.press(e[1] ? 'Control+Backspace' : 'Backspace')
    else if (e[0] === 'm') await page.keyboard.press(MOVES[e[1]] ?? 'ArrowRight')
    else if (e[0] === 'a') await page.keyboard.press('Tab')
    else continue
    if (opts.until && (await opts.until())) break
  }
  await page.clock.runFor(50)
}

/** Opens a snippet on the typing screen, through its board's "Type this snippet". */
async function typeSnippet(page: Page, length: string, snippet: string) {
  await page.goto(`/leaderboard?lang=python&length=${length}&snippet=${encodeURIComponent(snippet)}`)
  await page.getByRole('button', { name: 'Type this snippet' }).click()
  await page.locator('.editor').waitFor()
}

/** Pauses the clock (it was installed at the fixed time) so typing timings are exact. */
const pause = async (page: Page) => page.clock.pauseAt(new Date(Date.parse(await page.evaluate(() => new Date().toISOString())) + 1000))

/**
 * Loads every font face the page declares (each weight and subset), so nothing
 * changes size later when a weight is first used, such as a dialog's footer.
 */
export async function fontsLoaded(page: Page) {
  await page.evaluate(async () => {
    await Promise.all([...document.fonts].map((f) => f.load().catch(() => undefined)))
    await document.fonts.ready
  })
}

/**
 * Redoes the picker's own scroll to its current row once the layout is final
 * (walk.ts calls it after the layout settles). Opening scrolls it into view
 * while the search field is still growing, so the offset could vary by a pixel or two.
 */
export async function settlePicker(page: Page) {
  await page.locator('.picker-list').evaluate((list) => {
    list.scrollTop = 0
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  })
}

/** Stops a replay and sets it to 40% through, so the frame is the same every time. */
async function holdReplay(page: Page) {
  const slider = page.getByRole('slider', { name: 'Position in the replay' })
  await slider.waitFor()
  const pauseButton = page.getByRole('button', { name: 'Pause' })
  if (await pauseButton.count()) await pauseButton.click()
  const max = Number(await slider.getAttribute('max'))
  await slider.fill(String(Math.round(max * 0.4)))
}

const openAccount = async (page: Page) => {
  await page.goto('/python')
  await fontsLoaded(page)
  // By class: on phones the name is hidden and the button's name falls back to its title.
  await page.locator('.account-button').click()
}

const AIDS_110 = { autoIndent: true, autoClose: true, autocomplete: false }
const AIDS_111 = { autoIndent: true, autoClose: true, autocomplete: true }

export const STATES: State[] = [
  // ——— Typing ———
  { id: 'typing-ready', area: 'Typing', title: 'Ready to type (Python, medium)', open: (p) => typeSnippet(p, 'medium', 'word_count.py') },
  {
    id: 'typing-mid-run',
    area: 'Typing',
    title: 'Mid-run, with a mistake and suggestions',
    aids: AIDS_111,
    open: async (p) => {
      const { log } = recorded('h-002')
      await typeSnippet(p, 'short', 'clamp.py')
      await pause(p)
      // A wrong key in "clamp", then on until the suggestion list opens on line 2.
      const wrongAt = log.findIndex((e) => e[0] === 'k' && e[1] === 'l')
      await replayKeys(p, log, { wrongAt, until: async () => (await p.locator('.suggest').count()) > 0 && /Ln 2,/.test(await p.locator('.statusbar').first().innerText()) })
    },
  },
  {
    id: 'typing-results',
    area: 'Typing',
    title: 'Results',
    aids: AIDS_110,
    open: async (p) => {
      await typeSnippet(p, 'short', 'clamp.py')
      await pause(p)
      await replayKeys(p, recorded('h-001').log)
      await p.locator('.results').waitFor()
      await p.clock.resume()
    },
  },
  {
    id: 'typing-review',
    area: 'Typing',
    title: 'Code review after a run',
    aids: AIDS_110,
    open: async (p) => {
      await typeSnippet(p, 'short', 'clamp.py')
      await pause(p)
      await replayKeys(p, recorded('h-001').log)
      await p.clock.resume()
      await p.getByRole('button', { name: 'Review your code' }).click()
    },
  },

  // ——— Overlays ———
  {
    id: 'picker-language',
    area: 'Overlays',
    title: 'Language picker',
    open: async (p) => {
      await p.goto('/python')
      await fontsLoaded(p)
      // From the keyboard: a click would leave the pointer over the list, and hovering a row moves the highlight (and previews a theme).
      await p.locator('.lang-button').first().focus()
      await p.keyboard.press('Enter')
      await p.getByRole('dialog').waitFor()
    },
  },
  {
    id: 'picker-theme',
    area: 'Overlays',
    title: 'Theme picker',
    open: async (p) => {
      await p.goto('/python')
      await fontsLoaded(p)
      // From the keyboard: a click would leave the pointer over the list, and hovering a row moves the highlight (and previews a theme).
      await p.locator('.theme-button').focus()
      await p.keyboard.press('Enter')
      await p.getByRole('dialog').waitFor()
    },
  },
  {
    id: 'about',
    area: 'Overlays',
    title: 'About',
    open: async (p) => {
      await p.goto('/python')
      await fontsLoaded(p)
      await p.getByRole('button', { name: 'About Syntype' }).click()
      await p.getByRole('dialog').waitFor()
    },
  },
  {
    id: 'sign-in',
    area: 'Overlays',
    title: 'Sign in',
    open: async (p) => {
      await p.goto('/python')
      await fontsLoaded(p)
      await p.getByRole('button', { name: 'Sign in' }).click()
      await p.getByRole('dialog').waitFor()
    },
  },
  { id: 'account-menu', area: 'Overlays', title: 'Account menu', signedIn: true, open: openAccount },
  {
    id: 'name-step',
    area: 'Overlays',
    title: 'Name step',
    signedIn: true,
    open: async (p) => {
      await openAccount(p)
      await p.getByRole('button', { name: 'Change name' }).click()
      await p.getByRole('dialog').waitFor()
    },
  },
  {
    id: 'account-settings',
    area: 'Overlays',
    title: 'Account & data',
    signedIn: true,
    open: async (p) => {
      await openAccount(p)
      await p.getByRole('button', { name: 'Account & data' }).click()
      await p.getByText('Your entries').waitFor()
      await p.locator('.entries').waitFor()
    },
  },
  {
    id: 'delete-account',
    area: 'Overlays',
    title: 'Delete account confirmation',
    signedIn: true,
    open: async (p) => {
      await openAccount(p)
      await p.getByRole('button', { name: 'Account & data' }).click()
      await p.getByRole('button', { name: 'Delete my account…' }).click()
      await p.locator('.delete-form').scrollIntoViewIfNeeded()
    },
  },
  {
    id: 'toast',
    area: 'Overlays',
    title: 'A toast',
    open: async (p) => {
      await p.goto('/python?signin=expired')
      await p.locator('.toast').waitFor()
    },
  },

  // ——— My runs ———
  { id: 'runs-overview', area: 'My runs', title: 'My runs', history: true, open: (p) => p.goto('/runs?lang=python&length=short').then(() => p.locator('table').first().waitFor()) },
  {
    id: 'runs-snippet',
    area: 'My runs',
    title: 'One snippet’s runs',
    history: true,
    open: (p) => p.goto('/runs?lang=python&length=short&snippet=clamp.py').then(() => p.getByRole('heading', { name: /clamp\.py/ }).first().waitFor()),
  },
  {
    id: 'runs-replay',
    area: 'My runs',
    title: 'Replay',
    history: true,
    open: (p) => p.goto('/runs?lang=python&length=short&snippet=clamp.py&replay=h-006').then(() => holdReplay(p)),
  },

  // ——— Leaderboards ———
  {
    id: 'board-overview',
    area: 'Leaderboards',
    title: 'Python’s boards',
    signedIn: true,
    open: (p) => p.goto('/leaderboard?lang=python&length=short').then(() => p.getByText('Held by').first().waitFor()),
  },
  {
    id: 'board-snippet',
    area: 'Leaderboards',
    title: 'A board, with your place below the top 15',
    signedIn: true,
    open: (p) => p.goto('/leaderboard?lang=python&length=short&snippet=clamp.py').then(() => p.locator('tr.mine').waitFor()),
  },
  {
    id: 'board-report',
    area: 'Leaderboards',
    title: 'Report dialog',
    signedIn: true,
    open: async (p) => {
      await p.goto('/leaderboard?lang=python&length=short&snippet=clamp.py')
      await p.getByRole('button', { name: /Report LinusFast/ }).click()
      await p.getByRole('dialog').waitFor()
    },
  },
  {
    id: 'board-replay',
    area: 'Leaderboards',
    title: 'A board replay',
    signedIn: true,
    open: (p) => p.goto('/leaderboard?lang=python&length=short&snippet=clamp.py&replay=run-p01-clamppy').then(() => holdReplay(p)),
  },

  // ——— Pages ———
  { id: 'privacy', area: 'Pages', title: 'Privacy', open: (p) => p.goto('/privacy').then(() => undefined) },
  { id: 'fair-play', area: 'Pages', title: 'Fair play', open: (p) => p.goto('/fair-play').then(() => undefined) },

  // ——— Admin (the local-only admin email stands in for Cloudflare Access) ———
  { id: 'admin-reports', area: 'Admin', title: 'Reports', open: (p) => p.goto('/admin#reports').then(() => p.locator('.admin-card').first().waitFor()) },
  {
    id: 'admin-players',
    area: 'Admin',
    title: 'Players, with a player’s runs',
    open: async (p) => {
      await p.goto('/admin#players')
      await p.getByPlaceholder(/Name, player ID/).fill('LinusFast')
      await p.locator('.admin-card').first().waitFor()
      await p.waitForLoadState('networkidle')
    },
  },
  { id: 'admin-activity', area: 'Admin', title: 'Activity', open: (p) => p.goto('/admin#activity').then(() => p.getByText('Renamed').first().waitFor()) },

  // ——— Design system gallery (/admin/gallery; made-up content) ———
  { id: 'gallery', area: 'Gallery', title: 'Every component', open: (p) => p.goto('/admin/gallery').then(() => p.getByRole('heading', { name: 'Composites', level: 2 }).waitFor()) },
  {
    id: 'gallery-focus',
    area: 'Gallery',
    title: 'Keyboard focus and hover on buttons',
    open: async (p) => {
      await p.goto('/admin/gallery')
      await p.getByRole('button', { name: 'Type this snippet' }).focus()
      await p.keyboard.press('Shift+Tab')
      await p.keyboard.press('Tab')
      await p.getByRole('button', { name: 'Outline' }).hover()
    },
  },
  {
    id: 'gallery-dialog',
    area: 'Gallery',
    title: 'A dialog open',
    open: async (p) => {
      await p.goto('/admin/gallery')
      await p.getByRole('button', { name: 'Change name' }).click()
      await p.getByRole('dialog').waitFor()
    },
  },
  {
    id: 'gallery-menu',
    area: 'Gallery',
    title: 'A dropdown menu open',
    open: async (p) => {
      await p.goto('/admin/gallery')
      await p.getByRole('button', { name: 'Options' }).click()
      // (The Command example is a menu too.)
      await p.locator('[data-slot="dropdown-menu-content"] [role="menu"]').waitFor()
      await p.keyboard.press('ArrowDown')
    },
  },
]
