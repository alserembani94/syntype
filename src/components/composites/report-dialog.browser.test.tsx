import { describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { Button } from '@/components/ui/button'
import { mount } from '@/test/mount'
import { ReportDialog } from './report-dialog'

function open(onSend = vi.fn(async () => null as string | null), onSent = vi.fn()) {
  return mount(<ReportDialog playerName="LinusFast" trigger={<Button aria-label="Report LinusFast">⚑</Button>} onSend={onSend} onSent={onSent} />)
}
const flag = () => page.getByRole('button', { name: 'Report LinusFast' })
const dialog = () => page.getByRole('dialog', { name: 'Report LinusFast' })

describe('ReportDialog', () => {
  test('opens from the flag, named, with focus on the first reason', async () => {
    await open()
    await flag().click()
    await expect.element(dialog()).toBeVisible()
    await expect.element(page.getByRole('radio', { name: 'Cheating' })).toHaveFocus()
  })

  test('every reason is a named radio with its hint', async () => {
    await open()
    await flag().click()
    for (const name of ['Cheating', 'Offensive name', 'Something else']) await expect.element(page.getByRole('radio', { name })).toBeInTheDocument()
    await expect.element(page.getByRole('radio', { name: 'Cheating' })).toHaveAccessibleDescription('The run looks automated or faked.')
  })

  test('Send is disabled until a reason is chosen, then sends reason and note', async () => {
    const onSend = vi.fn(async () => null)
    const onSent = vi.fn()
    await open(onSend, onSent)
    await flag().click()
    await expect.element(page.getByRole('button', { name: 'Send report' })).toBeDisabled()
    await userEvent.keyboard('{ArrowDown}')
    await page.getByRole('textbox', { name: 'Note (optional)' }).fill('Same run three times.')
    await page.getByRole('button', { name: 'Send report' }).click()
    expect(onSend).toHaveBeenCalledWith({ reason: 'name', note: 'Same run three times.' })
    await expect.element(dialog()).not.toBeInTheDocument()
    expect(onSent).toHaveBeenCalled()
  })

  test('a failed send shows an alert and keeps the dialog open', async () => {
    await open(vi.fn(async () => 'You can send 5 reports an hour.'))
    await flag().click()
    await userEvent.keyboard(' ')
    await page.getByRole('button', { name: 'Send report' }).click()
    await expect.element(page.getByRole('alert')).toHaveTextContent('You can send 5 reports an hour.')
    await expect.element(dialog()).toBeVisible()
  })

  test('Tab stays inside, and Esc closes and returns focus to the flag', async () => {
    await open()
    await flag().click()
    for (let i = 0; i < 8; i++) {
      await userEvent.keyboard('{Tab}')
      expect(dialog().element().contains(document.activeElement)).toBe(true)
    }
    await userEvent.keyboard('{Escape}')
    await expect.element(dialog()).not.toBeInTheDocument()
    await expect.element(flag()).toHaveFocus()
  })
})
