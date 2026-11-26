/**
 * Which colour classes in a component would draw nothing. Since design system
 * step 5, Tailwind's only colours are the theme roles, so a class like
 * bg-black/10 or text-red-600 produces no CSS at all and its colour silently
 * vanishes. Tailwind itself is asked (with the app's own stylesheet), so the
 * answer is exact.
 *
 * Used by `npm run ui:add` (scripts/ui-add.ts) and src/components/ui/ui.test.ts.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compile } from '@tailwindcss/node'

/**
 * Colours shadcn's Nova style uses that aren't roles, each with the role that
 * replaces it. Reviewed in design system step 6; add an entry only with a reason.
 */
export const REWRITES: { from: RegExp; to: string; why: string }[] = [
  { from: /\bbg-black\/(\d+)\b/g, to: 'bg-overlay/$1', why: 'dialog and sheet backdrops: the theme overlay colour at the same opacity' },
  { from: /\bbg-white\b/g, to: 'bg-background', why: "the slider thumb: the theme's page colour instead of white, so it reads in dark themes too" },
]

/** Utilities whose value is a colour (the part before the colour name). */
const COLOUR_UTILITY =
  /^-?(bg|text|border|border-[xytrblse]|ring|ring-offset|inset-ring|outline|fill|stroke|from|via|to|decoration|divide|placeholder|caret|accent|shadow|inset-shadow|drop-shadow|text-shadow)-(.+)$/

/** Values after those prefixes that are not colours (sizes, styles, keywords). */
const NOT_A_COLOUR =
  /^(\d.*|\[.*\]|\(.*\)|px|none|solid|dashed|dotted|double|hidden|inherit|current|transparent|xs|sm|md|lg|xl|\dxl|base|left|right|center|justify|start|end|clip|clip-.*|ellipsis|wrap|nowrap|balance|pretty|auto|offset-.*|inset|x|y|t|r|b|l|s|e|collapse|separate|fixed|local|scroll|repeat.*|no-repeat|cover|contain|top|bottom|origin-.*|blend-.*|linear.*|radial.*|conic.*|gradient.*|underline|overline|line-through|wavy|from-font|thickness.*|opacity-.*|tight|snug|normal|relaxed|loose|display|mono|sans|serif)$/

/** Class-like tokens in a source file: everything between quotes or backticks, split on spaces. */
export function classTokens(source: string) {
  const tokens = new Set<string>()
  for (const m of source.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g))
    for (const t of m[2].split(/\s+/)) if (t && /^[!-]?[a-z@[(][\w\-:/.[\]()%,!&*>=@"'#+]*$/i.test(t)) tokens.add(t)
  return [...tokens]
}

/** The utility itself, without variants (data-open:, dark:, hover:) or the ! marker. */
const base = (token: string) => {
  let depth = 0
  let cut = 0
  for (let i = 0; i < token.length; i++) {
    const c = token[i]
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    else if (c === ':' && depth === 0) cut = i + 1
  }
  return token.slice(cut).replace(/^!|!$/g, '')
}

let build: ((candidates: string[]) => string) | undefined
async function tailwind() {
  if (!build) {
    const dir = fileURLToPath(new URL('../../src/styles/', import.meta.url))
    const compiler = await compile(readFileSync(dir + 'system.css', 'utf8'), { base: dir, onDependency: () => {} })
    build = compiler.build
  }
  return build
}

/** The colour classes in `source` that Tailwind writes no CSS for. */
export async function missingColours(source: string) {
  const build = await tailwind()
  const colourish = classTokens(source).filter((t) => {
    const m = base(t).match(COLOUR_UTILITY)
    return m && !NOT_A_COLOUR.test(m[2])
  })
  const css = build(colourish)
  // Tailwind escapes a class's special characters in its selector.
  const selector = (t: string) => '.' + t.replace(/[^\w-]/g, (c) => `\\${c}`)
  return colourish.filter((t) => !css.includes(selector(t)))
}

/** Applies REWRITES, returning the new source and what changed. */
export function rewrite(source: string) {
  const changes: string[] = []
  let out = source
  for (const r of REWRITES)
    out = out.replace(r.from, (...m) => {
      const to = r.to.replace(/\$(\d)/g, (_, i) => m[Number(i)])
      changes.push(`${m[0]} → ${to}`)
      return to
    })
  return { source: out, changes }
}
