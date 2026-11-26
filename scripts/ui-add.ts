/**
 * npm run ui:add <component…> [-- shadcn add options]
 *
 * The only way to add a shadcn component (CLAUDE.md, design system). Runs
 * `shadcn add`, then:
 *   1. restores our stylesheets if the CLI changed them (shadcn would add its
 *      own colour variables), and prints what it tried to add;
 *   2. rewrites the reviewed non-role colours (REWRITES in scripts/design/palette.ts);
 *   3. fails on any other colour class Tailwind writes nothing for;
 *   4. runs the palette test, lint and the type check.
 * Runs with Node's built-in TypeScript support: node scripts/ui-add.ts.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { missingColours, rewrite } from './design/palette.ts'

const args = process.argv.slice(2)
if (!args.length) {
  console.error('Usage: npm run ui:add <component…>')
  process.exit(2)
}

/** Files the CLI must not change: the design system's stylesheets. */
const PROTECTED = ['src/styles', 'src/themes/themes.css', 'src/design/primitives.css']
/** Where the CLI writes components and their helpers. */
const OUTPUT = ['src/components/ui', 'src/hooks', 'src/lib']

const files = (path: string): string[] =>
  !existsSync(path) ? [] : statSync(path).isDirectory() ? readdirSync(path).flatMap((f) => files(join(path, f))) : [path]
const snapshot = (paths: string[]) => new Map(paths.flatMap(files).map((f) => [f, readFileSync(f, 'utf8')]))

const kept = snapshot(PROTECTED)
const before = snapshot(OUTPUT)
const untracked = () => execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n').filter(Boolean)
const newBefore = new Set(untracked())

execFileSync('npx', ['shadcn', 'add', '--yes', ...args], { stdio: 'inherit' })

// 1. Our stylesheets stay ours.
for (const [file, text] of kept) {
  const now = readFileSync(file, 'utf8')
  if (now === text) continue
  const added = now.split('\n').filter((l) => !text.includes(l))
  console.log(`\nshadcn changed ${file}; restored. It tried to add:\n${added.map((l) => `  + ${l}`).join('\n')}`)
  writeFileSync(file, text)
}
for (const file of PROTECTED.flatMap(files)) if (!kept.has(file)) console.log(`\nshadcn added ${file}: review it, or delete it.`)

// Files written anywhere else mean the CLI misread a path (an alias it couldn't resolve, say).
const stray = untracked().filter((f) => !newBefore.has(f) && !OUTPUT.some((d) => f.startsWith(d + '/')))
if (stray.length) {
  console.error(`\nshadcn wrote files outside ${OUTPUT.join(', ')}:\n${stray.map((f) => `  ${f}`).join('\n')}\nCheck components.json's aliases and the paths in tsconfig.json.`)
  process.exit(1)
}

// 2 and 3. New or changed component files: rewrite, then check.
const touched = OUTPUT.flatMap(files).filter((f) => /\.(tsx?|css)$/.test(f) && before.get(f) !== readFileSync(f, 'utf8'))
const problems: string[] = []
for (const file of touched) {
  const { source, changes } = rewrite(readFileSync(file, 'utf8'))
  if (changes.length) {
    writeFileSync(file, source)
    console.log(`\n${file}: rewrote ${changes.join(', ')}`)
  }
  for (const cls of await missingColours(source)) problems.push(`${file}: ${cls}`)
}
if (problems.length) {
  console.error(`\nThese colours aren't theme roles, so Tailwind draws nothing for them. Replace each with a role,\nor add a reviewed entry to REWRITES in scripts/design/palette.ts:\n${problems.map((p) => `  ${p}`).join('\n')}`)
  process.exit(1)
}

// 4. The same checks every commit runs.
execFileSync('npx', ['vitest', 'run', 'src/components/ui'], { stdio: 'inherit' })
execFileSync('npm', ['run', 'lint'], { stdio: 'inherit' })
execFileSync('npx', ['tsc', '-b'], { stdio: 'inherit' })
console.log(`\nAdded: ${touched.join(', ') || 'nothing new'}`)
