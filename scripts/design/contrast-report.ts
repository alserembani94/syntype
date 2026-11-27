/**
 * node scripts/visual/run.mjs scripts/design/contrast-report.ts [--shots <dir>] [--out <dir>]
 *
 * Builds the contrast report page from what the other scripts wrote:
 * .visual/contrast/roles.json (contrast-roles.ts), pages.json
 * (scripts/visual/contrast.ts) and cvd.json (cvd-study.ts), plus screenshots
 * from `npm run check:visual -- --label contrast-shots`. When the "before"
 * files exist (roles-before.json, pages-before.json, cvd-before.json, saved
 * from where a round started), each theme shows before and after. CHANGES and
 * NOTES hold the reviewer's account of the round; update them with the next
 * one. docs/contrast-testing.md is the process.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Deficiency } from '../../src/themes'
import { seen } from '../../src/test/colour'

const argv = process.argv.slice(2)
const opt = (name: string, fallback: string) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback)
const DIR = resolve('.visual/contrast')
const SHOTS = resolve(opt('shots', '.visual/contrast-shots'))
const OUT = resolve(opt('out', join(DIR, 'report')))
const SHOT_STATES = ['typing-mid-run', 'typing-results'] as const

type Row = { group: string; name: string; where: string; kind: 'text' | 'large' | 'ui'; fgLabel: string; bgLabel: string; fg: string; bg: string; ratio: number; need: number; aaa?: number; status: 'pass' | 'fail' | 'exempt'; exempt?: string; seenRatio?: number }
type Theme = { id: string; name: string; wcag?: 'AA'; roles: Record<string, string>; rows: Row[] }
type PagePair = { fg: string; bg: string; ratio: number; need: number; size: string; weight: string; result: 'pass' | 'fail'; count: number; examples: { state: string; viewport: string; text: string; target: string }[] }
type Page = { theme: string; pairs: PagePair[]; reviews: { why: string; count: number }[] }

const json = <T,>(f: string): T | null => (existsSync(join(DIR, f)) ? JSON.parse(readFileSync(join(DIR, f), 'utf8')) : null)
const themes = json<Theme[]>('roles.json')!
const pages = json<Page[]>('pages.json') ?? []
const cvd = json<Record<string, any>>('cvd.json')!
const before = json<Theme[]>('roles-before.json') ?? []
const pagesBefore = json<Page[]>('pages-before.json') ?? []
const cvdBefore = json<Record<string, any>>('cvd-before.json')

// ——— Severity of a pair that still fails ———
type Severity = 'critical' | 'major' | 'minor'
function severity(r: Row): Severity {
  if (/Untyped|Focus ring/.test(r.name)) return 'critical'
  if (r.ratio >= r.need * 0.9) return 'minor'
  return 'major'
}
/** A pair's name in the round's first measurement, as it's called now. */
const sameName = (n: string) => n.replace(/ \((\d+%|ring\/50)\)$/, '').replace(/ \(\d+% on accent\)$/, '')

// ——— The round, told (contrast round, November 2026) ———
const CHANGES: { step: string; title: string; body: string }[] = [
  { step: 'AC 1', title: 'A rule before any colour changed', body: 'Themes flagged <code>wcag: \'AA\'</code> must meet WCAG 2.2 AA in every colour pair the app draws (rule T6). The pairs live in <code>src/themes/pairs.ts</code>, shared by the test and this report. The failures known at the start went on a list that could only shrink: 107 entries.' },
  { step: 'AC 2', title: 'Shared fixes in the editor and components', body: 'Untyped code is plain grey (the secondary text colour) until typed, instead of 34% of its colour; every character state mixes between two readable colours. Line numbers, line-end markers, aid tags, inactive tabs and the suggestion detail became readable; the focus ring is drawn at full colour.' },
  { step: 'AC 3', title: 'Field borders in every theme', body: 'A new role, <code>--input-border</code>, draws the edges of text fields, checkboxes, radios and a switch\'s off track at 3:1 or more, from each theme\'s own palette; fills keep the soft <code>--input</code>.' },
  { step: 'AC 4', title: 'Syntype Light and Dark to full AA', body: 'Light\'s orange, green, red and string darkened just enough; comments in both became olive, so a typed comment still differs from untyped grey; Dark\'s secondary text and red lightened.' },
  { step: 'AC 5', title: 'Colour vision themes: the last clashes', body: 'Five code colours changed (the fewest Primer\'s scales allowed) so success no longer looks like a code colour; suggestion icons take the highlighted row\'s colour; red buttons and badges rest on the mistake tint with a red outline on hover, in every theme.' },
  { step: 'AC 6', title: 'A WCAG AA badge in the theme picker', body: 'Flagged themes show "WCAG AA" (spoken as "meets WCAG AA contrast"), and searching "accessible" lists them.' },
  { step: 'AC 7', title: 'A new theme: Light High Contrast', body: 'VS Code\'s own, from its source files at a pinned commit, flagged AA from the start with no known failures.' },
  { step: 'AC 8', title: 'Closing the round', body: 'GitHub Light and Green Phosphor turned out to pass every pair with their own colours, so they are flagged too. One Dark Pro stays faithful to its source, and its three gaps are stated below.' },
]

const NOTES: Record<string, string[]> = {
  light: ['From 21 failures to none. The page\'s pale grey made every colour that passed on white cards fail by about 12%, so the orange, green and red each moved a step darker; comments turned olive.'],
  dark: ['From 9 failures to none: olive comments, a lighter secondary grey and a lighter red; the rest came from the shared fixes.'],
  'hc-black': ['Its own colours always passed; every failure came from shared styling (faint untyped code, the half-strength focus ring, aid tags), so the shared fixes cleared it without touching its palette.'],
  'hc-light': ['New in this round, and clean from the start: every colour from VS Code\'s Light High Contrast, strings in its regex maroon so they don\'t share the keyword blue, tints from its own greys.'],
  'one-dark-pro': ['The one theme left outside AA, by choice: it keeps One Dark Pro\'s own comment grey (3.73:1) and red (4.38:1 in dialogs, 3.97:1 on its mistake tint). Everything the app itself draws now passes; only these source colours fall short. The full-site axe check exempts contrast in this theme with that reason.'],
  'github-light': ['Primer was designed for AA, and once the shared fixes landed (untyped code, focus ring, field borders, red buttons) every pair passed with GitHub\'s own colours, so it is now flagged.'],
  protanopia: ['Function purple looked like success blue (4.5 ΔE as seen). Keyword and function changed colour; the closest pair is now 12.4 ΔE as protanopes see it.'],
  deuteranopia: ['Keywords were the same blue as success (2 ΔE, even with normal vision). Keywords are now orange; the closest pair is 12.3 ΔE.'],
  tritanopia: ['String and type sat 11 ΔE from success as seen; both changed, and the closest pair is now 15.0 ΔE. Its red button label is fixed by the mistake-tint change, not by a new red.'],
  phosphor: ['A single-hue theme whose code colours differ by lightness alone. Once untyped code and field borders were fixed, every pair passed with its own greens, so it is flagged. Its chart colours still sit closer than 12 ΔE (rule T3, a distinctness floor rather than WCAG).'],
}

// ——— Colour maths for the report ———
const toHex = (rgb: number[]) => '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')
const seenHex = (hex: string, v?: Deficiency) => toHex(seen(hex, v))

// ——— HTML ———
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', major: 'Major', minor: 'Minor' }

function verdict(r: { status: string; ratio: number; need: number }) {
  if (r.status === 'exempt') return `<span class="pill exempt"><i aria-hidden="true">–</i>Exempt</span>`
  if (r.status === 'pass') return r.ratio >= r.need * 1.1 ? `<span class="pill pass"><i aria-hidden="true">✓</i>Pass</span>` : `<span class="pill close"><i aria-hidden="true">✓</i>Pass, close</span>`
  return `<span class="pill fail"><i aria-hidden="true">✕</i>Fail</span>`
}
function sample(r: Row) {
  if (r.kind === 'ui') return `<span class="sample ui" style="background:${r.bg}"><span style="border-color:${r.fg};background:${/Chart|Slider fill|Switch|Caret|underline/.test(r.name) ? r.fg : 'transparent'}"></span></span>`
  return `<span class="sample" style="background:${r.bg};color:${r.fg}">Aa</span>`
}
function bar(r: { ratio: number; need: number }) {
  const pct = Math.min(100, (Math.log(r.ratio) / Math.log(21)) * 100)
  const at = (Math.log(r.need) / Math.log(21)) * 100
  return `<span class="bar" aria-hidden="true"><span class="fill ${r.ratio >= r.need ? 'ok' : 'bad'}" style="width:${pct}%"></span><span class="mark" style="left:${at}%"></span></span>`
}
const need = (r: Row) => `${r.need}:1${r.kind === 'ui' ? ' <small>1.4.11</small>' : r.kind === 'large' ? ' <small>large</small>' : ' <small>1.4.3</small>'}`

function rowHtml(r: Row, vision: boolean) {
  const sev = r.status === 'fail' ? `<span class="sev ${severity(r)}">${SEV_LABEL[severity(r)]}</span>` : ''
  return `<tr class="${r.status}">
  <td class="s">${sample(r)}</td>
  <td><b>${esc(r.name)}</b>${sev}<div class="where">${esc(r.where)}${r.exempt ? ` · <em>${esc(r.exempt)}</em>` : ''}</div><div class="hex"><code>${r.fg}</code> on <code>${r.bg}</code> · ${esc(r.fgLabel)} on ${esc(r.bgLabel)}</div></td>
  <td class="num"><span class="ratio">${r.ratio.toFixed(2)}</span>${bar(r)}${vision && r.seenRatio ? `<div class="where">as seen ${r.seenRatio.toFixed(2)}</div>` : ''}</td>
  <td class="num need">${need(r)}</td>
  <td>${verdict(r)}</td>
</tr>`
}

function shots(id: string) {
  const imgs = SHOT_STATES.map((s) => ({ s, file: `${s}--${id}--desktop.png` })).filter(({ file }) => existsSync(join(SHOTS, file)))
  for (const { file } of imgs) copyFileSync(join(SHOTS, file), join(OUT, 'shots', file))
  if (!imgs.length) return ''
  const caption: Record<string, string> = { 'typing-mid-run': 'Mid-run: typed, untyped, the caret and a mistake', 'typing-results': 'Results: the big numbers and the chart' }
  return `<div class="shots">${imgs.map(({ s, file }) => `<figure><a href="shots/${file}" target="_blank" rel="noopener"><img src="shots/${file}" alt="${esc(caption[s])}, ${esc(id)} theme" loading="lazy" width="1280" height="800"></a><figcaption>${esc(caption[s])}</figcaption></figure>`).join('')}</div>`
}

function pageSummary(id: string) {
  const p = pages.find((x) => x.theme === id)
  if (!p) return `<p class="muted">The in-browser measurement for this theme isn't in this report.</p>`
  const fails = p.pairs.filter((x) => x.result === 'fail')
  const elements = p.pairs.reduce((n, x) => n + x.count, 0)
  const reviews = p.reviews.reduce((n, r) => n + r.count, 0)
  const list = fails.length
    ? `<div class="tw"><table class="pt"><thead><tr><th></th><th>Text axe found below AA</th><th class="num">Ratio</th><th class="num">Needs</th><th class="num">Elements</th></tr></thead><tbody>${fails
        .map(
          (f) =>
            `<tr><td class="s"><span class="sample" style="background:${f.bg};color:${f.fg}">Aa</span></td><td>${f.examples.map((e) => `“${esc(e.text || '…')}” <span class="where">${esc(e.state)}</span>`).join('<br>')}<div class="hex"><code>${f.fg}</code> on <code>${f.bg}</code> · ${esc(f.size)} ${esc(f.weight)}</div></td><td class="num">${f.ratio.toFixed(2)}</td><td class="num">${f.need}:1</td><td class="num">${f.count}</td></tr>`,
        )
        .join('')}</tbody></table></div>`
    : `<p><span class="pill pass"><i aria-hidden="true">✓</i>No text below AA</span> that axe could measure.</p>`
  return `<p class="stat-line"><b>${elements.toLocaleString('en')}</b> text elements measured in the browser, <b>${p.pairs.length}</b> distinct colour pairs, <b>${fails.length}</b> below AA. axe couldn't judge <b>${reviews.toLocaleString('en')}</b> elements (${p.reviews.map((r) => `${esc(r.why)}: ${r.count}`).join(', ') || 'none'}); the editor's code is among them, which is why the role pairs above cover it.</p>${list}`
}

// ——— Colour vision section ———
const CVD_ABOUT: Record<Deficiency, { cone: string; sees: string; keeps: string; who: string; advice: string }> = {
  protanopia: {
    cone: 'No working long-wavelength (red) cones.',
    sees: 'Reds, oranges, yellows and greens fall onto one yellow–brown axis, and reds also look much darker (a red can read as near-black). Purple and blue merge, since purple is blue plus red.',
    keeps: 'Blue against yellow, and lightness.',
    who: 'About 1% of men; far fewer women.',
    advice: 'Use blue and orange or yellow as the two signal hues (GitHub\'s own colour-blind theme does: success blue, danger orange). Never mark a mistake with red alone, because it darkens and loses its alarm. Separate code colours by lightness too.',
  },
  deuteranopia: {
    cone: 'No working medium-wavelength (green) cones.',
    sees: 'The same red–green confusion as protanopia, but without the darkening of reds. Greens, oranges and reds look like similar mustard or olive tones.',
    keeps: 'Blue against yellow, and lightness. With deuteranomaly, the mild form, about 5% of men see a weaker version of this.',
    who: 'About 1% of men have deuteranopia; with deuteranomaly, about 6% of men in all. It is the most common deficiency.',
    advice: 'The same blue–orange axis as protanopia, and the same suggestion. Watch blues that sit close together: they stay blue, so two of them are hard to tell apart.',
  },
  tritanopia: {
    cone: 'No working short-wavelength (blue) cones.',
    sees: 'Blue and green merge, and so do yellow and pink or light grey. Most colours shift toward red or cyan.',
    keeps: 'Red against cyan, and lightness.',
    who: 'Rare: about 1 in 10,000 people, men and women alike (it isn\'t on the X chromosome).',
    advice: 'Use red and cyan or blue as the signal hues (GitHub\'s tritanopia theme keeps danger red and success blue). Avoid separating anything by blue against green, or yellow against pink.',
  },
}

function strip(colours: Record<string, string>, v?: Deficiency) {
  return `<div class="strip">${Object.entries(colours)
    .map(([k, hex]) => `<span class="chip"><span class="sw" style="background:${seenHex(hex, v)}"></span><span class="k">${esc(k.replace('code-', ''))}</span></span>`)
    .join('')}</div>`
}

/** A line of code drawn in a palette, as seen. */
function codeLine(c: Record<string, string>, v?: Deficiency) {
  const s = (role: string, text: string) => `<span style="color:${seenHex(c[role], v)}">${esc(text)}</span>`
  const bg = seenHex(cvd.card, v)
  return `<pre class="code" style="background:${bg};color:${seenHex(cvd.foreground, v)}">${s('keyword', 'def')} ${s('function', 'word_count')}(text: ${s('type', 'str')}) -&gt; ${s('type', 'int')}:
    ${s('comment', '# Split on whitespace')}
    ${s('keyword', 'return')} ${s('function', 'len')}(text.split(${s('string', '" "')})) + ${s('number', '0')}
${s('success', '✓ 98 wpm')}  ${s('mistake', 'mistake')}</pre>`
}


function themeSection(t: Theme) {
  const vision = ['protanopia', 'deuteranopia', 'tritanopia'].includes(t.id)
  const counted = t.rows.filter((r) => r.status !== 'exempt')
  const fails = counted.filter((r) => r.status === 'fail')
  const old = before.find((b) => b.id === t.id)
  const oldFails = old ? old.rows.filter((r) => r.status === 'fail') : []
  const groups = [...new Set(t.rows.map((r) => r.group))]
  const fixed = oldFails.map((o) => ({ o, n: t.rows.find((r) => r.name === sameName(o.name) && r.bgLabel.split(' ')[0] === o.bgLabel.split(' ')[0]) ?? t.rows.find((r) => r.name === sameName(o.name)) }))
  const table = (rows: Row[]) => `<div class="tw"><table><thead><tr><th></th><th>Pair</th><th class="num">Ratio</th><th class="num">Needs</th><th>Verdict</th></tr></thead><tbody>${rows.map((r) => rowHtml(r, vision)).join('')}</tbody></table></div>`
  return `<section class="theme" id="t-${t.id}">
<header class="theme-head" style="--tbg:${t.roles.background};--tfg:${t.roles.foreground};--tpr:${t.roles.primary}">
  <div><h2>${esc(t.name)} ${t.wcag ? '<span class="pill pass">WCAG AA</span>' : '<span class="pill exempt">faithful to its source</span>'}</h2><div class="swatches">${['background', 'card', 'foreground', 'muted-foreground', 'primary', 'destructive', 'success', 'code-keyword', 'code-string', 'code-number', 'code-function', 'code-type', 'code-comment'].map((k) => `<span title="${k} ${t.roles[k]}" style="background:${t.roles[k]}"></span>`).join('')}</div></div>
  <div class="score"><span class="big">${counted.length - fails.length}<small>/${counted.length}</small></span><span>pairs pass${old ? ` · was ${old.rows.filter((r) => r.status === 'pass').length}/${old.rows.filter((r) => r.status !== 'exempt').length}` : ' · new'}</span></div>
</header>
${shots(t.id)}
<div class="notes"><h3>Comments</h3>${(NOTES[t.id] ?? []).map((n) => `<p>${n}</p>`).join('')}</div>
${fails.length ? `<h3>Still below AA</h3>${table(fails)}` : `<p><span class="pill pass"><i aria-hidden="true">✓</i>Every pair passes</span></p>`}
${fixed.length ? `<details><summary>Fixed in this round (${fixed.length})</summary><div class="tw"><table><thead><tr><th></th><th>Pair</th><th class="num">Before</th><th class="num">After</th><th>Verdict</th></tr></thead><tbody>${fixed
    .map(({ o, n }) => `<tr><td class="s">${sample(n ?? o)}</td><td><b>${esc(sameName(o.name))}</b><div class="where">${esc((n ?? o).where)}</div><div class="hex"><code>${o.fg}</code> on <code>${o.bg}</code> → ${n ? `<code>${n.fg}</code> on <code>${n.bg}</code>` : 'no longer drawn'}</div></td><td class="num"><span class="ratio">${o.ratio.toFixed(2)}</span></td><td class="num"><span class="ratio">${n ? n.ratio.toFixed(2) : '–'}</span>${n ? bar(n) : ''}</td><td>${n ? verdict(n) : ''}</td></tr>`)
    .join('')}</tbody></table></div></details>` : ''}
<details><summary>Every pair now (${t.rows.length})</summary>${groups.map((g) => `<h4>${esc(g)}</h4>${table(t.rows.filter((r) => r.group === g))}`).join('')}</details>
<h3>In the browser</h3>
${pageSummary(t.id)}
</section>`
}

function cvdSection() {
  const out: string[] = []
  for (const v of ['protanopia', 'deuteranopia', 'tritanopia'] as Deficiency[]) {
    const a = CVD_ABOUT[v]
    const pal = (src: any) => { const t = src.today.find((x: any) => x.vision === v); const c = t.colours; return { colours: { keyword: c['code-keyword'], string: c['code-string'], number: c['code-number'], function: c['code-function'], type: c['code-type'], comment: c['code-comment'], mistake: c.destructive, success: c.success }, closest: t.closest } }
    const now = pal(cvd)
    const was = cvdBefore ? pal(cvdBefore) : null
    const close = (p: any) => p.closest.slice(0, 2).map((c: any) => `${c.a.replace('code-', '')} / ${c.b.replace('code-', '')} <b class="${c.seen < 12 ? 'low' : ''}">${c.seen}</b>`).join(' · ')
    out.push(`<article class="cvd" id="cvd-${v}">
<h3>${v[0].toUpperCase() + v.slice(1)}</h3>
<dl class="facts"><div><dt>What's missing</dt><dd>${a.cone}</dd></div><div><dt>What merges</dt><dd>${a.sees}</dd></div><div><dt>What survives</dt><dd>${a.keeps}</dd></div><div><dt>Who</dt><dd>${a.who}</dd></div></dl>
<p><b>What we did.</b> ${NOTES[v]?.[0] ?? ''}</p>
<div class="compare">
  ${was ? `<div><h4>Before, as simulated for ${v}</h4>${codeLine(was.colours, v)}${strip(was.colours, v)}<p class="small">Closest pairs (ΔE, as seen): ${close(was)}</p></div>` : ''}
  <div><h4>Now, as simulated for ${v}</h4>${codeLine(now.colours, v)}${strip(now.colours, v)}<p class="small">Closest pairs (ΔE, as seen): ${close(now)}</p></div>
  <div><h4>Now, as normal vision sees it</h4>${codeLine(now.colours)}${strip(now.colours)}</div>
</div>
<p><b>Advice for the next vision theme.</b> ${a.advice}</p>
</article>`)
  }
  const refs = cvd.references
    .map((r: any) => `<tr><td><b>${esc(r.name)}</b><div class="strip">${Object.entries(r.colours).map(([k, hex]) => `<span class="chip"><span class="sw" style="background:${hex}"></span><span class="k">${esc(k)}</span></span>`).join('')}</div></td>${['normal', 'protanopia', 'deuteranopia', 'tritanopia'].map((x) => `<td class="num">${r.minSeen[x].seen}</td>`).join('')}</tr>`)
    .join('')
  return `<section id="cvd" class="cvd-wrap">
<h2>Colour vision</h2>
<p class="lede">The three deficiencies, and each theme before and after, as its audience sees it (Machado, Oliveira &amp; Fernandes 2009, full severity, the model rule T4 uses). Differences are CIEDE2000 (ΔE): about 2 is barely visible side by side, and 12 is T4's floor for colours a player must tell apart while typing. The closest pairs below count success against the code colours too, which T4 checks since this round.</p>
${out.join('\n')}
<h3>Reference palettes, scored the same way</h3>
<p>The smallest difference between any two colours in each palette, as each group sees it. Even palettes designed for colour vision drop near 12 for some group, which is why Syntype has one theme per deficiency.</p>
<div class="tw"><table class="refs"><thead><tr><th>Palette</th><th class="num">Normal</th><th class="num">Protan</th><th class="num">Deutan</th><th class="num">Tritan</th></tr></thead><tbody>${refs}</tbody></table></div>
</section>`
}

// ——— Page ———
mkdirSync(join(OUT, 'shots'), { recursive: true })
const flagged = themes.filter((t) => t.wcag).length
const oldTotal = before.reduce((n, t) => n + t.rows.filter((r) => r.status === 'fail').length, 0)
const newTotal = themes.reduce((n, t) => n + t.rows.filter((r) => r.status === 'fail').length, 0)
const axeNow = (id: string) => pages.find((x) => x.theme === id)?.pairs.filter((p) => p.result === 'fail').length
const axeWas = (id: string) => pagesBefore.find((x) => x.theme === id)?.pairs.filter((p) => p.result === 'fail').length
const css = readFileSync(new URL('./contrast-report.css', import.meta.url), 'utf8')
const html = `<title>Syntype Contrast Round</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${css}</style>
<div class="wrap">
<header class="top">
  <p class="eyebrow">Accessibility · WCAG 2.2 AA · round closed ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  <h1>Contrast round</h1>
  <p class="lede">Every colour pair Syntype draws, measured in every theme against WCAG 2.2 AA, before and after the round. ${flagged} of ${themes.length} themes now meet AA in every pair and carry the badge in the theme picker; One Dark Pro stays faithful to its source. Role-pair failures across the themes went from ${oldTotal} to ${newTotal}.</p>
  <div class="legend"><span class="pill pass"><i aria-hidden="true">✓</i>Pass</span><span class="pill close"><i aria-hidden="true">✓</i>Pass, within 10%</span><span class="pill fail"><i aria-hidden="true">✕</i>Fail</span><span class="pill exempt"><i aria-hidden="true">–</i>Exempt (reason given)</span></div>
</header>

<nav class="toc" aria-label="Themes"><div class="tw"><table class="overview"><thead><tr><th>Theme</th><th class="num">Role pairs failing</th><th class="num">Text below AA in the browser</th><th>Now</th></tr></thead><tbody>${themes
  .map((t) => {
    const old = before.find((b) => b.id === t.id)
    const f = t.rows.filter((r) => r.status === 'fail').length
    return `<tr><td><a href="#t-${t.id}"><span class="tdot" style="background:${t.roles.background};border-color:${t.roles.primary}"></span>${esc(t.name)}</a></td><td class="num">${old ? `${old.rows.filter((r) => r.status === 'fail').length} → ` : 'new · '}<b>${f}</b></td><td class="num">${axeWas(t.id) !== undefined ? `${axeWas(t.id)} → ` : ''}<b>${axeNow(t.id) ?? '–'}</b></td><td>${t.wcag ? '<span class="pill pass">WCAG AA</span>' : '<span class="pill exempt">faithful</span>'}</td></tr>`
  })
  .join('')}</tbody></table></div><p class="small">Before: the round's first measurement (53 pairs per theme). After: today's, with 70 pairs per theme, because the round found pairs the first list had missed. Browser counts are distinct colour pairs axe found below AA across every screen. <a href="#cvd">Colour vision</a> · <a href="#method">How this was measured</a></p></nav>

<section id="changes"><h2>What changed, and why</h2>
<ol class="big-findings">${CHANGES.map((c) => `<li><span class="sev minor">${c.step}</span><h3>${c.title}</h3><p>${c.body}</p></li>`).join('')}</ol>
</section>

${themes.map(themeSection).join('\n')}

${cvdSection()}

<section id="method"><h2>How this was measured</h2>
<p>Two measurements, because each misses what the other sees. The process, thresholds and the steps for a new theme are in <code>docs/contrast-testing.md</code>; <code>npm run report:contrast</code> runs them all and rebuilds this page.</p>
<ol class="steps">
<li><b>Role pairs</b> (<code>src/themes/pairs.ts</code>). Every foreground and background combination the app draws, with where it appears, resolved through each theme's roles; translucent colours are composited first. The editor's dimming is read from <code>editor.css</code>. Rule T6 runs the same list in <code>npm test</code> for every flagged theme.</li>
<li><b>Pages</b> (<code>scripts/visual/contrast.ts</code>). axe's colour-contrast rule in Chromium on every screen state, theme and viewport, keeping passes and failures, to catch what the pair list misses.</li>
<li><b>Colour vision</b> (<code>scripts/design/cvd-study.ts</code>). The simulation, distances and palette search above.</li>
</ol>
<div class="tw"><table class="thr"><thead><tr><th>What</th><th>WCAG</th><th class="num">AA</th><th>Held by</th></tr></thead><tbody>
<tr><td>Text, code, comments, untyped code, line numbers</td><td>1.4.3</td><td class="num">4.5:1</td><td>T6 (flagged themes)</td></tr>
<tr><td>Large text (24px, or 18.66px bold)</td><td>1.4.3</td><td class="num">3:1</td><td>T6</td></tr>
<tr><td>Field edges, focus rings, states, charts, line-end markers</td><td>1.4.11</td><td class="num">3:1</td><td>T6; field edges in every theme by T3</td></tr>
<tr><td>Colour vision themes, as their audience sees them</td><td>–</td><td class="num">same</td><td>T6 and T4</td></tr>
</tbody></table></div>
</section>
</div>`
writeFileSync(join(OUT, 'index.html'), html)
console.log(`Wrote ${join(OUT, 'index.html')}`)
