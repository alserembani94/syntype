/**
 * Tailwind sees only the design system: the theme roles as its colours, the
 * primitives' scales, and the dark variant that follows each theme's
 * color-scheme (design system step 5).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from '@tailwindcss/node'
import { beforeAll, describe, expect, it } from 'vitest'

const dir = fileURLToPath(new URL('.', import.meta.url))
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')

let build: (candidates: string[]) => string
beforeAll(async () => {
  const compiler = await compile(read('./system.css'), { base: dir, onDependency: () => {} })
  build = compiler.build
})

/**
 * The rule Tailwind writes for one class, or '' if it writes none. build()
 * accumulates, so the output is searched for this class's own selector.
 */
const rules = (cls: string) => {
  const css = build([cls])
  const selector = '.' + cls.replace(/[:/]/g, (c) => `\\${c}`)
  const at = css.indexOf(selector)
  return at < 0 ? '' : css.slice(at, css.indexOf('}\n', at) + 1)
}

describe('Tailwind and the design system', () => {
  it.each([
    ['bg-primary', 'background-color: var(--primary)'],
    ['text-muted-foreground', 'color: var(--muted-foreground)'],
    ['border-border', 'border-color: var(--border)'],
    ['bg-code-keyword', 'background-color: var(--code-keyword)'],
    ['bg-destructive/10', 'color-mix(in oklab, var(--destructive) 10%, transparent)'],
  ])('%s reads the role', (cls, expected) => {
    expect(rules(cls)).toContain(expected)
  })

  it.each(['bg-slate-500', 'text-red-600', 'bg-white', 'bg-syntype-amber-350', 'text-onedark-coral'])(
    "%s doesn't exist: no palette but the roles",
    (cls) => expect(rules(cls)).toBe(''),
  )

  it.each([
    ['text-sm', 'var(--text-sm)'],
    ['text-display', 'var(--text-display)'],
    ['rounded-lg', 'var(--radius-lg)'],
    ['font-mono', 'var(--font-mono)'],
    ['p-4', 'calc(var(--spacing) * 4)'],
  ])('%s reads the scale', (cls, expected) => expect(rules(cls)).toContain(expected))

  it('has only our type sizes', () => {
    for (const gone of ['text-5xl', 'text-6xl', 'text-9xl']) expect(rules(gone), gone).toBe('')
  })

  it('the scales are declared once, in the primitives', () => {
    const css = build([])
    expect(css).toContain('--text-base: 1rem')
    expect(css).toContain('--radius-lg: 0.625rem')
    expect(css).toContain('--font-sans: "IBM Plex Sans"')
  })

  it("dark: matches exactly the themes whose color-scheme is dark, and System's dark mode", () => {
    const themes = read('../themes/themes.css').replace(/\/\*[\s\S]*?\*\//g, '')
    const dark = [...themes.matchAll(/\[data-syntype-theme="([\w-]+)"\]\s*\{([^}]*)\}/g)]
      .filter((m) => /color-scheme:\s*dark/.test(m[2]))
      .map((m) => m[1])
      .sort()
    const variant = read('./tailwind-theme.css')
    const listed = [...new Set([...variant.matchAll(/\[data-syntype-theme="([\w-]+)"\]/g)].map((m) => m[1]))].sort()
    expect(listed).toEqual(dark)
    rules('dark:bg-accent')
    const css = build([]).slice(build([]).indexOf('.dark\\:bg-accent'))
    expect(css).toContain('[data-syntype-theme="one-dark-pro"]')
    expect(css).toContain('prefers-color-scheme: dark')
    expect(css).not.toContain('[data-syntype-theme="light"] *')
  })
})

describe('shadcn components in the site\'s CSS', () => {
  /** Every source file of the site: not admin, tests, or the components themselves. */
  const siteFiles = (path: string): string[] =>
    statSync(path).isDirectory()
      ? readdirSync(path).flatMap((f) => (['admin', 'gallery', 'ui', 'composites', 'test'].includes(f) ? [] : siteFiles(join(path, f))))
      : /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)
        ? [path]
        : []

  it('app.css lists exactly the shadcn components and composites the site uses', () => {
    const src = fileURLToPath(new URL('../', import.meta.url))
    // Static and lazy imports alike: `from '…'` and `import('…')`.
    const IMPORT = /(?:from |import\()['"](?:@\/components\/|(?:\.{1,2}\/)+(?:components\/)?)(ui|composites)\/([\w-]+)['"]/g
    const used = new Set<string>()
    const add = (text: string) => {
      for (const m of text.matchAll(IMPORT)) used.add(`${m[1]}/${m[2]}`)
    }
    for (const file of siteFiles(src)) add(readFileSync(file, 'utf8'))
    // What those import in turn (a composite uses components; dialog uses button).
    for (let size = -1; size !== used.size; ) {
      size = used.size
      for (const name of [...used]) {
        const file = join(src, 'components', name)
        add(readFileSync(existsSync(`${file}.tsx`) ? `${file}.tsx` : `${file}.ts`, 'utf8'))
      }
    }
    const listed = [...read('./app.css').matchAll(/@source "\.\.\/components\/((?:ui|composites)\/[\w-]+)\.tsx?"/g)].map((m) => m[1])
    expect(listed.sort()).toEqual([...used].sort())
  })
})

describe('the policy pages', () => {
  it('the site\'s CSS scans the script that writes them, for their classes', () => {
    expect(read('./app.css')).toContain('@source "../../scripts/build-pages.mjs";')
    expect(readFileSync(fileURLToPath(new URL('../../scripts/build-pages.mjs', import.meta.url)), 'utf8')).toMatch(/class="[^"]*font-display/)
  })
})
