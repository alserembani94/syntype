/**
 * cn() doesn't know three of Syntype's own theme values (docs/design-system.md,
 * Merging classes). These pin how it misreads them today; when an update to `cn`
 * fixes one, its test fails: delete the test and the note in the doc.
 */
import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn() misreads our own type steps (known; avoid overriding them)', () => {
  it('reads text-display-sm as a colour, so a colour beside it is dropped', () => {
    expect(cn('text-primary', 'text-display-sm')).toBe('text-display-sm')
    expect(cn('text-display-sm', 'text-destructive')).toBe('text-destructive')
  })

  it('reads text-display as a colour, so a real size beside it is kept too', () => {
    expect(cn('text-primary', 'text-display')).toBe('text-display')
    expect(cn('text-display', 'text-sm')).toBe('text-display text-sm')
  })

  it('keeps text-shadow-glow beside text-shadow-none', () => {
    expect(cn('text-shadow-glow', 'text-shadow-none')).toBe('text-shadow-glow text-shadow-none')
  })
})

describe('cn() merges the rest of our classes as expected', () => {
  it('knows text-2xs as a size', () => {
    expect(cn('text-2xs', 'text-sm')).toBe('text-sm')
    expect(cn('text-primary', 'text-2xs')).toBe('text-primary text-2xs')
  })

  it('lets a className replace a default', () => {
    expect(cn('px-2 py-1', 'p-3')).toBe('p-3')
    expect(cn('grid', 'hidden')).toBe('hidden')
  })
})
