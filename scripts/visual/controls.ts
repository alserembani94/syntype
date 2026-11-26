/**
 * npm run check:controls [-- --no-build]
 *
 * The typing screen's controls, driven by a real keyboard and pointer on the
 * built site: every control acts on the current state, the settings row's
 * toolbar keys don't move the caret, letters typed anywhere go to the editor,
 * and the results keys (Enter, R, V) work, except where a focused button
 * takes Enter itself. Prints one line per check and fails if any fails.
 */
import { chromium, type Page } from 'playwright'
import { join } from 'node:path'
import { BASE } from './config'
import { build, startServer } from './server'

const root = process.cwd()
if (!process.argv.includes('--no-build')) build(root)
const server = await startServer(root, join(root, 'scripts/visual/fixtures/seed.sql'))
const results: [string, boolean, string][] = []
const check = (name: string, ok: boolean, detail = '') => results.push([name, ok, detail])

const snippet = (p: Page) => p.locator('.tab').first().innerText()
/** "Ln 1, Col 1": where the caret is. */
const position = (p: Page) => p.locator('.statusbar span').first().innerText()
const typed = (p: Page) => p.locator('.statusbar span').nth(1).innerText()
const pressed = (p: Page, name: string) => p.getByRole('button', { name, exact: true }).getAttribute('aria-pressed')
const checked = (p: Page, name: string) => p.getByRole('radio', { name, exact: true }).getAttribute('aria-checked')

/** Types the snippet's next characters, from the editor's own text. */
async function typeNext(p: Page, n: number) {
  for (let i = 0; i < n; i++) {
    const t = await p.locator('.code .cur').innerText()
    await p.keyboard.press(t === '↵' ? 'Enter' : t === ' ' ? 'Space' : t)
  }
}

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => localStorage.setItem('syntype:autocomplete', 'false'))
  const p = await ctx.newPage()
  await p.goto(`${BASE}/python`)
  await p.locator('.editor').waitFor()

  // Length: the toolbar group, by pointer (focus then returns to the editor, to keep typing).
  await p.getByRole('radio', { name: 'medium', exact: true }).click()
  check('clicking medium chooses it', (await checked(p, 'medium')) === 'true')
  const mediumSnippet = await snippet(p)

  // By keyboard: Tab from the language button reaches the length group in one step.
  await p.locator('#language-button').focus()
  await p.keyboard.press('Tab')
  check('Tab from language reaches the length group', (await p.evaluate(() => document.activeElement?.getAttribute('role'))) === 'radio')
  await p.keyboard.press('ArrowRight')
  await p.keyboard.press('Space')
  check('→ then Space in the length group chooses long', (await checked(p, 'long')) === 'true')
  check('… and focus stays on it', (await p.evaluate(() => document.activeElement?.textContent?.trim())) === 'long')
  check('… and gives a long snippet', (await snippet(p)) !== mediumSnippet)

  // Aids: Tab reaches the group; Space switches one; arrows move between them without touching the caret.
  await p.locator('#language-button').focus()
  await p.keyboard.press('Tab')
  await p.keyboard.press('Tab')
  check('the next Tab reaches the typing aids', (await p.evaluate(() => document.activeElement?.textContent?.trim())) === 'auto-indent')
  const indentBefore = await pressed(p, 'auto-indent')
  const caret = await position(p)
  await p.keyboard.press('Space')
  check('Space switches auto-indent', (await pressed(p, 'auto-indent')) !== indentBefore)
  await p.keyboard.press('ArrowRight')
  check('→ moves to auto-close', (await p.evaluate(() => document.activeElement?.textContent?.trim())) === 'auto-close')
  check('… and the caret stays put', (await position(p)) === caret)
  await p.keyboard.press('ArrowLeft')
  await p.keyboard.press('Space')

  // A letter typed while a chip is focused goes to the editor.
  await p.keyboard.press('ArrowRight')
  const count = Number((await typed(p)).split(' /')[0])
  const first = await p.locator('.code .cur').innerText()
  await p.keyboard.press(first === '↵' ? 'Enter' : first === ' ' ? 'Space' : first)
  check('a key typed on a chip types into the editor', Number((await typed(p)).split(' /')[0]) === count + 1, await typed(p))

  // New snippet keeps the language and length.
  const before = await snippet(p)
  await p.keyboard.press('Control+Enter')
  check('Ctrl+Enter gives a new snippet', (await snippet(p)) !== before)
  check('… still long', (await checked(p, 'long')) === 'true')
  check('… still Python', (await p.locator('#language-button').innerText()).includes('Python'))
  const afterShortcut = await snippet(p)
  await p.getByRole('button', { name: 'new snippet' }).click()
  check('the new snippet button works too', (await snippet(p)) !== afterShortcut)

  // Results: finish a short snippet, then the keys.
  await p.getByRole('radio', { name: 'short', exact: true }).click()
  await p.locator('.editor').click()
  while (await p.locator('.code .cur').count()) await typeNext(p, 1)
  await p.getByRole('button', { name: 'Next snippet' }).waitFor()
  check('results: Next has focus', await p.getByRole('button', { name: 'Next snippet' }).evaluate((b) => b === document.activeElement))
  await p.keyboard.press('v')
  check('results: V opens the review', (await p.getByRole('button', { name: 'Review your code' }).getAttribute('aria-pressed')) === 'true')
  const done = await snippet(p)
  await p.getByRole('button', { name: 'Retry this snippet' }).focus()
  await p.keyboard.press('Enter')
  check('results: Enter on a focused Retry retries (not next)', (await snippet(p)) === done && (await p.locator('.code .cur').count()) > 0)
  while (await p.locator('.code .cur').count()) await typeNext(p, 1)
  await p.getByRole('button', { name: 'Next snippet' }).waitFor()
  await p.keyboard.press('r')
  check('results: R retries', (await snippet(p)) === done && (await p.locator('.code .cur').count()) > 0)
  while (await p.locator('.code .cur').count()) await typeNext(p, 1)
  await p.getByRole('button', { name: 'Next snippet' }).waitFor()
  await p.keyboard.press('Enter')
  check('results: Enter goes to the next snippet', (await snippet(p)) !== done)
} finally {
  await browser.close()
  await server.stop()
}
for (const [name, ok, detail] of results) console.log(`${ok ? '✓' : '✗'} ${name}${detail && !ok ? ` (${detail})` : ''}`)
const failed = results.filter(([, ok]) => !ok).length
console.log(`${results.length - failed} of ${results.length} passed`)
if (failed) process.exitCode = 1
