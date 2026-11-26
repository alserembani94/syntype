// Regenerates src/design/sources/*.json: each borrowed palette exactly as its
// source defines it, with where it came from (package version, or repository
// and commit, and file). src/design/primitives.test.ts checks every borrowed
// primitive against these snapshots, so updating a source is a reviewed diff.
//
//   node scripts/design/sources.mjs
//
// Needs the network: npm (Primer) and GitHub (One Dark Pro, VS Code,
// github-vscode-theme). Writes nothing else.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const OUT = 'src/design/sources'
const work = mkdtempSync(join(tmpdir(), 'syntype-sources-'))
const run = (cmd, args, cwd = work) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim()
const hex = (h) => {
  h = h.toLowerCase()
  return h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h
}

/** An npm package's files, unpacked. */
function npmPackage(spec) {
  const dir = join(work, spec.replace(/[^\w.-]/g, '_'))
  mkdirSync(dir)
  const file = run('npm', ['pack', spec, '--silent'], dir).split('\n').pop()
  run('tar', ['-xzf', file], dir)
  return join(dir, 'package')
}

/** A GitHub repository's files at its current commit (only `paths`). */
function repo(name, paths) {
  const dir = join(work, name.replace('/', '_'))
  run('git', ['clone', '-q', '--depth', '1', '--filter=blob:none', '--sparse', `https://github.com/${name}`, dir])
  run('git', ['sparse-checkout', 'set', '--no-cone', ...paths], dir)
  return { dir, commit: run('git', ['rev-parse', 'HEAD'], dir) }
}

/** Blends a translucent #rrggbbaa over an opaque #rrggbb, as a browser paints it. */
export function over(rgba, base) {
  const c = (h, i) => parseInt(h.slice(i, i + 2), 16)
  const a = c(rgba, 7) / 255
  return '#' + [1, 3, 5].map((i) => Math.round(c(rgba, i) * a + c(base, i) * (1 - a)).toString(16).padStart(2, '0')).join('')
}

const write = (name, data) => writeFileSync(join(OUT, `${name}.json`), JSON.stringify(data, null, 1) + '\n')
mkdirSync(OUT, { recursive: true })

try {
  // ——— Primer 7.10.0 light, with github-vscode-theme's overrides (GitHub Light) ———
  {
    const pkg = npmPackage('@primer/primitives@7.10.0')
    const light = createRequire(import.meta.url)(join(pkg, 'dist/js/colors/light.js'))
    const colors = {}
    const walk = (o, path) => {
      for (const [k, v] of Object.entries(o)) {
        const p = path ? `${path}.${k}` : k
        if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) colors[p] = hex(v)
        else if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x) ? (colors[`${p}.${i}`] = hex(x)) : null))
        else if (v && typeof v === 'object') walk(v, p)
      }
    }
    walk(light.default ?? light, '')
    const gh = repo('primer/github-vscode-theme', ['/src/colors.js', '/package.json'])
    const overrides = {}
    for (const m of readFileSync(join(gh.dir, 'src/colors.js'), 'utf8').matchAll(/lightColors\.([\w.]+)\s*=\s*"(#[0-9a-fA-F]{6})"/g)) overrides[m[1]] = hex(m[2])
    write('primer-light', {
      sources: [
        { package: '@primer/primitives@7.10.0', file: 'dist/js/colors/light.js' },
        { repository: 'primer/github-vscode-theme', commit: gh.commit, file: 'src/colors.js', note: 'lightColors overrides, which win over Primer' },
      ],
      colors: { ...colors, ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [`override.${k}`, v])) },
    })
  }

  // ——— Primer 11.10.0 dark and its colour-blind variants (the vision themes) ———
  {
    const pkg = npmPackage('@primer/primitives@11.10.0')
    const colors = {}
    for (const file of ['dark', 'dark-colorblind', 'dark-tritanopia']) {
      const css = readFileSync(join(pkg, `dist/css/functional/themes/${file}.css`), 'utf8')
      for (const m of css.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)\b/g)) colors[`${file}:${m[1]}`] ??= hex(m[2])
    }
    write('primer-dark', {
      sources: [{ package: '@primer/primitives@11.10.0', files: ['dist/css/functional/themes/dark.css', 'dark-colorblind.css', 'dark-tritanopia.css'] }],
      colors,
    })
  }

  // ——— One Dark Pro ———
  {
    const od = repo('Binaryify/OneDark-Pro', ['/src/themes/themeData.ts', '/src/themes/data/oneDarkPro.ts', '/themes/OneDark-Pro.json'])
    const colors = {}
    const data = readFileSync(join(od.dir, 'src/themes/themeData.ts'), 'utf8')
    const classic = data.slice(data.indexOf('classic: {'), data.indexOf('vivid: {'))
    for (const m of classic.matchAll(/(\w+): '(#[0-9a-fA-F]{6})'/g)) colors[`classic.${m[1]}`] = hex(m[2])
    const theme = JSON.parse(readFileSync(join(od.dir, 'themes/OneDark-Pro.json'), 'utf8'))
    for (const [k, v] of Object.entries(theme.colors ?? {})) if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v)) colors[`colors.${k}`] = hex(v)
    write('onedark', {
      sources: [{ repository: 'Binaryify/OneDark-Pro', commit: od.commit, files: ['src/themes/themeData.ts (textColors.classic)', 'themes/OneDark-Pro.json (colors)'] }],
      colors,
    })
  }

  // ——— VS Code: Dark High Contrast, Dark+ token colours, the colour registry ———
  {
    const files = ['extensions/theme-defaults/themes/hc_black.json', 'extensions/theme-defaults/themes/dark_plus.json', 'extensions/theme-defaults/themes/dark_vs.json']
    const reg = ['src/vs/platform/theme/common/colors/baseColors.ts', 'src/vs/platform/theme/common/colors/chartsColors.ts']
    const vs = repo('microsoft/vscode', [...files, ...reg].map((f) => `/${f}`))
    const colors = {}
    /** JSON with comments and trailing commas (VS Code's theme files), as plain JSON. */
    const strip = (t) => {
      let out = ''
      for (let i = 0, inString = false; i < t.length; i++) {
        const c = t[i]
        if (inString) {
          out += c
          if (c === '\\') out += t[++i]
          else if (c === '"') inString = false
        } else if (c === '"') {
          inString = true
          out += c
        } else if (c === '/' && t[i + 1] === '/') {
          while (i < t.length && t[i] !== '\n') i++
          out += '\n'
        } else if (c === '/' && t[i + 1] === '*') {
          i = t.indexOf('*/', i + 2) + 1
        } else out += c
      }
      return out.replace(/,(\s*[}\]])/g, '$1')
    }
    const hc = JSON.parse(strip(readFileSync(join(vs.dir, files[0]), 'utf8')))
    for (const [k, v] of Object.entries(hc.colors ?? {})) if (/^#[0-9a-f]{3,8}$/i.test(v)) colors[`hc.${k}`] = hex(v)
    // Token colours: high contrast's own, then Dark+ and Dark (VS), which it inherits.
    for (const f of files) {
      const t = JSON.parse(strip(readFileSync(join(vs.dir, f), 'utf8')))
      const prefix = f.includes('hc_black') ? 'hcToken' : f.includes('plus') ? 'darkPlus' : 'darkVs'
      for (const tc of t.tokenColors ?? []) {
        const fg = tc.settings?.foreground
        if (fg && /^#[0-9a-f]{6}$/i.test(fg)) colors[`${prefix}.${tc.name ?? [].concat(tc.scope)[0]}`] = hex(fg)
      }
    }
    // Registry defaults for high contrast (hcDark), and for colours given one value for every theme.
    for (const f of reg) {
      const t = readFileSync(join(vs.dir, f), 'utf8')
      for (const m of t.matchAll(/registerColor\('([\w.]+)',\s*(\{[^}]*\}|'#[0-9a-fA-F]{3,8}')/g)) {
        const id = m[1]
        const body = m[2]
        const lit = body.match(/^'(#[0-9a-fA-F]{3,8})'$/)
        const hcDark = body.match(/hcDark:\s*'(#[0-9a-fA-F]{3,8})'/)
        if (lit) colors[`registry.${id}`] = hex(lit[1])
        else if (hcDark) colors[`registry.${id}`] = hex(hcDark[1])
      }
    }
    // descriptionForeground is transparent(foreground, 0.7) in high contrast: white at 70% over black.
    colors['registry.descriptionForeground'] = over('#ffffffb3', '#000000')
    write('vscode', {
      sources: [{ repository: 'microsoft/vscode', commit: vs.commit, files: [...files, ...reg] }],
      derived: { 'registry.descriptionForeground': 'transparent(foreground #ffffff, 0.7) over editor.background #000000' },
      colors,
    })
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
console.log(`snapshots written to ${OUT}/`)
