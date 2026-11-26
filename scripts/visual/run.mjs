// Runs one of scripts/visual/*.ts through Vite, which understands the ?raw
// imports the languages use (as scripts/build-pages.mjs does):
//   node scripts/visual/run.mjs scripts/visual/capture.ts [args…]
import { createServer } from 'vite'

const [, , entry, ...args] = process.argv
if (!entry) throw new Error('Usage: node scripts/visual/run.mjs <script.ts> [args…]')
process.argv = [process.argv[0], entry, ...args]
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  await server.ssrLoadModule(`/${entry}`)
} finally {
  await server.close()
}
