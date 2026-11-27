/**
 * A native HTML table in the system's style (design system step 12), for My
 * runs and the leaderboards. shadcn's Table on the Aria base is React Aria's
 * interactive grid; these tables are read, not operated, so they stay real
 * tables: screen readers get table navigation, and Tab reaches each row's own
 * link or button. Classes follow shadcn's Nova table.
 *
 * A row can also open on a click anywhere in it (`onOpen`): a convenience for
 * the pointer only. The keyboard uses the row's own link, so the row itself
 * is never a Tab stop.
 */
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function DataTable({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
}

export function DataTableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />
}

export function DataTableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

export function DataTableRow({ className, onOpen, ...props }: ComponentProps<'tr'> & { onOpen?: () => void }) {
  return (
    <tr
      data-slot="table-row"
      className={cn('border-b transition-colors', onOpen && 'cursor-pointer hover:bg-muted/50', className)}
      onClick={
        onOpen &&
        ((e) => {
          // A click on the row's own controls is theirs.
          if (!(e.target instanceof Element) || !e.target.closest('a, button, [role="button"], [role="link"]')) onOpen()
        })
      }
      {...props}
    />
  )
}

/** A column heading; `numeric` right-aligns it over its figures. */
export function DataTableHead({ className, numeric, ...props }: ComponentProps<'th'> & { numeric?: boolean }) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn('h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground', numeric && 'text-right', className)}
      {...props}
    />
  )
}

/** A cell; `numeric` right-aligns it in tabular figures. */
export function DataTableCell({ className, numeric, ...props }: ComponentProps<'td'> & { numeric?: boolean }) {
  return <td data-slot="table-cell" className={cn('px-3 py-2 align-middle whitespace-nowrap', numeric && 'text-right tabular-nums', className)} {...props} />
}
