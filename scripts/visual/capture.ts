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

/** Captures this checkout into .visual/<label>/. */
async function captureHere(): Promise<string> {
  const dir = resolve(root, OUT_DIR, label)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  if (!args.includes('--no-build')) build(root)
  const server = await startServer(root, join(root, 'scripts/visual/fixtures/seed.sql'))
  const index: { file: string; state: string; area: string; title: string; theme: string; viewport: string }[] = []
  const started = Date.now()
  try {
    await walk(async (page, { state, theme, viewport }) => {
      const file = `${state.id}--${theme}--${viewport}.png`
      await page.screenshot({ path: join(dir, file), fullPage: true, animations: 'disabled', caret: 'hide' })
      index.push({ file, state: state.id, area: state.area, title: state.title, theme, viewport })
    }, filter)
  } finally {
    await server.stop()
  }
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 1))
  console.log(`${index.length} screenshots in ${OUT_DIR}/${label}/ (${Math.round((Date.now() - started) / 1000)} s)`)
  return dir
}

/** Captures <ref> with its own scripts, in a worktree kept under .visual/worktrees/. */
function captureRef(ref: string): string {
  const tree = resolve(root, OUT_DIR, 'worktrees', ref)
  if (!existsSync(tree)) {
    execFileSync('git', ['worktree', 'add', '--detach', tree, ref], { cwd: root, stdio: 'inherit' })
    execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: tree, stdio: ['ignore', 'ignore', 'inherit'] })
  }
  const passthrough = ['states', 'themes', 'viewports'].flatMap((n) => (opt(n) ? [`--${n}`, opt(n)!] : []))
  execFileSync('npm', ['run', 'check:visual', '--', '--label', ref, ...passthrough], { cwd: tree, stdio: 'inherit' })
  return join(tree, OUT_DIR, ref)
}

const here = await captureHere()
if (compare) {
  const before = captureRef(compare)
  const out = resolve(root, OUT_DIR, `compare-${compare}`)
  const { changed, total } = compareDirs(before, here, out)
  console.log(`${changed.length} of ${total} screenshots differ from ${compare}; report in ${OUT_DIR}/compare-${compare}/report.json`)
}
