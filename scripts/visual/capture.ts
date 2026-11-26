/**
 * npm run check:visual [-- options]
 *
 * Captures every state × theme × viewport into .visual/<label>/ (full-page
 * PNGs) with an index.json. Options:
 *   --label <name>    folder name (default: current)
 *   --compare <ref>   also capture <ref> (a tag or commit) in a git worktree,
 *                     with that commit's own scripts, and report every image
 *                     that differs, in .visual/compare-<ref>/
 *   --no-build        use the existing dist/ (this checkout only)
 *   --states a,b  --themes a,b  --viewports phone,desktop   capture a subset
 */
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { OUT_DIR } from './config'
import { build, startServer } from './server'
import { parseFilter, walk } from './walk'
import { compareDirs } from './compare'

const args = process.argv.slice(2)
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const root = process.cwd()
const label = opt('label') ?? 'current'
const compare = opt('compare')
const filter = parseFilter(args)

/** Captures this checkout into .visual/<name>/. */
async function captureHere(name = label, only = filter, buildFirst = !args.includes('--no-build')): Promise<string> {
  const dir = resolve(root, OUT_DIR, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  if (buildFirst) build(root)
  const server = await startServer(root, join(root, 'scripts/visual/fixtures/seed.sql'))
  const index: { file: string; state: string; area: string; title: string; theme: string; viewport: string }[] = []
  const started = Date.now()
  try {
    await walk(async (page, { state, theme, viewport }) => {
      const file = `${state.id}--${theme}--${viewport}.png`
      await page.screenshot({ path: join(dir, file), fullPage: true, animations: 'disabled', caret: 'hide' })
      index.push({ file, state: state.id, area: state.area, title: state.title, theme, viewport })
    }, only)
  } finally {
    await server.stop()
  }
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 1))
  console.log(`${index.length} screenshots in ${OUT_DIR}/${name}/ (${Math.round((Date.now() - started) / 1000)} s)`)
  return dir
}

/** Captures <ref> with its own scripts, in a worktree kept under .visual/worktrees/. */
function captureRef(ref: string, name = ref, states = opt('states')): string {
  const tree = resolve(root, OUT_DIR, 'worktrees', ref)
  if (!existsSync(tree)) {
    execFileSync('git', ['worktree', 'add', '--detach', tree, ref], { cwd: root, stdio: 'inherit' })
    execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: tree, stdio: ['ignore', 'ignore', 'inherit'] })
  }
  const passthrough = [...(states ? ['--states', states] : []), ...['themes', 'viewports'].flatMap((n) => (opt(n) ? [`--${n}`, opt(n)!] : []))]
  execFileSync('npm', ['run', 'check:visual', '--', '--label', name, ...passthrough], { cwd: tree, stdio: 'inherit' })
  return join(tree, OUT_DIR, name)
}

const here = await captureHere()
if (compare) {
  const before = captureRef(compare)
  const out = resolve(root, OUT_DIR, `compare-${compare}`)
  let { changed, total } = compareDirs(before, here, out)
  // About one page opening in ten draws its text a shade differently (a few hundred scattered,
  // invisible pixels). A real change repeats; a flaky opening doesn't. So states with a changed
  // image are captured again on both sides, up to twice, and an image counts only if it changed
  // every time.
  const rechecked: string[] = []
  for (let attempt = 1; attempt <= 2 && changed.length; attempt++) {
    const flagged = [...new Set(changed.map((c) => c.file.split('--')[0]))]
    rechecked.push(...flagged)
    const again = compareDirs(
      captureRef(compare, `${compare}-again`, flagged.join(',')),
      await captureHere(`${label}-again`, { ...filter, states: flagged }, false),
      `${out}-again-${attempt}`,
    )
    const confirmed = new Set(again.changed.map((c) => c.file))
    changed = changed.filter((c) => confirmed.has(c.file))
  }
  writeFileSync(join(out, 'report.json'), JSON.stringify({ before, after: here, total, changed, rechecked: [...new Set(rechecked)] }, null, 1))
  console.log(`${changed.length} of ${total} screenshots differ from ${compare}; report in ${OUT_DIR}/compare-${compare}/report.json`)
}
