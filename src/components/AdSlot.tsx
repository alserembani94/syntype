import { cn } from '@/lib/utils'
import { AD_SLOTS, type AdSlotName } from '../lib/ads'

interface Props {
  slot: AdSlotName
  className?: string
}

/**
 * Space reserved for an ad. For now each slot shows a placeholder; the sizes
 * are fixed up front so nothing moves when real content goes in.
 */
export function AdSlot({ slot, className }: Props) {
  const { width, height } = AD_SLOTS[slot]
  return (
    <aside
      className={cn('box-border grid h-(--ad-h) w-[min(var(--ad-w),100%)] place-content-center justify-items-center gap-0.5 rounded-lg border border-dashed bg-muted text-xs text-muted-foreground select-none', slot === 'results' && 'mx-auto', className)}
      style={{ '--ad-w': `${width}px`, '--ad-h': `${height}px` } as React.CSSProperties}
      aria-label="Advertisement"
      data-ad-slot={slot}
    >
      <span className="text-2xs font-semibold tracking-wider uppercase">Ad space</span>
      <span className="font-mono text-2xs">
        {width} × {height}
      </span>
    </aside>
  )
}
