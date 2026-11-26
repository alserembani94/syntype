/** Every shadcn component and composite appears in the gallery (design system step 9). */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const src = fileURLToPath(new URL('../', import.meta.url))
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]))
const gallery = files(join(src, 'gallery'))
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

it.each([
  ...readdirSync(join(src, 'components/ui')).filter((f) => f.endsWith('.tsx') && !f.includes('.test.')).map((f) => `ui/${f.slice(0, -4)}`),
  ...readdirSync(join(src, 'components/composites')).filter((f) => f.endsWith('.tsx') && !f.includes('.test.')).map((f) => `composites/${f.slice(0, -4)}`),
])('%s is in the gallery', (name) => {
  expect(gallery).toContain(`'@/components/${name}'`)
})
