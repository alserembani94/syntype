/**
 * React Aria's runtime <style> elements are allowed by hash in the Content
 * Security Policy (scripts/build-pages.mjs). If React Aria adds or drops one,
 * the policy would silently stop matching: this notices.
 */
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
// @ts-expect-error: a build script in plain JavaScript, without types.
import { reactAriaStyles } from '../../scripts/react-aria-styles.mjs'

it('finds exactly the two styles React Aria injects, with no unresolved names', () => {
  const styles: string[] = reactAriaStyles()
  expect(styles).toHaveLength(2)
  for (const s of styles) expect(s).not.toMatch(/\$\{|\$\w+\$/)
  expect(styles[0]).toContain('[data-react-aria-pressable]')
  expect(styles[1]).toContain('overscroll-behavior: contain')
  // The touch-action rule's hash, as Chromium reported it for the blocked style.
  expect(`sha256-${createHash('sha256').update(styles[0]).digest('base64')}`).toBe('sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o=')
})
