import type { Sample } from '../lib/stats'

const W = 640
const H = 170
const L = 34
const R = 10
const T = 10
const B = 24

export function SpeedChart({ samples }: { samples: Sample[] }) {
  if (!samples.length) return null
  const end = samples.at(-1)!.t || 1
  const top = Math.max(20, Math.ceil(Math.max(...samples.map((d) => Math.max(d.wpm, d.raw))) / 20) * 20)
  const x = (t: number) => L + (t / end) * (W - L - R)
  const y = (v: number) => T + (1 - v / top) * (H - T - B)

  const pts = [{ ...samples[0], t: 0 }, ...samples]
  const path = (k: 'wpm' | 'raw') =>
    pts.map((d, i) => `${i ? 'L' : 'M'}${x(d.t).toFixed(1)},${y(d[k]).toFixed(1)}`).join('')

  const step = end > 30 ? 10 : end > 12 ? 5 : end > 4 ? 2 : 1
  const xTicks: number[] = []
  for (let t = 0; t <= end + 0.01; t += step) xTicks.push(t)
  const last = samples.at(-1)!

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Words per minute over the run">
      {[0, top / 2, top].map((v) => (
        <g key={v}>
          <line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text className="axis" x={L - 6} y={y(v) + 4} textAnchor="end">
            {Math.round(v)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={t} className="axis" x={x(t)} y={H - 6} textAnchor="middle">
          {Math.round(t)}s
        </text>
      ))}
      <path className="area" d={`${path('wpm')}L${x(end)},${y(0)}L${x(0)},${y(0)}Z`} />
      <path className="raw" d={path('raw')} />
      <path className="wpm" d={path('wpm')} />
      {samples.map((d, i) =>
        d.errors ? (
          <circle key={i} className="er" cx={x(d.t)} cy={y(d.raw)} r={Math.min(3 + d.errors, 7)}>
            <title>
              {d.errors} error{d.errors > 1 ? 's' : ''} at {Math.round(d.t)}s
            </title>
          </circle>
        ) : null,
      )}
      <circle className="end" cx={x(last.t)} cy={y(last.wpm)} r={5} />
    </svg>
  )
}
