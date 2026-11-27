/** Each composite, open, in every theme, passes axe's WCAG 2.2 A/AA rules. */
import { useEffect } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { Button } from '@/components/ui/button'
import { wcagViolations } from '@/test/axe'
import { mount } from '@/test/mount'
import { THEMES, SYSTEM_THEME } from '@/themes'
import { AccountMenu } from './account-menu'
import { Picker } from './picker'
import { ReportDialog } from './report-dialog'
import { Toaster } from './toast'
import { useToast } from './use-toast'

/**
 * The picker's list scrolls but isn't itself focusable: focus stays in the
 * search box and ↑ ↓ move a virtual highlight through the list, scrolling it
 * (the WAI-ARIA combobox pattern), so keyboard users reach every row.
 */
const PICKER_LIST = { rule: 'scrollable-region-focusable', selector: '[data-slot="command-list"]', why: 'virtual focus from the search box' }

/**
 * Contrast failures that remain, in One Dark Pro only (as KNOWN_FAILURES in
 * src/themes/themes.test.ts): "<theme> <composite>: <element>". The test fails
 * on anything new, and on a listed failure that now passes.
 */
const KNOWN: Record<string, string> = {
  'one-dark-pro report dialog': 'the error alert text, coral on the card (4.38:1)',
}
const expectClean = (key: string, violations: string[]) =>
  KNOWN[key]
    ? expect(violations.length, `${key}: known contrast failure now passes; remove it from KNOWN`).toBeGreaterThan(0)
    : expect(violations).toEqual([])

const THEME_IDS = THEMES.map((t) => t.id).filter((id) => id !== SYSTEM_THEME)

function Toasts() {
  const toast = useToast()
  useEffect(() => toast.show('That sign-in took too long.', { tone: 'error' }), [toast])
  return null
}

describe.each(THEME_IDS)('%s', (theme) => {

  test('toast', async () => {
    await mount(
      <Toaster>
        <Toasts />
      </Toaster>,
      theme,
    )
    await vi.waitFor(() => expect(document.querySelector('[role=alert]')?.textContent).toContain('took too long'))
    expect(await wcagViolations()).toEqual([])
  })

  test('report dialog', async () => {
    await mount(<ReportDialog playerName="LinusFast" trigger={<Button aria-label="Report LinusFast">⚑</Button>} onSend={async () => 'Try again later.'} onSent={() => {}} />, theme)
    await page.getByRole('button', { name: 'Report LinusFast' }).click()
    await userEvent.keyboard(' ')
    await page.getByRole('button', { name: 'Send report' }).click()
    await expect.element(page.getByRole('alert')).toBeVisible()
    const found = await wcagViolations()
    // Known failures must be contrast only.
    expect(found.filter((v) => !v.startsWith('color-contrast'))).toEqual([])
    expectClean(`${theme} report dialog`, found)
  })

  test('account menu', async () => {
    await mount(<AccountMenu name="Ada Types" provider="GitHub" trigger={<>Ada Types<span className="sr-only">, account</span></>} onAction={() => {}} />, theme)
    await page.getByRole('button', { name: /^Ada Types\s*,\s*account$/ }).click()
    await expect.element(page.getByRole('menu')).toBeVisible()
    expect(await wcagViolations()).toEqual([])
  })

  test('picker', async () => {
    const items = THEMES.filter((t) => t.id !== SYSTEM_THEME)
    await mount(
      <Picker
        label="Choose a theme"
        placeholder="Search themes"
        items={items}
        sections={[...new Set(items.map((t) => t.section))]}
        sectionOf={(t) => t.section}
        idOf={(t) => t.id}
        textOf={(t) => t.name}
        currentId={theme}
        renderItem={(t) => t.name}
        onSelect={() => {}}
        onClose={() => {}}
        empty="No theme matches."
      />,
      theme,
    )
    await userEvent.keyboard('{ArrowDown}')
    expect(await wcagViolations([PICKER_LIST])).toEqual([])
  })
})
