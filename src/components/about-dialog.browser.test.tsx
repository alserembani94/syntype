/**
 * The About dialog shows the page's own about section (design system step
 * 11): the same element, moved into a React Aria modal while open and put
 * back where it was on close, so search engines and the dialog read the same text.
 */
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { mount } from '@/test/mount'
import { AboutDialog } from './AboutDialog'

function pageSection() {
  const home = document.createElement('footer')
  const section = document.createElement('section')
  section.id = 'about'
  section.className = 'about'
  section.innerHTML = '<h2>About Syntype</h2><p>A typing test for code.</p><a href="/go">Go</a> <a href="https://example.com/">Elsewhere</a>'
  home.append(section)
  document.body.append(home)
  return { home, section }
}
afterEach(() => document.querySelectorAll('footer').forEach((f) => f.remove()))

test('opens the section as a dialog titled by its heading, focus on Close', async () => {
  const { section } = pageSection()
  await mount(<AboutDialog section={section} onLanguage={() => false} onClose={() => {}} />)
  const dialog = page.getByRole('dialog', { name: 'About Syntype' })
  await expect.element(dialog).toBeVisible()
  expect(dialog.element().contains(section)).toBe(true)
  await expect.element(page.getByRole('button', { name: 'Close' })).toHaveFocus()
})

/** Open until closed, as App holds it. */
function Harness({ section }: { section: HTMLElement }) {
  const [open, setOpen] = useState(true)
  return open ? <AboutDialog section={section} onLanguage={() => false} onClose={() => setOpen(false)} /> : null
}

test('Esc closes it, and the section goes back where it was', async () => {
  const { home, section } = pageSection()
  await mount(<Harness section={section} />)
  await expect.element(page.getByRole('dialog')).toBeVisible()
  await userEvent.keyboard('{Escape}')
  await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
  expect(section.parentElement).toBe(home)
  expect(section.classList.contains('open')).toBe(false)
})

test('a language link switches in the app; other links are left alone', async () => {
  const { section } = pageSection()
  const onLanguage = vi.fn((path: string) => path === '/go')
  await mount(<AboutDialog section={section} onLanguage={onLanguage} onClose={() => {}} />)
  const go = section.querySelector<HTMLAnchorElement>('a[href="/go"]')!
  const click = new MouseEvent('click', { bubbles: true, cancelable: true })
  go.dispatchEvent(click)
  expect(onLanguage).toHaveBeenCalledWith('/go')
  expect(click.defaultPrevented).toBe(true)
  const other = new MouseEvent('click', { bubbles: true, cancelable: true })
  section.querySelector('a[href^="https"]')!.dispatchEvent(other)
  expect(other.defaultPrevented).toBe(false)
})
