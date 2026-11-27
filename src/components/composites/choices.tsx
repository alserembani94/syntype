/**
 * Chip rows on shadcn's ToggleGroup (design system steps 10 and 12): one Tab
 * stop each, ← → inside (the toolbar pattern; src/lib/keyTarget.ts keeps the
 * app's key handler off those arrows). `Choice` picks one; `Toggles` switches
 * any number. Used by the settings row, My runs and the leaderboards.
 */
import type { ReactNode } from 'react'
import type { Key } from 'react-aria-components'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tip } from './tip'

/**
 * Selected chips in the app's highlight: shadcn's own (bg-muted) is barely visible in light
 * themes and the same as hover. Set on the same attributes as shadcn's (aria-pressed for
 * toggles, aria-checked for a choice), or its later rule wins.
 */
export const SELECTED =
  'data-selected:bg-accent data-selected:text-primary aria-pressed:bg-accent aria-pressed:text-primary aria-checked:bg-accent aria-checked:text-primary hover:data-selected:bg-accent'

export interface Option<T extends string> {
  id: T
  label: ReactNode
  /** A tooltip explaining it. */
  tip?: string
}

function Item({ id, label, tip }: Option<string>) {
  const item = (
    <ToggleGroupItem id={id} className={SELECTED}>
      {label}
    </ToggleGroupItem>
  )
  return tip ? <Tip label={tip}>{item}</Tip> : item
}

/** One of several (a length, a filter). */
export function Choice<T extends string>({ label, options, value, onChange, outline }: { label: string; options: readonly Option<T>[]; value: T; onChange: (v: T) => void; outline?: boolean }) {
  return (
    <ToggleGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      variant={outline ? 'outline' : 'default'}
      selectedKeys={[value]}
      onSelectionChange={(keys) => {
        const [next] = keys as Set<Key>
        if (next !== undefined && next !== value) onChange(next as T)
      }}
    >
      {options.map((o) => (
        <Item key={o.id} {...o} />
      ))}
    </ToggleGroup>
  )
}

/** Any number of switches (the typing aids). `onToggle` gets the one that changed. */
export function Toggles<T extends string>({ label, options, on, onToggle }: { label: string; options: readonly Option<T>[]; on: Record<T, boolean>; onToggle: (id: T) => void }) {
  return (
    <ToggleGroup
      aria-label={label}
      selectionMode="multiple"
      variant="outline"
      selectedKeys={options.filter((o) => on[o.id]).map((o) => o.id)}
      onSelectionChange={(keys) => {
        // Exactly one changes per press: the one whose state differs.
        for (const o of options) if ((keys as Set<Key>).has(o.id) !== on[o.id]) onToggle(o.id)
      }}
    >
      {options.map((o) => (
        <Item key={o.id} {...o} />
      ))}
    </ToggleGroup>
  )
}
