import { AIDS } from '../lib/aids'
import type { TypingAids } from '../lib/runcore'

/** A run's typing aids as three tags, dimmed when off. */
export function AidTags({ aids }: { aids: TypingAids }) {
  return (
    <span className="aid-tags">
      {AIDS.map((x) => (
        <i key={x.id} className={aids[x.id] ? '' : 'off'} title={x.name}>
          {x.short}
        </i>
      ))}
    </span>
  )
}
