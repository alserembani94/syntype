/**
 * The gallery renders, and passes axe's WCAG 2.2 A/AA rules in every theme
 * (design system step 9). Contrast failures known before the contrast round
 * are recorded in the snapshot beside this file: a new one fails the test,
 * and fixing one changes the snapshot (update it with -u, after review).
 */
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { contrastFailures, nonContrastViolations } from '@/test/axe'
import { mount } from '@/test/mount'
import { GALLERY_THEMES } from './contents'
import { Gallery } from './Gallery'

/** Command's list scrolls by its search box's arrow keys (virtual focus), as in the picker. */
const COMMAND_LIST = { rule: 'scrollable-region-focusable', selector: '[data-slot="command-list"]', why: 'virtual focus from the search box' }

describe.each(GALLERY_THEMES.map((t) => [t.id]))('%s', (theme) => {
  test('renders every group and passes axe', async () => {
    await mount(<Gallery />, theme)
    await expect.element(page.getByRole('heading', { name: 'Composites', level: 2 })).toBeVisible()
    expect(await nonContrastViolations([COMMAND_LIST])).toEqual([])
    expect(await contrastFailures()).toMatchSnapshot()
  })
})
