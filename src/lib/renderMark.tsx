/**
 * Marks a region for `npm run bench:renders` (scripts/visual/renders.ts).
 * React's <Profiler> does nothing in the normal build; in the profiling build
 * the check makes (PROFILE=1), each render's time is recorded in
 * window.__renders, so the check can see which regions render while typing.
 */
import { Profiler, type ReactNode } from 'react'

type Recorded = { __renders?: [id: string, ms: number][] }

const record = (id: string, _phase: string, actualMs: number) => {
  ;((window as Recorded).__renders ??= []).push([id, actualMs])
}

export function RenderMark({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Profiler id={id} onRender={record}>
      {children}
    </Profiler>
  )
}
