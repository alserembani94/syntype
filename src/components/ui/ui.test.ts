/**
 * The palette test for shadcn components (design system step 6): every
 * colour class in src/components/ui is a theme role. A colour that isn't
 * draws nothing (Tailwind knows only the roles), so this catches it.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { missingColours, rewrite } from '../../../scripts/design/palette.ts'

const dir = new URL('./', import.meta.url)
const composites = new URL('../composites/', import.meta.url)
/** The shadcn components, and our composites built from them. */
const components = [
  ...readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => new URL(f, dir)),
  ...readdirSync(composites).filter((f) => f.endsWith('.tsx') && !f.includes('.test.')).map((f) => new URL(f, composites)),
]

describe('the palette guard', () => {
  it('finds colours that are not roles, and passes roles', async () => {
    expect(await missingColours('<div className="bg-primary text-muted-foreground data-open:bg-overlay/10 border-border" />')).toEqual([])
    expect(await missingColours('<div className="bg-black/10 hover:text-red-600 bg-white ring-sky-500/40" />')).toEqual([
      'bg-black/10',
      'hover:text-red-600',
      'bg-white',
      'ring-sky-500/40',
    ])
  })
  it('ignores classes that are not colours', async () => {
    expect(await missingColours('<div className="text-sm border-2 ring-3 shadow-md outline-none border-t text-balance bg-clip-padding" />')).toEqual([])
  })
  it('rewrites the reviewed colours', () => {
    expect(rewrite('"data-open:bg-black/10 bg-white"').source).toBe('"data-open:bg-overlay/10 bg-background"')
  })
})

describe.each(components.map((u) => [u.pathname.split('/components/')[1], u]))('%s', (_, file) => {
  it('uses only theme roles for colour', async () => {
    expect(await missingColours(readFileSync(file, 'utf8'))).toEqual([])
  })
})
