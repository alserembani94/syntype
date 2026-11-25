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
      className={`ad-slot ad-${slot}${className ? ` ${className}` : ''}`}
      style={{ '--ad-w': `${width}px`, '--ad-h': `${height}px` } as React.CSSProperties}
      aria-label="Advertisement"
      data-ad-slot={slot}
    >
      <span className="ad-label">Ad space</span>
      <span className="ad-size">
        {width} × {height}
      </span>
    </aside>
  )
}
