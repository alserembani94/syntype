import { useMemo } from 'react'
import type { Run } from '../lib/engine'
import type { HighlightRules } from '../languages'
import { tokenize } from '../lib/tokenize'

const show = (ch: string | undefined) => (ch === '\n' ? '↵' : ch === ' ' ? '␣' : ch)

/** The snippet as it ended: mistakes left in, suggested and auto-inserted text marked. */
export function Review({ run, highlight }: { run: Run; highlight: HighlightRules }) {
  const classes = useMemo(() => tokenize(run.chars.join(''), highlight), [run.chars, highlight])
  return (
    <div className="review">
      <div className="review-legend">
        <span>
          <i className="r-bad">a</i> mistake
        </span>
        <span>
          <i className="r-sug">a</i> from a suggestion
        </span>
        <span>
          <i className="r-auto">a</i> auto-inserted
        </span>
      </div>
      <pre className="review-code">
        {run.chars.map((ch, i) => {
          const s = run.states[i]
          if (s === 'bad') {
            return (
              <span key={i} className="r-bad" title={`expected ${show(ch)}, typed ${show(run.typed[i])}`}>
                {ch === '\n' ? '↵\n' : ch === ' ' ? '·' : ch}
              </span>
            )
          }
          const cls = s === 'auto' || s === 'skipped' ? 'r-auto' : run.completed[i] ? `r-sug ${classes[i]}` : classes[i]
          return (
            <span key={i} className={cls || undefined}>
              {ch}
            </span>
          )
        })}
      </pre>
    </div>
  )
}
