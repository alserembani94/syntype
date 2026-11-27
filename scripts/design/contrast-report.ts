/**
 * node scripts/visual/run.mjs scripts/design/contrast-report.ts [--shots <dir>] [--out <dir>]
 *
 * Builds the contrast round's report page from what the other scripts wrote:
 * .visual/contrast/roles.json (contrast-roles.ts), pages.json
 * (scripts/visual/contrast.ts) and cvd.json (cvd-study.ts), plus screenshots
 * from `npm run check:visual -- --label contrast-shots`. NOTES holds the
 * reviewer's comments for the round; update them when the findings change.
 * docs/contrast-testing.md is the process.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Deficiency } from '../../src/themes'
import { contrast, seen } from '../../src/test/colour'

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

// ——— Severity: how much each failing pair matters to a player ———
type Severity = 'critical' | 'major' | 'minor'
function severity(r: Row): Severity {
  if (/Untyped|Focus ring/.test(r.name)) return 'critical'
  // The brand colour as text is on every screen, so a near miss there still matters.
  if (/Primary text|Button label on primary|Selected chip/.test(r.name)) return 'major'
  if (r.ratio >= r.need * 0.9 || /aid tag/i.test(r.name)) return 'minor'
  return 'major'
}

// ——— Reviewer's notes for the round (November 2026) ———
const OVERVIEW: { severity: Severity; title: string; body: string }[] = [
  {
    severity: 'critical',
    title: 'The code still to be typed is too faint in every theme',
    body: 'Untyped characters are drawn at 34% of their colour (editor.css, <code>.c { --a: 34% }</code>). That is the text the game asks the player to read, so it is content under WCAG 1.4.3, not decoration or a disabled control. It measures 1.4–2.9:1 against 4.5:1 in all nine themes. axe can\'t catch it: the editor draws one span per character, which axe skips as too short to judge. The table under each theme gives the lowest mix that would pass; for plain text it is 46–77%. Keywords and strings need 50–96%. Comments need 75–100%, and in three themes no mix passes, because the comment colour fails even at full strength. The character at the caret (55%) and auto-inserted text (60%) also fall short in both light themes and One Dark Pro.',
  },
  {
    severity: 'critical',
    title: 'The focus ring is too faint in seven themes',
    body: 'Focus is drawn as <code>ring-ring/50</code> (shadcn\'s default: the ring colour at half strength), 1.9–2.95:1 against the page or dialog, where 1.4.11 asks 3:1. Keyboard players (rule A2) rely on it to see where they are. Drawn at full strength, the same ring passes in every theme: from 3.9:1 (Syntype Light, on the page) to 16:1 (Green Phosphor).',
  },
  {
    severity: 'major',
    title: 'Text-field borders fade into the page',
    body: 'Inputs are outlined with <code>--input</code>, 1.15–2.1:1 against the page in eight themes (Dark High Contrast passes). WCAG 1.4.11 asks 3:1 for the boundary that shows where a field is, unless the field is identifiable another way. The search fields in the pickers and the name field qualify, since each has a visible label and placeholder; the account and admin fields are less clear. This is a common shadcn trade-off. Fixing it means a darker <code>--input</code> per theme, not a component change.',
  },
  {
    severity: 'major',
    title: 'Comments are below AA in three themes, and rule T3 allows it',
    body: 'Syntype Light (3.11), Syntype Dark (3.38) and One Dark Pro (3.73) draw comments below 4.5:1. T3 sets comments at 2.5:1 and code colours at 4:1, both below WCAG\'s 4.5:1 for text of this size. Comments are code the player types, so they count as content. Suggest raising T3 to WCAG\'s own thresholds: 4.5:1 for all text, 3:1 for large text and non-text.',
  },
  {
    severity: 'major',
    title: "Syntype Light's orange doesn't reach AA as text",
    body: 'The brand orange <code>#c25a08</code> is 3.87:1 on the page and 4.41:1 on white, and white labels on it are also 4.41:1. Its role is used for links, the selected nav label and button labels. A step darker on the same Syntype orange scale would pass everywhere.',
  },
  {
    severity: 'major',
    title: 'What only the browser found',
    body: 'The in-browser pass found pairs the role list hadn\'t written down, mostly where a translucent tint sits behind text. <b>The suggestion list\'s detail text on the highlighted row</b> (3.73:1 in Syntype Dark; now added to the role pairs). <b>Destructive badges and buttons on their hover tint</b> (3.32:1 in One Dark Pro, about 4.3–4.5:1 in Syntype Light, Syntype Dark and Tritanopia). <b>Inactive admin tabs</b> (4.16–4.17:1 in the light themes). <b>Muted text on the highlighted \'you\' and reported rows</b> (3.78–4.08:1 in Syntype Dark). <b>The ad placeholder\'s size label</b> (3.3–4.5:1, until real ads replace it). Syntype Light\'s selected length chip (3.72:1) appears on every typing screen, 79 times in this run.',
  },
  {
    severity: 'minor',
    title: 'Line numbers, near misses, and the aid tags that are off',
    body: 'Line numbers in the gutter are 2.2–3.4:1. They are hidden from assistive tech, but sighted players still read them, and WCAG\'s exemption is for decoration, not <code>aria-hidden</code>, so they count. Several pairs land within 10% of 4.5:1: success and error text in Syntype Light, error text in One Dark Pro\'s dialogs, and the destructive button labels. Typing-aid tags that are off are drawn at half the muted colour (2.0–3.0:1). They are struck through and spelled out for screen readers, but sighted players still need to read them.',
  },
]

const NOTES: Record<string, string[]> = {
  light: [
    'The theme with the most failures (21 of its role pairs). The cause is one decision: the page sits on a pale grey (<code>#eef0f4</code>), so every colour that passes on white cards loses about 12% on the page itself.',
    "The brand orange, success green and error red all sit just under 4.5:1. A step darker on each scale would fix all three without changing the theme's character.",
    'Comments at 3.11:1 are the clearest single fix in the editor. Untyped code is the faintest of any theme (1.4–2.1:1), because dimming toward white leaves light pastels. The character at the caret (3.69:1) and auto-inserted text (4.28:1) miss too.',
  ],
  dark: [
    'Mostly sound: body text, primary orange and every code colour except comments pass, most with room.',
    'Comments (3.38:1) and untyped code are the editor issues. The suggestion list\'s detail text on the highlighted row is 3.74:1, and the focus ring misses only inside dialogs (2.95:1).',
  ],
  'hc-black': [
    'As expected of a high-contrast theme, nearly everything passes at AAA. The exceptions come from shared styling, not from its palette: the half-strength focus ring, untyped code and the aid tags.',
    "Its input borders pass (it is the only theme whose border is a bright outline), which shows the fix for the other themes.",
  ],
  'one-dark-pro': [
    "Borrowed palettes are where WCAG and faithfulness pull apart. One Dark Pro's own comment grey (<code>#7f848e</code>) is 3.73:1 and its red is 4.38:1 on the editor, so a faithful port inherits both.",
    'Following the rule for borrowed palettes, the fixes would come from colours One Dark Pro already uses elsewhere (its brighter foreground greys and status bar colours), not new ones.',
    'Mistakes on their tint (3.97:1) are underlined too, so the mistake is still marked by more than colour, but the character itself is hard to read.',
    'Its foreground is dimmer than the other dark themes\' (<code>#abb2bf</code>), so the character at the caret (3.06:1) and auto-inserted text (3.34:1) also fall short.',
  ],
  'github-light': [
    'Primer Light is designed for AA, and it shows: every role used as text passes except the destructive button label (4.31:1), which comes from our 10% tint behind it rather than from Primer.',
    'The other failures are the shared ones: untyped code, the character at the caret and auto-inserted text (drawn at 55% and 60%, 3.65 and 4.24:1), input borders and the half-strength focus ring.',
  ],
  protanopia: [
    'All text and code colours pass with large margins, both as normal vision sees them and as simulated for protanopia; the failures are only the shared ones.',
    "Its colour difference is the issue (see the colour vision section): function purple and success blue are only 4.5 ΔE apart as its audience sees them, so a finished run's success colour can look like a function name.",
  ],
  deuteranopia: [
    'Contrast is as good as Protanopia\'s, with the same shared failures.',
    'Keyword blue (<code>#4da0ff</code>) and success blue (<code>#58a6ff</code>) are 2 ΔE apart, nearly identical even with normal vision. T4 doesn\'t compare success with code colours, so the test passes.',
  ],
  tritanopia: [
    'Contrast is as good as Protanopia\'s, with the same shared failures.',
    'The best-separated of the three as simulated, though string and success are only 11 ΔE apart. The tritan simulation is the least reliable of the three, so this theme needs a real tritanope to check it.',
  ],
  phosphor: [
    "A single-hue theme. Every colour is a shade of green, so the code colours are told apart by lightness alone, and that's what is left when the untyped code is dimmed: 1.7–2.7:1.",
    "Its input border (a dark green) is the other failure. As a deliberately stylised theme, it doesn't need an exemption: untyped code passes from about 50% mix, and comments from 88%.",
  ],
}

// ——— Colour maths for the report ———
const toHex = (rgb: number[]) => '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')
const seenHex = (hex: string, v?: Deficiency) => toHex(seen(hex, v))
const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const over = (fg: string, a: number, bg: string) => '#' + parse(fg).map((c, i) => Math.round(c * a + parse(bg)[i] * (1 - a)).toString(16).padStart(2, '0')).join('')
/** The smallest mix (in whole percent) at which a colour dimmed over the card still reads at 4.5:1. */
function minMix(fg: string, card: string) {
  for (let p = 1; p <= 100; p++) if (contrast(over(fg, p / 100, card), card) >= 4.5) return p
  return null
}

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
    ? `<table class="pt"><thead><tr><th></th><th>Text axe found below AA</th><th class="num">Ratio</th><th class="num">Needs</th><th class="num">Elements</th></tr></thead><tbody>${fails
        .map(
          (f) =>
            `<tr><td class="s"><span class="sample" style="background:${f.bg};color:${f.fg}">Aa</span></td><td>${f.examples.map((e) => `“${esc(e.text || '…')}” <span class="where">${esc(e.state)}</span>`).join('<br>')}<div class="hex"><code>${f.fg}</code> on <code>${f.bg}</code> · ${esc(f.size)} ${esc(f.weight)}</div></td><td class="num">${f.ratio.toFixed(2)}</td><td class="num">${f.need}:1</td><td class="num">${f.count}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : `<p><span class="pill pass"><i aria-hidden="true">✓</i>No text below AA</span> that axe could measure.</p>`
  return `<p class="stat-line"><b>${elements.toLocaleString('en')}</b> text elements measured in the browser, <b>${p.pairs.length}</b> distinct colour pairs, <b>${fails.length}</b> below AA. axe couldn't judge <b>${reviews.toLocaleString('en')}</b> elements (${p.reviews.map((r) => `${esc(r.why)}: ${r.count}`).join(', ') || 'none'}); the editor's code is among them, which is why the role pairs above cover it.</p>${list}`
}

function mixTable(t: Theme) {
  const card = t.roles.card
  const items = [['Plain code', t.roles.foreground], ['Keyword', t.roles['code-keyword']], ['String', t.roles['code-string']], ['Comment', t.roles['code-comment']]] as const
  return `<div class="mix"><span class="mix-label">Lowest mix that reads at 4.5:1 (now 34%):</span>${items
    .map(([n, hex]) => {
      const m = minMix(hex, card)
      return `<span class="mix-item"><span class="dot" style="background:${hex}"></span>${n} <b>${m ? m + '%' : 'none'}</b></span>`
    })
    .join('')}</div>`
}

function themeSection(t: Theme) {
  const vision = ['protanopia', 'deuteranopia', 'tritanopia'].includes(t.id)
  const counted = t.rows.filter((r) => r.status !== 'exempt')
  const fails = counted.filter((r) => r.status === 'fail')
  const bySev = (s: Severity) => fails.filter((r) => severity(r) === s).length
  const groups = [...new Set(t.rows.map((r) => r.group))]
  const failRows = t.rows.filter((r) => r.status === 'fail').sort((a, b) => ['critical', 'major', 'minor'].indexOf(severity(a)) - ['critical', 'major', 'minor'].indexOf(severity(b)))
  return `<section class="theme" id="t-${t.id}">
<header class="theme-head" style="--tbg:${t.roles.background};--tfg:${t.roles.foreground};--tpr:${t.roles.primary}">
  <div><h2>${esc(t.name)}</h2><div class="swatches">${['background', 'card', 'foreground', 'muted-foreground', 'primary', 'destructive', 'success', 'code-keyword', 'code-string', 'code-number', 'code-function', 'code-type', 'code-comment'].map((k) => `<span title="${k} ${t.roles[k]}" style="background:${t.roles[k]}"></span>`).join('')}</div></div>
  <div class="score"><span class="big">${counted.length - fails.length}<small>/${counted.length}</small></span><span>role pairs pass</span></div>
</header>
<div class="counts">${fails.length ? `<span class="sev critical">${bySev('critical')} critical</span><span class="sev major">${bySev('major')} major</span><span class="sev minor">${bySev('minor')} minor</span>` : '<span class="pill pass"><i aria-hidden="true">✓</i>No failures</span>'}</div>
${shots(t.id)}
<div class="notes"><h3>Comments</h3>${(NOTES[t.id] ?? []).map((n) => `<p>${n}</p>`).join('')}${mixTable(t)}</div>
<h3>What fails</h3>
<div class="tw"><table><thead><tr><th></th><th>Pair</th><th class="num">Ratio</th><th class="num">Needs</th><th>Verdict</th></tr></thead><tbody>${failRows.map((r) => rowHtml(r, vision)).join('') || '<tr><td colspan="5">Nothing.</td></tr>'}</tbody></table></div>
<details><summary>Every role pair (${t.rows.length})</summary>${groups
    .map((g) => `<h4>${esc(g)}</h4><div class="tw"><table><thead><tr><th></th><th>Pair</th><th class="num">Ratio</th><th class="num">Needs</th><th>Verdict</th></tr></thead><tbody>${t.rows.filter((r) => r.group === g).map((r) => rowHtml(r, vision)).join('')}</tbody></table></div>`)
    .join('')}</details>
<h3>In the browser</h3>
${pageSummary(t.id)}
</section>`
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

function cvdSection() {
  const out: string[] = []
  for (const v of ['protanopia', 'deuteranopia', 'tritanopia'] as Deficiency[]) {
    const a = CVD_ABOUT[v]
    const today = cvd.today.find((x: any) => x.vision === v)
    const sug = cvd.suggestions.find((x: any) => x.vision === v && x.keepSignals)
    const free = cvd.suggestions.find((x: any) => x.vision === v && !x.keepSignals)
    const now = { keyword: today.colours['code-keyword'], string: today.colours['code-string'], number: today.colours['code-number'], function: today.colours['code-function'], type: today.colours['code-type'], comment: today.colours['code-comment'], mistake: today.colours.destructive, success: today.colours.success }
    const pick = (s: any) => ({ ...Object.fromEntries(Object.entries(s.colours).map(([k, c]: [string, any]) => [k, c.hex])), comment: cvd.comment })
    const proposed = pick(sug)
    const closest = today.closest.slice(0, 3).map((c: any) => `${c.a.replace('code-', '')} / ${c.b.replace('code-', '')} <b class="${c.seen < 12 ? 'low' : ''}">${c.seen}</b>`).join(' · ')
    out.push(`<article class="cvd" id="cvd-${v}">
<h3>${v[0].toUpperCase() + v.slice(1)}</h3>
<dl class="facts"><div><dt>What's missing</dt><dd>${a.cone}</dd></div><div><dt>What merges</dt><dd>${a.sees}</dd></div><div><dt>What survives</dt><dd>${a.keeps}</dd></div><div><dt>Who</dt><dd>${a.who}</dd></div></dl>
<p><b>Advice.</b> ${a.advice}</p>
<div class="compare">
  <div><h4>Today, as normal vision sees it</h4>${codeLine(now)}${strip(now)}</div>
  <div><h4>Today, as simulated for ${v}</h4>${codeLine(now, v)}${strip(now, v)}<p class="small">Closest pairs (ΔE, as seen): ${closest}</p></div>
  <div><h4>Suggested, as normal vision sees it</h4>${codeLine(proposed)}${strip(proposed)}</div>
  <div><h4>Suggested, as simulated for ${v}</h4>${codeLine(proposed, v)}${strip(proposed, v)}<p class="small">Smallest difference ${sug.minDifference.seen} ΔE as seen, ${sug.minDifference.normal} with normal vision; mistake vs success ${sug.mistakeVsSuccess}.${sug.minDifference.seen < 12 ? ` That is just under T4's 12, and it now counts success against every code colour, which T4 doesn't. Today's theme scores ${today.closest[0].seen} on the same measure.` : ` Today's theme scores ${today.closest[0].seen} on the same measure.`}</p></div>
</div>
<div class="tw"><table class="sug"><thead><tr><th>Role</th><th>Suggested</th><th>Primer token</th><th class="num">On editor</th><th class="num">As seen</th></tr></thead><tbody>${Object.entries(sug.colours)
      .map(([k, c]: [string, any]) => `<tr><td>${k}</td><td><span class="dot" style="background:${c.hex}"></span><code>${c.hex}</code></td><td><code>${c.primer.startsWith('#') ? (k === 'mistake' || k === 'success' ? (v === 'tritanopia' ? 'dark-tritanopia' : 'dark-colorblind') + ' fgColor-' + (k === 'mistake' ? 'danger' : 'success') : c.primer) : 'display-' + c.primer}</code></td><td class="num">${c.contrast.toFixed(2)}</td><td class="num">${c.seen.toFixed(2)}</td></tr>`)
      .join('')}</tbody></table></div>
<p class="small">An alternative that also picks mistake and success freely reaches ${free.minDifference.seen} ΔE as seen, but it gives up the danger-orange / success-blue convention players know from GitHub's own colour-blind themes, so it's listed in <code>cvd.json</code> rather than suggested.</p>
</article>`)
  }
  const refs = cvd.references
    .map((r: any) => `<tr><td><b>${esc(r.name)}</b><div class="strip">${Object.entries(r.colours).map(([k, hex]) => `<span class="chip"><span class="sw" style="background:${hex}"></span><span class="k">${esc(k)}</span></span>`).join('')}</div></td>${['normal', 'protanopia', 'deuteranopia', 'tritanopia'].map((v) => `<td class="num">${r.minSeen[v].seen}</td>`).join('')}</tr>`)
    .join('')
  return `<section id="cvd" class="cvd-wrap">
<h2>Colour vision</h2>
<p class="lede">How the three deficiencies work, how today's vision themes look to the people they're for, and a palette suggestion for each. The simulation is Machado, Oliveira &amp; Fernandes (2009) at full severity, the same model the T4 test uses. Differences are CIEDE2000 (ΔE): about 2 is barely visible side by side, and 12 is the floor T4 sets for colours a player must tell apart while typing.</p>
<h3>Findings on today's three themes</h3>
<ul class="findings">
<li><span class="sev major">Major</span> <b>Deuteranopia:</b> keyword blue and success blue are <b>2.0 ΔE</b> apart, the same colour to anyone. T4 checks mistakes against success, but not success against the code colours, so it passes.</li>
<li><span class="sev major">Major</span> <b>Protanopia:</b> function purple and success blue are <b>4.5 ΔE</b> apart as seen, because protanopes see purple as blue.</li>
<li><span class="sev minor">Minor</span> <b>Tritanopia:</b> string and success are 11.1 ΔE apart and type and success 11.7, just under 12.</li>
<li><span class="pill pass"><i aria-hidden="true">✓</i>Good</span> In all three, every text and code colour reads at 4.5:1 or more, both with normal vision and as simulated, and mistakes and success are more than 30 ΔE apart.</li>
</ul>
<h3>Reference palettes, scored the same way</h3>
<p>The smallest difference between any two colours in each palette, as each group sees it. These palettes were designed for colour vision deficiency, and still drop near or below 12 for some groups: seven or more colours that all stay apart for every deficiency is about the limit. That's why a theme per deficiency, as Syntype has, beats one shared colour-blind theme.</p>
<div class="tw"><table class="refs"><thead><tr><th>Palette</th><th class="num">Normal</th><th class="num">Protan</th><th class="num">Deutan</th><th class="num">Tritan</th></tr></thead><tbody>${refs}</tbody></table></div>
<h3>How the suggestions were found</h3>
<p><code>scripts/design/cvd-study.ts</code> keeps mistake and success as GitHub's colour-blind themes have them (rule T5 keeps these themes on Primer's palette). From Primer's dark display scales, it keeps only colours that read at 4.5:1 on the editor both with normal vision and as simulated. It then chooses the five code colours that keep the closest pair of all nine (foreground, comment, the five code colours, mistake, success) as far apart as possible, for normal vision and the simulation at once. These are starting points for a design pass, not finished themes: the search optimises distance, not taste.</p>
${out.join('\n')}
</section>`
}

// ——— Page ———
mkdirSync(join(OUT, 'shots'), { recursive: true })
const totals = themes.map((t) => {
  const c = t.rows.filter((r) => r.status !== 'exempt')
  return { t, pass: c.filter((r) => r.status === 'pass').length, total: c.length, crit: c.filter((r) => r.status === 'fail' && severity(r) === 'critical').length, major: c.filter((r) => r.status === 'fail' && severity(r) === 'major').length, minor: c.filter((r) => r.status === 'fail' && severity(r) === 'minor').length }
})
const css = readFileSync(new URL('./contrast-report.css', import.meta.url), 'utf8')
const html = `<title>Syntype Contrast Round</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${css}</style>
<div class="wrap">
<header class="top">
  <p class="eyebrow">Accessibility · WCAG 2.2 AA · ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
  <h1>Contrast round</h1>
  <p class="lede">Every colour pair Syntype draws, measured in all nine themes against WCAG 2.2 AA, plus a study of the three colour vision themes. Analysis only: no theme has changed yet.</p>
  <div class="legend"><span class="pill pass"><i aria-hidden="true">✓</i>Pass</span><span class="pill close"><i aria-hidden="true">✓</i>Pass, within 10%</span><span class="pill fail"><i aria-hidden="true">✕</i>Fail</span><span class="pill exempt"><i aria-hidden="true">–</i>Exempt (reason given)</span><span class="sep"></span><span class="sev critical">Critical</span><span class="sev major">Major</span><span class="sev minor">Minor</span></div>
</header>

<nav class="toc" aria-label="Themes"><div class="tw"><table class="overview"><thead><tr><th>Theme</th><th class="num">Role pairs passing</th><th>Failures</th><th class="num">Browser: text below AA</th></tr></thead><tbody>${totals
  .map(({ t, pass, total, crit, major, minor }) => {
    const p = pages.find((x) => x.theme === t.id)
    return `<tr><td><a href="#t-${t.id}"><span class="tdot" style="background:${t.roles.background};border-color:${t.roles.primary}"></span>${esc(t.name)}</a>${t.wcag ? ' <span class="pill pass">AA flag</span>' : ''}</td><td class="num"><span class="ratio">${pass}/${total}</span></td><td class="fails"><span class="sev critical">${crit} critical</span><span class="sev major">${major} major</span><span class="sev minor">${minor} minor</span></td><td class="num">${p ? p.pairs.filter((x) => x.result === 'fail').length + ' pairs' : '—'}</td></tr>`
  })
  .join('')}</tbody></table></div><p class="small"><a href="#cvd">Colour vision study</a> · <a href="#method">How this was measured</a></p></nav>

<section id="findings"><h2>What matters most</h2>
<ol class="big-findings">${OVERVIEW.map((f) => `<li><span class="sev ${f.severity}">${SEV_LABEL[f.severity]}</span><h3>${f.title}</h3><p>${f.body}</p></li>`).join('')}</ol>
</section>

${themes.map(themeSection).join('\n')}

${cvdSection()}

<section id="method"><h2>How this was measured</h2>
<p>Two measurements, because each misses what the other sees. The process, thresholds and the steps for a new theme are in <code>docs/contrast-testing.md</code>; <code>npm run report:contrast</code> runs both.</p>
<ol class="steps">
<li><b>Role pairs</b> (<code>scripts/design/contrast-roles.ts</code>). Every foreground-and-background combination the app draws, written down once with where it appears, then resolved through each theme's roles and primitives. Translucent colours are composited onto their real background first. This is the only way to measure the editor (axe skips one-character spans) and non-text contrast (axe only measures text).</li>
<li><b>Pages</b> (<code>scripts/visual/contrast.ts</code>). axe's colour-contrast rule in Chromium on every screen state, theme and viewport the visual tooling walks, keeping passes as well as failures, to catch anything the role list forgot.</li>
<li><b>Colour vision</b> (<code>scripts/design/cvd-study.ts</code>). Simulation, distances and the palette search above.</li>
</ol>
<div class="tw"><table class="thr"><thead><tr><th>What</th><th>WCAG</th><th class="num">AA</th><th class="num">Syntype's T3 today</th></tr></thead><tbody>
<tr><td>Body and UI text</td><td>1.4.3</td><td class="num">4.5:1</td><td class="num">4.5:1</td></tr>
<tr><td>Large text (24px, or 18.66px bold)</td><td>1.4.3</td><td class="num">3:1</td><td class="num">—</td></tr>
<tr><td>Code colours</td><td>1.4.3</td><td class="num">4.5:1</td><td class="num"><span class="low">4:1</span></td></tr>
<tr><td>Comments</td><td>1.4.3</td><td class="num">4.5:1</td><td class="num"><span class="low">2.5:1</span></td></tr>
<tr><td>Primary used as text</td><td>1.4.3</td><td class="num">4.5:1</td><td class="num"><span class="low">3:1</span></td></tr>
<tr><td>Borders, focus, states, charts</td><td>1.4.11</td><td class="num">3:1</td><td class="num">3:1 (charts, primary)</td></tr>
</tbody></table></div>
<p class="small">Exempt by WCAG and marked as such: disabled controls and pure decoration. Text hidden from assistive tech still counts, since sighted players read it. AAA (7:1) is recorded for each pair but not required.</p>
</section>
</div>`
writeFileSync(join(OUT, 'index.html'), html)
console.log(`Wrote ${join(OUT, 'index.html')}`)
