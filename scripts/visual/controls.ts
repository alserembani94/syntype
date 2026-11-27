/**
 * npm run check:controls [-- --no-build]
 *
 * The typing screen's controls, driven by a real keyboard and pointer on the
 * built site: every control acts on the current state, the settings row's
 * toolbar keys don't move the caret, letters typed anywhere go to the editor,
 * and the results keys (Enter, R, V) work, except where a focused button
 * takes Enter itself. Then the overlays (design system step 11): each opens
 * from its button or shortcut, keeps focus inside, hides the page behind,
 * closes on Esc and hands focus back. Prints one line per check and fails if
 * any fails.
 */
import { chromium, type Page } from 'playwright'
import { join } from 'node:path'
import { BASE } from './config'
import { build, startServer } from './server'
import { SESSION_COOKIE, testSession } from './session'
import { HISTORY_PATH } from './states'

const root = process.cwd()
if (!process.argv.includes('--no-build')) build(root)
const server = await startServer(root, join(root, 'scripts/visual/fixtures/seed.sql'))
const results: [string, boolean, string][] = []
/** True once `test` passes, polling for up to a second (React Aria hands focus back after a frame or two). */
async function eventually(test: () => Promise<boolean>) {
  for (let i = 0; i < 20; i++) {
    if (await test()) return true
    await new Promise((r) => setTimeout(r, 50))
  }
  return false
}
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

  // ——— Overlays ———
  const active = () => p.evaluate(() => {
    const el = document.activeElement
    return { typing: !!el?.closest('[data-typing-input]'), inDialog: !!el?.closest('[role="dialog"]'), label: el?.getAttribute('aria-label') ?? el?.textContent?.trim() ?? '' }
  })
  /** Is the typing screen hidden from assistive tech (React Aria marks everything outside the overlay)? */
  const pageHidden = () => p.evaluate(() => !!document.querySelector('.editor')?.closest('[aria-hidden="true"], [inert]'))

  // Language picker, by its shortcut: search by alias, Enter chooses, focus back in the editor.
  await p.locator('.editor').click()
  const typedBefore = await typed(p)
  await p.keyboard.press('Control+Shift+L')
  const langDialog = p.getByRole('dialog', { name: 'Choose a language' })
  await langDialog.waitFor()
  check('language picker: Ctrl+Shift+L opens it, focus in the search box', (await p.getByRole('searchbox').evaluate((el) => el === document.activeElement)))
  check('language picker: the page behind is hidden from screen readers', await pageHidden())
  await p.keyboard.type('golang')
  check('language picker: letters go to the search, not the editor', (await typed(p)) === typedBefore)
  check('language picker: an alias finds the language', (await langDialog.getByRole('menuitemradio').count()) === 1 && (await langDialog.getByRole('menuitemradio').innerText()).startsWith('Go'))
  // Typing highlights the first match, so Enter alone chooses it.
  await p.keyboard.press('Enter')
  await langDialog.waitFor({ state: 'detached' })
  check('language picker: Enter chooses it', (await p.locator('#language-button').innerText()).includes('Go'))
  check('language picker: focus goes back to the editor', await eventually(async () => (await active()).typing))
  check('language picker: the page is visible again', !(await pageHidden()))
  await p.locator('#language-button').click()
  await langDialog.waitFor()
  await p.keyboard.press('Escape')
  await langDialog.waitFor({ state: 'detached' })
  check('language picker: Esc closes it without a change', (await p.locator('#language-button').innerText()).includes('Go'))
  // A fast typist: the name and Enter in one go, before React Aria has settled its highlight.
  await p.keyboard.press('Control+Shift+L')
  await langDialog.waitFor()
  await p.keyboard.type('python')
  await p.keyboard.press('Enter')
  await langDialog.waitFor({ state: 'detached' })
  check('language picker: typing a name and Enter at once chooses it', (await p.locator('#language-button').innerText()).includes('Python'))

  // Theme picker: live preview, put back on Esc; the caret switch's text switches it.
  const theme = () => p.evaluate(() => document.documentElement.dataset.syntypeTheme ?? 'system')
  const themeBefore = await theme()
  await p.locator('.theme-button').focus()
  await p.keyboard.press('Enter')
  const themeDialog = p.getByRole('dialog', { name: 'Choose a theme' })
  await themeDialog.waitFor()
  await p.keyboard.press('ArrowDown')
  await p.keyboard.press('ArrowDown')
  await p.waitForTimeout(600)
  const previewed = await theme()
  check('theme picker: the highlighted theme previews', previewed !== themeBefore, `${themeBefore} → ${previewed}`)
  check('theme picker: the highlighted row has its bar', await themeDialog.locator('[data-focused]').evaluate((row) => getComputedStyle(row, '::before').opacity === '1'))
  const caretSwitch = themeDialog.getByRole('switch', { name: 'Smooth caret' })
  const caretBefore = await caretSwitch.isChecked()
  await themeDialog.getByText('Smooth caret', { exact: true }).click()
  check('theme picker: clicking “Smooth caret” switches it', (await caretSwitch.isChecked()) !== caretBefore)
  await p.keyboard.press('Escape')
  await themeDialog.waitFor({ state: 'detached' })
  check('theme picker: Esc puts the theme back', (await theme()) === themeBefore, await theme())

  // About: the page's own section, in a dialog titled by its heading; Tab stays inside; put back on close.
  const aboutParent = await p.evaluate(() => document.getElementById('about')?.parentElement?.tagName)
  await p.getByRole('button', { name: 'About Syntype' }).click()
  const about = p.getByRole('dialog')
  await about.waitFor()
  check('about: titled by the section’s heading', ((await about.getAttribute('aria-labelledby')) ?? '') !== '' && (await p.evaluate(() => !!document.querySelector('[role="dialog"] #about'))))
  let inside = true
  for (let i = 0; i < 40; i++) {
    await p.keyboard.press('Tab')
    inside &&= (await active()).inDialog
  }
  check('about: Tab stays inside', inside)
  check('about: the page behind is hidden', await pageHidden())
  await p.keyboard.press('Escape')
  await about.waitFor({ state: 'detached' })
  check('about: Esc closes it and the section goes back in place', (await p.evaluate(() => document.getElementById('about')?.parentElement?.tagName)) === aboutParent)

  // Signed in: the account menu and its dialogs.
  const signed = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await signed.addCookies([{ name: SESSION_COOKIE, value: await testSession(), url: BASE }])
  const q = await signed.newPage()
  await q.goto(`${BASE}/python`)
  const accountButton = q.getByRole('button', { name: /,\s*account$/ })
  await accountButton.click()
  await q.getByRole('menu').waitFor()
  check('account: the button opens a menu', (await q.getByRole('menuitem').count()) === 4)
  await q.keyboard.press('Escape')
  await q.getByRole('menu').waitFor({ state: 'detached' })
  // From the keyboard, focus starts on the first item (opened by pointer, it's on the menu itself).
  await accountButton.focus()
  await q.keyboard.press('Enter')
  await q.getByRole('menu').waitFor()
  check('account: opened by keyboard, focus starts on the first item', await q.getByRole('menuitem', { name: 'Change name' }).evaluate((el) => el === document.activeElement))
  await q.keyboard.press('Escape')
  await q.getByRole('menu').waitFor({ state: 'detached' })
  check('account: Esc closes the menu and focus returns to the button', await eventually(() => accountButton.evaluate((el) => el === document.activeElement)))
  await q.keyboard.press('Enter')
  await q.getByRole('menu').waitFor()
  await q.keyboard.press('Enter')
  const nameDialog = q.getByRole('dialog', { name: 'Change your name' })
  await nameDialog.waitFor()
  check('account: Enter on Change name opens the name dialog, focus in its field', await q.getByRole('textbox', { name: 'Name' }).evaluate((el) => el === document.activeElement))
  await q.keyboard.press('Escape')
  await nameDialog.waitFor({ state: 'detached' })
  await accountButton.click()
  await q.getByRole('menuitem', { name: 'Account & data' }).click()
  const settings = q.getByRole('dialog', { name: 'Account & data' })
  await settings.waitFor()
  await settings.getByRole('button', { name: 'Close', exact: true }).last().click()
  await settings.waitFor({ state: 'detached' })
  check('account: Account & data opens and its Close button closes it', true)
  await accountButton.click()
  await q.getByRole('menuitem', { name: 'My runs' }).click()
  await q.getByRole('heading', { name: 'My runs' }).waitFor()
  check('account: My runs goes to My runs', true)

  // Report: from a board row's flag; Esc closes and focus returns to the flag.
  await q.goto(`${BASE}/leaderboard?lang=python&length=short&snippet=clamp.py`)
  const flag = q.getByRole('button', { name: /^Report LinusFast/ })
  await flag.click()
  const report = q.getByRole('dialog', { name: /Report LinusFast/ })
  await report.waitFor()
  check('report: the flag opens the report dialog, Send disabled until a reason is chosen', await report.getByRole('button', { name: 'Send report' }).isDisabled())
  await q.keyboard.press('Escape')
  await report.waitFor({ state: 'detached' })
  check('report: Esc closes it and focus returns to the flag', await eventually(() => flag.evaluate((el) => el === document.activeElement)))

  // A sign-in problem shows as an error toast that stays until dismissed.
  await q.goto(`${BASE}/python?signin=expired`)
  const alert = q.locator('[data-slot="toast"][data-tone="error"]')
  await alert.waitFor()
  check('toast: a sign-in problem shows as an error toast', (await q.getByRole('alert').innerText()).length > 0)
  await alert.getByRole('button', { name: 'Dismiss' }).click()
  await alert.waitFor({ state: 'detached' })
  check('toast: Dismiss hides it', true)

  // ——— My runs and the leaderboards (design system step 12) ———
  const r = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  await r.goto(`${BASE}/runs`)
  await r.locator('input[type="file"]').setInputFiles(HISTORY_PATH)
  await r.getByText(/^Imported/).waitFor()
  check('runs: importing a history file confirms in a toast', true)
  await r.goto(`${BASE}/runs?lang=python&length=short`)
  const openClamp = r.getByRole('button', { name: 'Open clamp.py' })
  await openClamp.waitFor()
  check('runs: the table is a real table', (await r.getByRole('table').count()) === 1 && (await r.getByRole('columnheader', { name: 'Best' }).count()) === 1)
  await openClamp.focus()
  await r.keyboard.press('Enter')
  await r.getByRole('heading', { name: 'clamp.py' }).waitFor()
  check('runs: a row’s own link opens it from the keyboard', true)
  await r.getByRole('link', { name: 'My runs' }).click()
  await openClamp.waitFor()
  check('runs: the breadcrumb goes back', true)
  await r.getByRole('cell', { name: 'squares.py', exact: true }).click()
  await r.getByRole('heading', { name: 'squares.py' }).waitFor()
  check('runs: a click anywhere on a row opens it', true)
  await r.goBack()
  await openClamp.waitFor()
  // Length, by keyboard: one Tab stop, arrows inside.
  await r.getByRole('radio', { name: 'short', exact: true }).focus()
  await r.keyboard.press('ArrowRight')
  await r.keyboard.press('Space')
  check('runs: → Space in Length chooses medium', (await r.getByRole('radio', { name: 'medium', exact: true }).getAttribute('aria-checked')) === 'true')
  check('runs: … and the table shows medium snippets', (await r.getByRole('button', { name: 'Open clamp.py' }).count()) === 0)
  await r.getByRole('radio', { name: 'short', exact: true }).click()
  await r.getByRole('radio', { name: 'custom', exact: true }).click()
  check('runs: “custom” shows the aid toggles', (await r.getByRole('toolbar', { name: 'Exactly these aids' }).count()) === 1 || (await r.getByRole('button', { name: 'auto-indent', exact: true }).count()) === 1)
  await r.getByRole('radio', { name: 'any', exact: true }).click()
  // The language picker shows your run counts here.
  await r.getByRole('button', { name: 'Python' }).click()
  const runsPicker = r.getByRole('dialog', { name: 'Choose a language' })
  await runsPicker.waitFor()
  const pythonRow = (await runsPicker.getByRole('menuitemradio', { name: /Python/ }).first().innerText()).replace(/\s+/g, ' ')
  check('runs: the language picker shows your run count', /\d+ runs?/.test(pythonRow) && !/snippets/.test(pythonRow), pythonRow)
  await r.keyboard.press('Escape')
  await runsPicker.waitFor({ state: 'detached' })
  // Clearing asks first; Esc keeps the runs.
  await r.getByRole('button', { name: 'Clear…' }).click()
  const confirm = r.getByRole('alertdialog')
  await confirm.waitFor()
  check('runs: Clear asks in a dialog, focus on Cancel', await confirm.getByRole('button', { name: 'Cancel' }).evaluate((el) => el === document.activeElement))
  await r.keyboard.press('Escape')
  await confirm.waitFor({ state: 'detached' })
  check('runs: … Esc keeps the runs', (await openClamp.count()) === 1)
  // The replay: slider and speed by keyboard; Esc closes it.
  await r.goto(`${BASE}/runs?lang=python&length=short&snippet=clamp.py`)
  await r.getByRole('button', { name: /^Replay the run/ }).first().click()
  const scrub = r.getByRole('slider', { name: 'Position in the replay' })
  await scrub.waitFor()
  await r.getByRole('button', { name: 'Pause' }).click()
  await scrub.focus()
  await r.keyboard.press('Home')
  const atStart = await scrub.inputValue()
  await r.keyboard.press('PageUp')
  check('replay: Page Up moves the position', (await scrub.inputValue()) !== atStart, `${atStart} → ${await scrub.inputValue()}`)
  check('replay: the code area is a Tab stop', await r.getByRole('region', { name: 'Code' }).evaluate((el) => el.tabIndex === 0))
  await r.getByRole('radio', { name: '2×' }).click()
  check('replay: speed is a choice', (await r.getByRole('radio', { name: '2×' }).getAttribute('aria-checked')) === 'true')
  await r.keyboard.press('Escape')
  await r.getByRole('heading', { name: 'clamp.py' }).waitFor()
  check('replay: Esc closes it', true)

  // The leaderboards: a board from its row's link, back by the breadcrumb; loading shows placeholders.
  await r.goto(`${BASE}/leaderboard?lang=python&length=short`)
  await r.getByRole('button', { name: 'clamp.py board' }).click()
  await r.getByRole('columnheader', { name: 'Player' }).waitFor()
  check('boards: a row’s link opens its board', (await r.getByRole('row').count()) > 3)
  await r.getByRole('link', { name: 'Python' }).click()
  await r.getByRole('button', { name: 'clamp.py board' }).waitFor()
  check('boards: the breadcrumb goes back to the language', true)
} finally {
  await browser.close()
  await server.stop()
}
for (const [name, ok, detail] of results) console.log(`${ok ? '✓' : '✗'} ${name}${detail && !ok ? ` (${detail})` : ''}`)
const failed = results.filter(([, ok]) => !ok).length
console.log(`${results.length - failed} of ${results.length} passed`)
if (failed) process.exitCode = 1
