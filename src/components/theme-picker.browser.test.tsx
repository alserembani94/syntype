/**
 * The theme picker marks the themes rule T6 holds to WCAG AA (the `wcag`
 * flag in THEMES) with a "WCAG AA" badge, says so to screen readers, and
 * lists them for a search such as "accessible" (contrast round, AC 6).
 */
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { mount } from '@/test/mount'
import { THEMES } from '../themes'
import { ThemePicker } from './ThemePicker'

const noop = () => {}
const picker = () => <ThemePicker currentId="light" onPreview={noop} onSelect={noop} onClose={noop} smoothCaret={false} onSmoothCaret={noop} />
const AA = THEMES.filter((t) => t.wcag === 'AA').map((t) => t.name)
const others = THEMES.filter((t) => !t.wcag).map((t) => t.name)

/** Each option's accessible text, by the theme it shows. */
function rows() {
  const options = [...document.querySelectorAll('[role="menuitemradio"]')]
  return new Map(THEMES.map((t) => [t.name, options.find((o) => o.textContent?.startsWith(t.name))]).filter(([, o]) => o) as [string, Element][])
}

test('AA themes show the badge and say so; the others do neither', async () => {
  await mount(picker())
  await expect.element(page.getByRole('dialog')).toBeVisible()
  const found = rows()
  expect(AA.length).toBe(8)
  for (const name of AA) {
    const row = found.get(name)!
    expect(row.textContent, name).toContain('WCAG AA')
    expect(row.textContent, name).toContain('meets WCAG AA contrast')
  }
  for (const name of others) expect(found.get(name)!.textContent, name).not.toContain('WCAG AA')
})

test('searching "accessible" lists exactly the AA themes', async () => {
  await mount(picker())
  await userEvent.keyboard('accessible')
  await expect.poll(() => [...rows().keys()].sort()).toEqual([...AA].sort())
})
