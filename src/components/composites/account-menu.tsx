/**
 * The account menu (design system step 8; wired in step 11): a real menu
 * anchored to the account button, from shadcn's DropdownMenu. Today's version
 * is a small modal dialog; a list of actions is a menu to assistive tech,
 * with arrow keys to move, Enter to act, and Esc returning focus to the button.
 */
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export type AccountAction = 'rename' | 'runs' | 'settings' | 'sign-out'

export interface AccountMenuProps {
  /** The player's name, and how they signed in ("GitHub"). */
  name: string
  provider: string
  /** The button's content: avatar and name. */
  trigger: ReactNode
  /** The button's accessible name ("Account: Ada Types"). */
  triggerLabel: string
  onAction: (action: AccountAction) => void
  /** The menu opened or closed (the game pauses while it's open). */
  onOpenChange?: (open: boolean) => void
  /** Classes for the button (the header's compact phone layout). */
  className?: string
}

export function AccountMenu({ name, provider, trigger, triggerLabel, onAction, onOpenChange, className }: AccountMenuProps) {
  return (
    <DropdownMenuTrigger onOpenChange={onOpenChange}>
      <Button variant="outline" aria-label={triggerLabel} className={className}>
        {trigger}
      </Button>
      <DropdownMenu placement="bottom end" className="w-56" onAction={(key) => onAction(key as AccountAction)}>
        <DropdownMenuGroup aria-label={name}>
          <DropdownMenuLabel className="grid gap-0.5 text-sm">
            <span className="font-medium text-foreground">{name}</span>
            <span className="font-normal">signed in with {provider}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem id="rename">Change name</DropdownMenuItem>
        <DropdownMenuItem id="runs">My runs</DropdownMenuItem>
        <DropdownMenuItem id="settings">Account &amp; data</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem id="sign-out">Sign out</DropdownMenuItem>
      </DropdownMenu>
    </DropdownMenuTrigger>
  )
}
