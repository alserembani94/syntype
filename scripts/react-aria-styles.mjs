// The <style> elements React Aria adds to the page at runtime, read from its
// own source so the Content Security Policy can allow exactly these by hash
// (scripts/build-pages.mjs). Both are fixed text: usePress's touch-action
// rule for pressable elements, and usePreventScroll's overscroll rule while an
// overlay locks scrolling. If React Aria changes them, the hashes follow on
// the next build; if it adds or removes one, src/lib/reactAriaStyles.test.ts fails.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const root = path.dirname(createRequire(import.meta.url).resolve('react-aria/package.json'))
const FILES = ['dist/private/interactions/usePress.mjs', 'dist/private/overlays/usePreventScroll.mjs']

export function reactAriaStyles() {
  return FILES.flatMap((file) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    // Constants the template interpolates (const $hash$var$NAME = 'value').
    const constants = Object.fromEntries([...source.matchAll(/const ([\w$]+) = '([^']*)';/g)].map((m) => [m[1], m[2]]))
    return [...source.matchAll(/style\.textContent = `([\s\S]*?)`\.trim\(\)/g)].map((m) =>
      m[1].replace(/\$\{([^}]+)\}/g, (_, name) => {
        if (!(name in constants)) throw new Error(`react-aria-styles: unknown \${${name}} in ${file}`)
        return constants[name]
      }).trim(),
    )
  })
}
