/**
 * npm run report:size [-- --label <name>]
 *
 * Sizes from the build output (run npm run build first; the artifact page
 * needs npm run build:page): what the typing page loads first, each chunk
 * loaded later, CSS, the admin bundle and the single-file artifact page,
 * gzipped as served. Writes .visual/size-<label>.json.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { OUT_DIR } from './config'
import { BUDGET, firstLoad, firstLoadFiles, gzipKb } from '../size-budget.mjs'

const args = process.argv.slice(2)
const label = args.includes('--label') ? args[args.indexOf('--label') + 1] : 'current'
const root = process.cwd()
const dist = join(root, 'dist')

const assets = readdirSync(join(dist, 'assets'))
const first = firstLoadFiles(dist, 'index.html')
const adminFirst = firstLoadFiles(dist, 'admin.html').filter((f) => !first.includes(f))
const sum = (files: string[]) => gzipKb(...files.map((f) => join(dist, f)))
const size = firstLoad(dist)
const later = assets.filter((f) => f.endsWith('.js') && !first.includes(`assets/${f}`) && !f.startsWith('worker-') && !adminFirst.includes(`assets/${f}`))

const report = {
  firstLoadJsKb: size.js,
  firstLoadCssKb: size.css,
  budgetKb: BUDGET,
  firstLoad: Object.fromEntries(first.map((f) => [f.replace(/-[\w-]{8}\./, '.'), gzipKb(join(dist, f))])),
  lazyChunks: Object.fromEntries(later.map((f) => [f.replace(/-[\w-]{8}\./, '.'), gzipKb(join(dist, 'assets', f))])),
  typescriptWorkerKb: sum(assets.filter((f) => f.startsWith('worker-')).map((f) => `assets/${f}`)),
  adminOnlyKb: sum(adminFirst),
  artifactPageKb: existsSync(join(root, 'dist-page/index.html')) ? gzipKb(join(root, 'dist-page/index.html')) : null,
}
mkdirSync(resolve(root, OUT_DIR), { recursive: true })
writeFileSync(resolve(root, OUT_DIR, `size-${label}.json`), JSON.stringify(report, null, 1))
console.log(`first load: ${report.firstLoadJsKb} of ${BUDGET.js} KB JS + ${report.firstLoadCssKb} of ${BUDGET.css} KB CSS (gzipped, budget in scripts/size-budget.mjs); TS worker ${report.typescriptWorkerKb} KB; admin-only ${report.adminOnlyKb} KB; artifact page ${report.artifactPageKb ?? 'not built'} KB`)
