/**
 * The share image: a 1080 × 1080 picture of a finished run (speed, accuracy,
 * language, length, snippet, aids, date), drawn on a canvas in the player's
 * theme. Everything happens on the device; nothing is uploaded. Loaded only
 * when someone opens the share dialog, never with the typing screen.
 *
 * Colours are the theme's roles, the same pairs rule T6 holds to WCAG AA:
 * --primary and --foreground on --background for the numbers, --muted-foreground
 * for labels, --primary on --accent for the language and the badge.
 */
import { SITE_URL } from '../seo/site'

export interface ShareScore {
  wpm: number
  accuracy: number
  /** Display name, e.g. "C#". */
  language: string
  /** The language's page, e.g. "csharp" for /csharp. */
  languageId: string
  length: string
  snippet: string
  /** The typing aids that were on, by name. */
  aids: string[]
  isBest: boolean
  date: Date
}

const SIZE = 1080
const PAD = 84

const site = SITE_URL.replace(/^https?:\/\//, '')
const pageOf = (s: ShareScore) => `${site}/${s.languageId}`
const dateOf = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** The post text that goes with the image. */
export const shareText = (s: ShareScore) =>
  `${Math.round(s.wpm)} WPM at ${Math.round(s.accuracy)}% accuracy typing ${s.language} on Syntype ${SITE_URL}/${s.languageId}`

/** e.g. syntype-csharp-87wpm.png */
export const shareFileName = (s: ShareScore) => `syntype-${s.languageId}-${Math.round(s.wpm)}wpm.png`

/** What the image says, for its alt text. */
export const shareAlt = (s: ShareScore) =>
  [
    `Syntype score: ${Math.round(s.wpm)} words per minute at ${Math.round(s.accuracy)}% accuracy${s.isBest ? ', a new personal best' : ''}.`,
    `${s.language}, ${s.length}: ${s.snippet}, ${s.aids.length ? `with ${s.aids.join(', ')}` : 'with no typing aids'}.`,
    `${dateOf(s.date)}.`,
  ].join(' ')

interface Colours {
  background: string
  foreground: string
  muted: string
  primary: string
  accent: string
  border: string
  glow: { blur: number; color: string } | null
}

/** The theme's roles as the page shows them now, resolved to colours a canvas understands. */
function themeColours(from: Element = document.body): Colours {
  const probe = document.createElement('span')
  probe.style.display = 'none'
  from.append(probe)
  const role = (name: string) => {
    probe.style.color = `var(--${name})`
    return getComputedStyle(probe).color
  }
  const glow = parseGlow(getComputedStyle(from).getPropertyValue('--code-glow'), (c) => {
    probe.style.color = c
    return getComputedStyle(probe).color
  })
  const colours = {
    background: role('background'),
    foreground: role('foreground'),
    muted: role('muted-foreground'),
    primary: role('primary'),
    accent: role('accent'),
    border: role('border'),
    glow,
  }
  probe.remove()
  return colours
}

/** The first shadow of --code-glow ("0 0 18px <colour>", or none). */
function parseGlow(value: string, resolve: (c: string) => string): Colours['glow'] {
  const v = value.trim()
  if (!v || v === 'none') return null
  const m = v.match(/^(?:-?[\d.]+px\s+){2}([\d.]+)px\s+(.+?)(?:,\s*-?[\d.]+px\s|$)/)
  return m ? { blur: Number(m[1]), color: resolve(m[2]) } : null
}

const DISPLAY = '"Bricolage Grotesque", system-ui, sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, monospace'
const FONTS = [`700 64px ${DISPLAY}`, `400 32px ${MONO}`, `600 32px ${MONO}`]

/** Waits for the page's fonts, which are loaded already in all but the first seconds. */
async function loadFonts() {
  if (!document.fonts) return
  await Promise.all(FONTS.map((f) => document.fonts.load(f).catch(() => [])))
}

/** Sets a font, shrinking it until `text` fits `max` pixels. */
function fit(ctx: CanvasRenderingContext2D, weight: number, size: number, family: string, text: string, max: number) {
  let s = size
  do {
    ctx.font = `${weight} ${s}px ${family}`
    if (ctx.measureText(text).width <= max) break
    s -= 2
  } while (s > 12)
  return s
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** A label in a rounded box, centred on `cx`; returns its width. */
function chip(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, style: { fill?: string; stroke?: string; color: string }, measureOnly = false) {
  ctx.font = `600 32px ${MONO}`
  const w = ctx.measureText(text).width + 44
  if (measureOnly) return w
  const h = 58
  roundRect(ctx, cx - w / 2, y, w, h, 14)
  if (style.fill) {
    ctx.fillStyle = style.fill
    ctx.fill()
  }
  if (style.stroke) {
    ctx.strokeStyle = style.stroke
    ctx.lineWidth = 3
    ctx.stroke()
  }
  ctx.fillStyle = style.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, y + h / 2 + 1)
  return w
}

/** Draws the image onto `canvas` (resized to 1080 × 1080). */
function drawShareImage(canvas: HTMLCanvasElement, s: ShareScore, c: Colours) {
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser can’t draw images')
  const mid = SIZE / 2
  const inner = SIZE - PAD * 2

  ctx.fillStyle = c.background
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Top: the name, as in the header, and what Syntype is.
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.font = `700 60px ${DISPLAY}`
  ctx.fillStyle = c.foreground
  ctx.fillText('Syn', PAD, PAD + 46)
  const syn = ctx.measureText('Syn').width
  ctx.fillStyle = c.primary
  ctx.fillText('type', PAD + syn, PAD + 46)
  ctx.font = `400 30px ${MONO}`
  ctx.fillStyle = c.muted
  ctx.textAlign = 'right'
  ctx.fillText('typing test for code', SIZE - PAD, PAD + 40)

  // Middle: badge, the speed, accuracy, what was typed. Heights first, to centre the block.
  const wpm = String(Math.round(s.wpm))
  const blocks = { badge: s.isBest ? 58 + 40 : 0, label: 44, number: 280, acc: 96 + 28, chips: 58 + 34, file: 52, aids: 40 }
  const total = Object.values(blocks).reduce((a, b) => a + b, 0)
  let y = Math.max(PAD + 110, (SIZE - total) / 2 + 10)

  if (s.isBest) {
    chip(ctx, '★ new personal best', mid, y, { fill: c.accent, color: c.primary })
    y += blocks.badge
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `400 34px ${MONO}`
  ctx.fillStyle = c.muted
  ctx.fillText('words per minute', mid, y + 30)
  y += blocks.label

  fit(ctx, 700, 330, DISPLAY, wpm, inner)
  ctx.fillStyle = c.primary
  if (c.glow) {
    // The glow is drawn at the editor's scale; the number is ~8× larger.
    ctx.shadowColor = c.glow.color
    ctx.shadowBlur = c.glow.blur * 4
  }
  ctx.fillText(wpm, mid, y + 252)
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
  y += blocks.number

  // "98%" then " accuracy", centred together.
  const acc = `${Math.round(s.accuracy)}%`
  ctx.font = `700 96px ${DISPLAY}`
  const accW = ctx.measureText(acc).width
  ctx.font = `400 38px ${MONO}`
  const word = ' accuracy'
  const wordW = ctx.measureText(word).width
  const start = mid - (accW + wordW) / 2
  ctx.textAlign = 'left'
  ctx.font = `700 96px ${DISPLAY}`
  ctx.fillStyle = c.foreground
  ctx.fillText(acc, start, y + 84)
  ctx.font = `400 38px ${MONO}`
  ctx.fillStyle = c.muted
  ctx.fillText(word, start + accW, y + 84)
  y += blocks.acc

  // Language (highlighted) and length.
  const gap = 18
  const langW = chip(ctx, s.language, 0, 0, { color: '' }, true)
  const lenW = chip(ctx, s.length, 0, 0, { color: '' }, true)
  const left = mid - (langW + gap + lenW) / 2
  chip(ctx, s.language, left + langW / 2, y, { fill: c.accent, color: c.primary })
  chip(ctx, s.length, left + langW + gap + lenW / 2, y, { stroke: c.border, color: c.foreground })
  y += blocks.chips

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  fit(ctx, 400, 44, MONO, s.snippet, inner)
  ctx.fillStyle = c.foreground
  ctx.fillText(s.snippet, mid, y + 36)
  y += blocks.file

  const aids = s.aids.length ? s.aids.join(' · ') : 'no typing aids'
  fit(ctx, 400, 30, MONO, aids, inner)
  ctx.fillStyle = c.muted
  ctx.fillText(aids, mid, y + 32)

  // Bottom: when, and where to try it.
  ctx.font = `400 30px ${MONO}`
  ctx.fillStyle = c.muted
  ctx.textAlign = 'left'
  ctx.fillText(dateOf(s.date), PAD, SIZE - PAD)
  ctx.textAlign = 'right'
  ctx.fillText(pageOf(s), SIZE - PAD, SIZE - PAD)
}

/** The image as a PNG, plus a data: URL for the preview (the page's policy allows data: images). */
export async function renderShareImage(s: ShareScore, colours = themeColours()) {
  await loadFonts()
  const canvas = document.createElement('canvas')
  drawShareImage(canvas, s, colours)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t make the image'))), 'image/png'))
  return { blob, url: canvas.toDataURL('image/png') }
}
