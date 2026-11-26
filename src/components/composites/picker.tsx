/**
 * The searchable, sectioned picker (languages, themes): shadcn's Command
 * (React Aria's Autocomplete over a Menu) in a Dialog. Typing filters across
 * sections; ↑ ↓ move between rows, skipping headings; Enter chooses; Esc or a
 * click outside closes. Design system step 8; wired into the app in step 11.
 *
 * Live preview: React Aria highlights rows with virtual focus (the caret stays
 * in the search box), so the highlighted row is read from each row's
 * isFocused render prop and reported through onActive. Hovering doesn't move
 * that highlight, so a hovered row (isHovered) is reported too: the preview
 * follows whichever the person touched last, keyboard or pointer.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface PickerProps<T> {
  /** The dialog's title, read by screen readers ("Choose a language"). */
  label: string
  placeholder: string
  items: T[]
  /** Section headings in display order; items are grouped under them. */
  sections: readonly string[]
  sectionOf: (item: T) => string
  idOf: (item: T) => string
  /** The text a row is searched by (its name, plus any aliases). */
  textOf: (item: T) => string
  currentId: string
  renderItem: (item: T) => ReactNode
  /** Called as the highlighted row changes, by keyboard or pointer (the theme picker's live preview). */
  onActive?: (item: T) => void
  onSelect: (id: string) => void
  onClose: () => void
  empty: ReactNode
  /** Controls under the list (the theme picker's caret switch). */
  footer?: ReactNode
}

/** Reports its row when React Aria marks it focused (virtual focus). */
function ActiveReporter({ focused, onFocused }: { focused: boolean; onFocused: () => void }) {
  const latest = useRef(onFocused)
  useEffect(() => {
    latest.current = onFocused
  })
  useEffect(() => {
    if (focused) latest.current()
  }, [focused])
  return null
}

export function Picker<T>({ label, placeholder, items, sections, sectionOf, idOf, textOf, currentId, renderItem, onActive, onSelect, onClose, empty, footer }: PickerProps<T>) {
  const groups = sections.map((section) => ({ section, list: items.filter((i) => sectionOf(i) === section) })).filter((g) => g.list.length)
  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()} showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-md">
      <DialogHeader className="sr-only">
        <DialogTitle>{label}</DialogTitle>
      </DialogHeader>
      <Command>
        <CommandInput placeholder={placeholder} />
        <CommandList
          aria-label={label}
          selectionMode="single"
          selectedKeys={[currentId]}
          onAction={(key) => onSelect(String(key))}
          renderEmptyState={() => <CommandEmpty>{empty}</CommandEmpty>}
        >
          {groups.map(({ section, list }) => (
            <CommandGroup key={section} id={section} heading={section} aria-label={section}>
              {list.map((item) => (
                <CommandItem key={idOf(item)} id={idOf(item)} textValue={textOf(item)}>
                  {({ isFocused, isHovered }) => (
                    <>
                      <ActiveReporter focused={isFocused || isHovered} onFocused={() => onActive?.(item)} />
                      {renderItem(item)}
                    </>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
      {footer && <div className="border-t border-border p-2">{footer}</div>}
    </Dialog>
  )
}
