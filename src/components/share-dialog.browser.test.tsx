import { afterEach, describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { Toaster } from '@/components/composites/toast'
import { mount } from '@/test/mount'
import { wcagViolations } from '@/test/axe'
import { ShareDialog } from './ShareDialog'
import { THEMES } from '../themes'
import type { ShareScore } from '../lib/shareImage'

const score: ShareScore = {
  wpm: 87,
  accuracy: 98,
  language: 'C#',
  languageId: 'csharp',
  length: 'long',
  snippet: 'OrderService.cs',
  aids: ['auto-indent', 'auto-close', 'autocomplete'],
  isBest: true,
  date: new Date(2026, 10, 27),
}

async function open(theme = 'light', onClose = vi.fn()) {
  await mount(
    <Toaster>
      <ShareDialog score={score} onClose={onClose} />
    </Toaster>,
    theme,
  )
  return onClose
}
const dialog = () => page.getByRole('dialog', { name: 'Share your score' })
const image = () => dialog().getByRole('img', { name: /^Syntype score: 87 words per minute at 98% accuracy, a new personal best/ })

describe('ShareDialog', () => {
  afterEach(() => vi.restoreAllMocks())

  test('shows the score as a 1080 × 1080 image with alt text', async () => {
    await open()
    await expect.element(image()).toBeVisible()
    const img = image().element() as HTMLImageElement
    await vi.waitFor(() => expect(img.naturalWidth).toBe(1080))
    expect(img.naturalHeight).toBe(1080)
    expect(img.src.startsWith('data:image/png;base64,')).toBe(true)
    // The first action has focus once the image is there (Copy image here: headless Chromium can't share files).
    await expect.element(dialog().getByRole('button', { name: 'Copy image' })).toHaveFocus()
  })

  test('the image is drawn in every theme', async () => {
    for (const t of THEMES.filter((t) => t.id !== 'system')) {
      await open(t.id)
      await expect.element(image()).toBeVisible()
    }
  })

  test('Download saves the PNG and says so', async () => {
    await open()
    await expect.element(image()).toBeVisible()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('syntype-csharp-87wpm.png')
      expect(this.href.startsWith('blob:')).toBe(true)
    })
    await dialog().getByRole('button', { name: 'Download' }).click()
    expect(click).toHaveBeenCalledOnce()
    await expect.element(page.getByText('Saved syntype-csharp-87wpm.png.')).toBeVisible()
  })

  test('a drawing failure shows an alert where the image would be, with Back to results focused', async () => {
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done: BlobCallback) => done(null))
    const onClose = await open()
    await expect.element(dialog().getByRole('alert')).toHaveTextContent('Couldn’t make the image: Couldn’t make the image. Your result is still on the results screen.')
    expect(dialog().getByRole('img').query()).toBeNull()
    expect(dialog().getByRole('button', { name: 'Download' }).query()).toBeNull()
    const close = dialog().getByRole('button', { name: 'Back to results' })
    await expect.element(close).toHaveFocus()
    await close.click()
    expect(onClose).toHaveBeenCalled()
    expect(toBlob).toHaveBeenCalled()
  })

  test('Tab stays inside, and Esc closes', async () => {
    const onClose = await open()
    await expect.element(image()).toBeVisible()
    for (let i = 0; i < 6; i++) {
      await userEvent.keyboard('{Tab}')
      expect(dialog().element().contains(document.activeElement)).toBe(true)
    }
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  test('no WCAG failures, in a light and a dark theme', async () => {
    for (const theme of ['light', 'dark']) {
      await open(theme)
      await expect.element(image()).toBeVisible()
      expect(await wcagViolations()).toEqual([])
    }
  })
})
