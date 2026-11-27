import { describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { mount } from '@/test/mount'
import { AccountMenu, type AccountAction } from './account-menu'

const open = (onAction = vi.fn<(a: AccountAction) => void>()) =>
  mount(<AccountMenu name="Ada Types" provider="GitHub" trigger={<>Ada Types<span className="sr-only">, account</span></>} onAction={onAction} />)
const button = () => page.getByRole('button', { name: /^Ada Types\s*,\s*account$/ })

describe('AccountMenu', () => {
  test.each(['{Enter}', ' ', '{ArrowDown}'])('opens from the button with %s, focus on the first item', async (key) => {
    await open()
    button().element().focus()
    await userEvent.keyboard(key)
    await expect.element(page.getByRole('menu')).toBeVisible()
    await expect.element(page.getByRole('menuitem', { name: 'Change name' })).toHaveFocus()
  })

  test('shows who is signed in, and four actions', async () => {
    await open()
    await button().click()
    await expect.element(page.getByText('signed in with GitHub')).toBeVisible()
    expect(page.getByRole('menuitem').all()).toHaveLength(4)
  })

  test('arrow keys move, Enter acts and closes', async () => {
    const onAction = vi.fn<(a: AccountAction) => void>()
    await open(onAction)
    button().element().focus()
    await userEvent.keyboard('{Enter}{ArrowDown}{ArrowDown}')
    await expect.element(page.getByRole('menuitem', { name: 'Account & data' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onAction).toHaveBeenCalledWith('settings')
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
  })

  test('Esc closes and returns focus to the button', async () => {
    await open()
    button().element().focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(page.getByRole('menu')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
    await expect.element(button()).toHaveFocus()
  })
})
