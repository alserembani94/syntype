import type { Sample } from '../lib/stats'

const W = 760
const H = 220
const L = 46
const R = 40
const T = 14
const B = 28
const MAX_X_LABELS = 16

type Pt = [number, number]

/**
 * Smooth path through points without overshooting (monotone cubic,
 * Fritsch–Carlson), so a curve never dips below 0 wpm between samples.
 */
function smoothPath(pts: Pt[]): string {
  if (pts.length < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  const n = pts.length
  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0])
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1))
  }
  const t: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  t.push(m[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = t[i + 1] = 0
      continue
    }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const h = Math.hypot(a, b)
    if (h > 3) {
      t[i] = (3 / h) * a * m[i]
      t[i + 1] = (3 / h) * b * m[i]
    }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const h = dx[i] / 3
    d += `C${(x0 + h).toFixed(1)},${(y0 + t[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - t[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`
  }
  return d
}

const niceTop = (v: number) => {
  const step = v > 200 ? 100 : v > 80 ? 40 : 20
  return Math.max(step, Math.ceil(v / step) * step)
}

export function SpeedChart({ samples }: { samples: Sample[] }) {
  if (!samples.length) return null
  const end = Math.max(samples.at(-1)!.t, 1)
  const first = samples[0].t
  const top = niceTop(Math.max(...samples.map((d) => Math.max(d.wpm, d.raw))))
  const maxErr = Math.max(1, ...samples.map((d) => d.errors))
  // A single sample still gets a sensible x range.
  const x0 = samples.length > 1 ? first : 0
  // A little padding inside the plot so the first and last points clear the axes.
  const PAD = 12
  const x = (t: number) => L + PAD + ((t - x0) / (end - x0 || 1)) * (W - L - R - 2 * PAD)
  const y = (v: number) => T + (1 - v / top) * (H - T - B)
  const yErr = (e: number) => T + (1 - e / maxErr) * (H - T - B)

  const step = Math.max(1, Math.ceil(end / MAX_X_LABELS))
  const xTicks: number[] = []
  for (let s = Math.max(1, Math.ceil(x0)); s <= end + 0.01; s += step) xTicks.push(s)
  const wpmPts: Pt[] = samples.map((d) => [x(d.t), y(d.wpm)])
  const rawPts: Pt[] = samples.map((d) => [x(d.t), y(d.raw)])

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Words per minute and errors over the run">
      {[0, top / 2, top].map((v) => (
        <g key={v}>
          <line className="gridline" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text className="axis" x={L - 8} y={y(v) + 4} textAnchor="end">
            {Math.round(v)}
          </text>
        </g>
      ))}
      {[0, maxErr].map((e) => (
        <text key={e} className="axis" x={W - R + 8} y={yErr(e) + 4}>
          {e}
        </text>
      ))}
      {xTicks.map((t) => (
        <g key={t}>
          <line className="gridline faint" x1={x(t)} x2={x(t)} y1={T} y2={H - B} />
          <text className="axis" x={x(t)} y={H - 8} textAnchor="middle">
            {t}
          </text>
        </g>
      ))}
      <text className="axis title" transform={`translate(12 ${(H - B + T) / 2}) rotate(-90)`} textAnchor="middle">
        words per minute
      </text>
      <text className="axis title" transform={`translate(${W - 6} ${(H - B + T) / 2}) rotate(90)`} textAnchor="middle">
        errors
      </text>

      <path className="raw" d={smoothPath(rawPts)} />
      <path className="wpm" d={smoothPath(wpmPts)} />
      {wpmPts.map(([px, py], i) => (
        <circle key={i} className="dot" cx={px} cy={py} r={2.5} />
      ))}
      {samples.map((d, i) =>
        d.errors ? (
          <g key={i} className="er" transform={`translate(${x(d.t)} ${yErr(d.errors)})`}>
            <title>
              {d.errors} error{d.errors > 1 ? 's' : ''} in second {Math.ceil(d.t)}
            </title>
            <path d="M-3.5,-3.5L3.5,3.5M3.5,-3.5L-3.5,3.5" />
          </g>
        ) : null,
      )}
    </svg>
  )
}
