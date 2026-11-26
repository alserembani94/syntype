import { CopyIcon, FlagIcon, InfoIcon, LogOutIcon, SettingsIcon, TrashIcon } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import { Section, State, States } from '../Section'

const OVERLAY_NOTE = 'Open each to see it. In compare mode, each theme gets its own trigger.'

export function Overlays() {
  return (
    <>
      <Section id="dialog" title="Dialog" note={OVERLAY_NOTE}>
        <States>
          <State label="With a form, and the close button">
            <DialogTrigger>
              <Button variant="outline">Change name</Button>
              <Dialog>
                <DialogHeader>
                  <DialogTitle>Change your name</DialogTitle>
                  <DialogDescription>Shown on the leaderboards. You can change it once a week.</DialogDescription>
                </DialogHeader>
                <Input aria-label="Leaderboard name" defaultValue="Ada Types" autoFocus />
                <DialogFooter showCloseButton>
                  <Button slot="close">Save</Button>
                </DialogFooter>
              </Dialog>
            </DialogTrigger>
          </State>
          <State label="Text only, no close button">
            <DialogTrigger>
              <Button variant="outline">About Syntype</Button>
              <Dialog showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>Syntype</DialogTitle>
                  <DialogDescription>A typing test for code. Esc or a click outside closes this.</DialogDescription>
                </DialogHeader>
              </Dialog>
            </DialogTrigger>
          </State>
        </States>
      </Section>

      <Section id="alert-dialog" title="Alert dialog" note={OVERLAY_NOTE}>
        <State label="Destructive confirmation">
          <AlertDialogTrigger>
            <Button variant="destructive">Delete my account…</Button>
            <AlertDialog>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>Your name, scores and replays are removed from Syntype at once. This can’t be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep my account</AlertDialogCancel>
                <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialog>
          </AlertDialogTrigger>
        </State>
      </Section>

      <Section id="sheet" title="Sheet" note={`${OVERLAY_NOTE} On phones, the pickers open as a sheet from the bottom.`}>
        <State label="From each side">
          {(['bottom', 'right', 'left', 'top'] as const).map((side) => (
            <SheetTrigger key={side}>
              <Button variant="outline">{side}</Button>
              <Sheet side={side}>
                <SheetHeader>
                  <SheetTitle>Choose a language</SheetTitle>
                  <SheetDescription>Sheet from the {side}.</SheetDescription>
                </SheetHeader>
                <div className="px-4">
                  <Input aria-label="Search languages" placeholder="Search languages" />
                </div>
                <SheetFooter>
                  <Button slot="close" variant="outline">
                    Close
                  </Button>
                </SheetFooter>
              </Sheet>
            </SheetTrigger>
          ))}
        </State>
      </Section>

      <Section id="popover" title="Popover" note={OVERLAY_NOTE}>
        <State label="Anchored to a button">
          <PopoverTrigger>
            <Button variant="outline">
              <InfoIcon data-icon="inline-start" /> Typing aids
            </Button>
            <Popover className="w-72">
              <PopoverHeader>
                <PopoverTitle>Typing aids</PopoverTitle>
                <PopoverDescription>Runs with auto-indent, auto-close or autocomplete are ranked separately from plain typing.</PopoverDescription>
              </PopoverHeader>
            </Popover>
          </PopoverTrigger>
        </State>
      </Section>

      <Section id="tooltip" title="Tooltip" note="Hover or focus the buttons.">
        <State label="On icon buttons">
          <TooltipTrigger>
            <Button size="icon" variant="outline" aria-label="Copy run link">
              <CopyIcon />
            </Button>
            <Tooltip>Copy run link</Tooltip>
          </TooltipTrigger>
          <TooltipTrigger>
            <Button size="icon" variant="outline" aria-label="Report this run">
              <FlagIcon />
            </Button>
            <Tooltip placement="bottom">
              Report this run <Kbd>R</Kbd>
            </Tooltip>
          </TooltipTrigger>
        </State>
      </Section>

      <Section id="dropdown-menu" title="Dropdown menu" note={OVERLAY_NOTE}>
        <State label="Label, groups, shortcuts, a destructive item">
          <DropdownMenuTrigger>
            <Button variant="outline">Options</Button>
            <DropdownMenu className="w-56">
              <DropdownMenuGroup aria-label="Run">
                <DropdownMenuLabel>This run</DropdownMenuLabel>
                <DropdownMenuItem>
                  <CopyIcon /> Copy link <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <SettingsIcon /> Typing aids
                </DropdownMenuItem>
                <DropdownMenuItem isDisabled>
                  <FlagIcon /> Report (disabled)
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOutIcon /> Sign out
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive">
                <TrashIcon /> Delete run
              </DropdownMenuItem>
            </DropdownMenu>
          </DropdownMenuTrigger>
        </State>
      </Section>

      <Section id="command" title="Command" note="Inline here; the picker composite puts it in a dialog.">
        <Command className="max-w-sm rounded-xl border border-border">
          <CommandInput placeholder="Search languages" />
          <CommandList aria-label="Languages" renderEmptyState={() => <CommandEmpty>No language matches.</CommandEmpty>}>
            <CommandGroup id="web" heading="Web" aria-label="Web">
              <CommandItem id="javascript">JavaScript</CommandItem>
              <CommandItem id="typescript">
                TypeScript <CommandShortcut>ts</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandGroup id="systems" heading="Systems" aria-label="Systems">
              <CommandItem id="rust">Rust</CommandItem>
              <CommandItem id="go">Go</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </Section>
    </>
  )
}
