/** Pixel comparison of two capture folders: which images changed, by how much, with a diff image for each. */
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

/** How different a pixel must be to count (pixelmatch's YIQ threshold), and how many may differ before an image counts as changed. */
export const THRESHOLD = 0.015
export const NOISE = 25

interface Entry {
  file: string
}

export function compareDirs(before: string, after: string, out: string) {
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const read = (dir: string) => JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as Entry[]
  const a = new Map(read(before).map((e) => [e.file, e]))
  const b = read(after)
  const changed: { file: string; reason: string; pixels?: number }[] = []
  for (const e of b) {
    if (!a.has(e.file)) {
      changed.push({ file: e.file, reason: 'new' })
      continue
    }
    const x = PNG.sync.read(readFileSync(join(before, e.file)))
    const y = PNG.sync.read(readFileSync(join(after, e.file)))
    if (x.width !== y.width || x.height !== y.height) {
      changed.push({ file: e.file, reason: `size ${x.width}×${x.height} → ${y.width}×${y.height}` })
      continue
    }
    const diff = new PNG({ width: x.width, height: x.height })
    // pixelmatch's colour threshold, anti-aliased edges excluded. 0.015 catches a grey border moved
    // 7 steps (0.023 on this scale; 0.03 missed it). With the rendering flags in walk.ts, identical
    // runs differ by at most 10 such pixels, hence NOISE.
    const pixels = pixelmatch(x.data, y.data, diff.data, x.width, x.height, { threshold: THRESHOLD })
    if (pixels > NOISE) {
      writeFileSync(join(out, e.file), PNG.sync.write(diff))
      changed.push({ file: e.file, reason: 'pixels', pixels })
    }
  }
  for (const file of a.keys()) if (!b.some((e) => e.file === file)) changed.push({ file, reason: 'missing' })
  writeFileSync(join(out, 'report.json'), JSON.stringify({ before, after, total: b.length, changed }, null, 1))
  return { changed, total: b.length }
}
