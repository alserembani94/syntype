import { describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { mount } from '@/test/mount'
import { Picker } from './picker'

interface Item {
  id: string
  name: string
  section: string
}
const ITEMS: Item[] = [
  { id: 'light', name: 'Syntype Light', section: 'Syntype' },
  { id: 'dark', name: 'Syntype Dark', section: 'Syntype' },
  { id: 'one-dark-pro', name: 'One Dark Pro', section: 'Dark' },
  { id: 'github-light', name: 'GitHub Light', section: 'Light' },
]

function setup(currentId = 'light') {
  const onActive = vi.fn<(i: Item) => void>()
  const onSelect = vi.fn<(id: string) => void>()
  const onClose = vi.fn()
  return {
    onActive,
    onSelect,
    onClose,
    open: () =>
      mount(
        <Picker
          label="Choose a theme"
          placeholder="Search themes"
          items={ITEMS}
          sections={['Syntype', 'Dark', 'Light']}
          sectionOf={(i) => i.section}
          idOf={(i) => i.id}
          textOf={(i) => i.name}
          currentId={currentId}
          renderItem={(i) => i.name}
          onActive={onActive}
          onSelect={onSelect}
          onClose={onClose}
          empty="No theme matches."
          footer={<button type="button">Smooth caret</button>}
        />,
      ),
  }
}
const lastActive = (fn: { mock: { calls: [Item][] } }) => fn.mock.calls.at(-1)?.[0].id

describe('Picker', () => {
  test('opens as a named dialog with focus in the search box', async () => {
    const { open } = setup()
    await open()
    await expect.element(page.getByRole('dialog', { name: 'Choose a theme' })).toBeVisible()
    await expect.element(page.getByRole('searchbox')).toHaveFocus()
  })

  test('live preview: arrow keys report the highlighted row, skipping headings', async () => {
    const { open, onActive } = setup()
    await open()
    await userEvent.keyboard('{ArrowDown}')
    expect(lastActive(onActive)).toBe('light')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(lastActive(onActive)).toBe('one-dark-pro')
    await userEvent.keyboard('{ArrowUp}')
    expect(lastActive(onActive)).toBe('dark')
  })

  test('live preview: the pointer reports the row under it', async () => {
    const { open, onActive } = setup()
    await open()
    await page.getByRole('menuitemradio', { name: 'GitHub Light' }).hover()
    await vi.waitFor(() => expect(lastActive(onActive)).toBe('github-light'))
  })

  test('typing filters across sections, and Enter chooses', async () => {
    const { open, onSelect, onActive } = setup()
    await open()
    await userEvent.keyboard('dark')
    await expect.element(page.getByRole('menuitemradio', { name: 'Syntype Dark' })).toBeVisible()
    await expect.element(page.getByRole('menuitemradio', { name: 'One Dark Pro' })).toBeVisible()
    await expect.element(page.getByRole('menuitemradio', { name: 'GitHub Light' })).not.toBeInTheDocument()
    // Typing highlights the first match (and previews it).
    expect(lastActive(onActive)).toBe('dark')
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('dark')
  })

  test('shows the empty message when nothing matches', async () => {
    const { open } = setup()
    await open()
    await userEvent.keyboard('zzz')
    await expect.element(page.getByText('No theme matches.')).toBeVisible()
  })

  test('the current item is checked', async () => {
    const { open } = setup('one-dark-pro')
    await open()
    await expect.element(page.getByRole('menuitemradio', { name: 'One Dark Pro' })).toHaveAttribute('aria-checked', 'true')
  })

  test('Tab reaches the footer, and Esc closes', async () => {
    const { open, onClose } = setup()
    await open()
    await userEvent.keyboard('{Tab}')
    await expect.element(page.getByRole('button', { name: 'Smooth caret' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
