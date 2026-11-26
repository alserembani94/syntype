/**
 * A tooltip on a control, with its keyboard shortcut shown as keys
 * ("Ctrl+Shift+L" → Ctrl Shift L). Replaces `title`, which keyboard and
 * touch users never see. The control keeps its own accessible name; the tip
 * repeats it and adds the shortcut.
 */
import type { ReactElement, ReactNode } from 'react'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * shortcutText()'s strings as keys: "Ctrl+Shift+L" (one key per +), Mac's
 * "⌘⇧L" (one key per symbol), and "Ctrl+K, then T" as two chords.
 */
export function Shortcut({ keys }: { keys: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.split(/,\s*(?:then\s+)?/).map((chord, i) => (
        <KbdGroup key={i}>
          {(chord.includes('+') ? chord.split('+') : Array.from(chord)).map((k) => (
            <Kbd key={k}>{k}</Kbd>
          ))}
        </KbdGroup>
      ))}
    </span>
  )
}

export function Tip({ label, shortcut, children, placement }: { label: ReactNode; shortcut?: string; children: ReactElement; placement?: 'top' | 'bottom' }) {
  return (
    <TooltipTrigger>
      {children}
      <Tooltip placement={placement}>
        <span className="inline-flex items-center gap-2">
          {label}
          {shortcut && <Shortcut keys={shortcut} />}
        </span>
      </Tooltip>
    </TooltipTrigger>
  )
}
