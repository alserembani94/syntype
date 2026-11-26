import { useEffect } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { mount } from '@/test/mount'
import { Toaster } from './toast'
import { HIDE_AFTER_MS, useToast, type ToastTone } from './use-toast'

function Show({ message, tone }: { message: string; tone?: ToastTone }) {
  const toast = useToast()
  useEffect(() => toast.show(message, { tone }), [toast, message, tone])
  return <button type="button">Elsewhere</button>
}
const open = (message: string, tone?: ToastTone) =>
  mount(
    <Toaster>
      <Show message={message} tone={tone} />
    </Toaster>,
  )

afterEach(() => vi.useRealTimers())

describe('Toast', () => {
  test('the live regions are in the page before any message', async () => {
    await mount(<Toaster>nothing yet</Toaster>)
    expect(document.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull()
    expect(document.querySelector('[role="alert"]')).not.toBeNull()
  })

  test('a confirmation is announced politely and hides after 6 s', async () => {
    vi.useFakeTimers()
    await open('Report sent.')
    await expect.element(page.getByRole('status')).toHaveTextContent('Report sent.')
    await vi.advanceTimersByTimeAsync(HIDE_AFTER_MS + 100)
    await expect.element(page.getByText('Report sent.')).not.toBeInTheDocument()
  })

  test('a confirmation stays while it has focus', async () => {
    vi.useFakeTimers()
    await open('Signed out on every device.')
    await page.getByRole('button', { name: 'Dismiss' }).element().focus()
    await vi.advanceTimersByTimeAsync(HIDE_AFTER_MS * 2)
    await expect.element(page.getByText('Signed out on every device.')).toBeVisible()
  })

  test('an error is an alert and stays until dismissed by keyboard', async () => {
    vi.useFakeTimers()
    await open('That sign-in took too long.', 'error')
    await expect.element(page.getByRole('alert')).toHaveTextContent('That sign-in took too long.')
    await vi.advanceTimersByTimeAsync(HIDE_AFTER_MS * 3)
    await expect.element(page.getByText('That sign-in took too long.')).toBeVisible()
    vi.useRealTimers()
    page.getByRole('button', { name: 'Dismiss' }).element().focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(page.getByText('That sign-in took too long.')).not.toBeInTheDocument()
  })

  test('the dismiss button is at least 24 px (WCAG 2.5.8)', async () => {
    await open('Saved.')
    const box = page.getByRole('button', { name: 'Dismiss' }).element().getBoundingClientRect()
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24)
  })
})
