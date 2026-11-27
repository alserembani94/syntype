import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AIDS } from '../lib/aids'
import type { TypingAids } from '../lib/runcore'

/**
 * A run's typing aids as three small tags, struck through when off. Screen
 * readers get the aids by name ("auto-indent on, auto-close off, …") rather
 * than the tags' abbreviations.
 */
export function AidTags({ aids }: { aids: TypingAids }) {
  return (
    <span className="inline-flex gap-1">
      <span className="sr-only">{AIDS.map((x) => `${x.name} ${aids[x.id] ? 'on' : 'off'}`).join(', ')}</span>
      {AIDS.map((x) => (
        <Badge key={x.id} variant="outline" aria-hidden="true" className={cn('h-4 rounded-sm px-1 font-mono text-[0.625rem]', aids[x.id] ? 'text-muted-foreground' : 'text-muted-foreground/50 line-through')}>
          {x.short}
        </Badge>
      ))}
    </span>
  )
}
