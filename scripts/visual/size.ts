/**
 * npm run report:size [-- --label <name>]
 *
 * Sizes from the build output (run npm run build first; the artifact page
 * needs npm run build:page): what the typing page loads first, each chunk
 * loaded later, CSS, the admin bundle and the single-file artifact page,
 * gzipped as served. Writes .visual/size-<label>.json.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { OUT_DIR } from './config'

const args = process.argv.slice(2)
const label = args.includes('--label') ? args[args.indexOf('--label') + 1] : 'current'
const root = process.cwd()
const dist = join(root, 'dist')
const gz = (file: string) => gzipSync(readFileSync(file), { level: 9 }).length
const kb = (bytes: number) => Math.round(bytes / 102.4) / 10

/** The scripts and stylesheets a page names directly (loaded first, before any lazy chunk). */
const firstLoad = (html: string) => [...readFileSync(join(dist, html), 'utf8').matchAll(/(?:src|href)="\.?\/?((?:admin-)?assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])

const assets = readdirSync(join(dist, 'assets'))
const first = [...new Set(firstLoad('index.html'))]
const firstJs = first.filter((f) => f.endsWith('.js'))
const firstCss = first.filter((f) => f.endsWith('.css'))
const adminFirst = [...new Set(firstLoad('admin.html'))].filter((f) => !first.includes(f))
const sum = (files: string[]) => files.reduce((t, f) => t + gz(join(dist, f)), 0)
const later = assets.filter((f) => f.endsWith('.js') && !first.includes(`assets/${f}`) && !f.startsWith('worker-') && !adminFirst.includes(`assets/${f}`))

const report = {
  firstLoadJsKb: kb(sum(firstJs)),
  firstLoadCssKb: kb(sum(firstCss)),
  firstLoad: Object.fromEntries(first.map((f) => [f.replace(/-[\w-]{8}\./, '.'), kb(gz(join(dist, f)))])),
  lazyChunks: Object.fromEntries(later.map((f) => [f.replace(/-[\w-]{8}\./, '.'), kb(gz(join(dist, 'assets', f)))])),
  typescriptWorkerKb: kb(sum(assets.filter((f) => f.startsWith('worker-')).map((f) => `assets/${f}`))),
  adminOnlyKb: kb(sum(adminFirst)),
  artifactPageKb: existsSync(join(root, 'dist-page/index.html')) ? kb(gz(join(root, 'dist-page/index.html'))) : null,
}
mkdirSync(resolve(root, OUT_DIR), { recursive: true })
writeFileSync(resolve(root, OUT_DIR, `size-${label}.json`), JSON.stringify(report, null, 1))
console.log(`first load: ${report.firstLoadJsKb} KB JS + ${report.firstLoadCssKb} KB CSS (gzipped); TS worker ${report.typescriptWorkerKb} KB; admin-only ${report.adminOnlyKb} KB; artifact page ${report.artifactPageKb ?? 'not built'} KB`)
