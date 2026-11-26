/**
 * The local site for the checks: the built app and the real Worker
 * (wrangler dev) with a fresh local database, migrated and seeded with
 * scripts/visual/fixtures/seed.sql. Runs from `root` (this checkout, or a
 * worktree of an older commit when comparing), on port 8787.
 */
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, TEST_VARS } from './config'

/**
 * The environment for child processes. Vite (which runs these scripts) sets
 * NODE_ENV=development; a build that inherited it would be React's development
 * build, so it's reset. Wrangler's metrics are off (their hosts aren't needed).
 */
const childEnv = () => ({ ...process.env, NODE_ENV: 'production', CI: '1', WRANGLER_SEND_METRICS: 'false' })

const npx = (root: string, args: string[]) => execFileSync('npx', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: childEnv() })

export function build(root: string) {
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'], env: childEnv() })
}

export async function startServer(root: string, seed: string) {
  if (await fetch(`${BASE}/api/health`).then(() => true, () => false)) throw new Error(`Something is already serving ${BASE}; stop it first.`)
  const state = join(root, '.visual', 'state')
  rmSync(state, { recursive: true, force: true })
  npx(root, ['wrangler', 'd1', 'migrations', 'apply', 'syntype', '--local', '--persist-to', state])
  if (!existsSync(seed)) throw new Error(`No fixtures at ${seed}: run npm run visual:fixtures`)
  npx(root, ['wrangler', 'd1', 'execute', 'syntype', '--local', '--persist-to', state, '--file', seed])
  const vars = Object.entries(TEST_VARS).flatMap(([k, v]) => ['--var', `${k}:${v}`])
  const child = spawn('npx', ['wrangler', 'dev', '--port', '8787', '--persist-to', state, '--show-interactive-dev-session=false', ...vars], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnv(),
    // Its own process group, so stopping it stops wrangler's workerd too.
    detached: true,
  })
  const kill = () => {
    try {
      process.kill(-child.pid!, 'SIGTERM')
    } catch {
      /* already gone */
    }
  }
  let output = ''
  child.stdout.on('data', (d) => (output += d))
  child.stderr.on('data', (d) => (output += d))
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`wrangler dev exited:\n${output}`)
    const ok = await fetch(`${BASE}/api/health`).then((r) => r.ok, () => false)
    if (ok) {
      return {
        stop: async () => {
          const exited = new Promise((r) => (child.exitCode !== null ? r(null) : child.once('exit', r)))
          kill()
          await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))])
        },
      }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  kill()
  throw new Error(`wrangler dev didn't start:\n${output}`)
}
