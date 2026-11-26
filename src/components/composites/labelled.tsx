/**
 * A switch or checkbox with its visible label beside it (design system step
 * 10). shadcn's Aria versions put their children inside the control, which is
 * too small for text. Here the text sits beside the control, names it
 * (aria-labelledby) and toggles it when clicked, like a native label.
 */
import { useId, useState, type ReactNode } from 'react'
import type { CheckboxProps, SwitchProps } from 'react-aria-components'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface Labelled {
  label: ReactNode
  className?: string
}

/** isSelected/onChange, controlled or not, shared by the control and its label. */
function useSelected({ isSelected, defaultSelected, onChange }: { isSelected?: boolean; defaultSelected?: boolean; onChange?: (v: boolean) => void }) {
  const [own, setOwn] = useState(defaultSelected ?? false)
  const value = isSelected ?? own
  const set = (v: boolean) => {
    if (isSelected === undefined) setOwn(v)
    onChange?.(v)
  }
  return [value, set] as const
}

function Row({ id, label, disabled, onToggle, className, children }: { id: string; label: ReactNode; disabled?: boolean; onToggle: () => void; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm', disabled && 'opacity-50', className)}>
      {children}
      {/* The label's job for a pointer; keyboard and screen readers use the control itself. */}
      <span id={id} className={cn('select-none', !disabled && 'cursor-pointer')} onClick={() => !disabled && onToggle()}>
        {label}
      </span>
    </span>
  )
}

export function LabelledSwitch({ label, className, isSelected, defaultSelected, onChange, ...props }: Omit<SwitchProps, 'children' | 'className'> & Labelled & { size?: 'sm' | 'default' }) {
  const id = useId()
  const [value, set] = useSelected({ isSelected, defaultSelected, onChange })
  return (
    <Row id={id} label={label} disabled={props.isDisabled} onToggle={() => set(!value)} className={className}>
      <Switch {...props} aria-labelledby={id} isSelected={value} onChange={set} />
    </Row>
  )
}

export function LabelledCheckbox({ label, className, isSelected, defaultSelected, onChange, ...props }: Omit<CheckboxProps, 'children' | 'className'> & Labelled) {
  const id = useId()
  const [value, set] = useSelected({ isSelected, defaultSelected, onChange })
  return (
    <Row id={id} label={label} disabled={props.isDisabled} onToggle={() => set(!value)} className={className}>
      <Checkbox {...props} aria-labelledby={id} isSelected={value} onChange={set} />
    </Row>
  )
}
