/**
 * The parts My runs and the leaderboards share (design system step 12): the
 * view's title row, the language button, summary stats, marks, notes for
 * empty and failed states, and placeholder rows while a table loads.
 */
import type { ReactNode } from 'react'
import { CodeXmlIcon } from 'lucide-react'
import { DataTable, DataTableBody, DataTableCell, DataTableRow } from '@/components/composites/data-table'
import { Tip } from '@/components/composites/tip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** A view's heading. */
export function ViewTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="m-0 font-display text-2xl font-bold tracking-tight wrap-anywhere">
      {children}
    </h2>
  )
}

/** The title (or breadcrumbs) on the left, the view's main action on the right. */
export function ViewHead({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="grid min-w-0 gap-1">{children}</div>
      {action}
    </div>
  )
}

/** The language, opening the picker: as in the settings row above the editor. */
export function LanguageButton({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Tip label="Change language">
      <Button variant="outline" aria-haspopup="dialog" onPress={onPress}>
        <CodeXmlIcon />
        {name}
      </Button>
    </Tip>
  )
}

/** One summary number in a card: what it is, the number, and a line about it. */
export function Stat({ label, value, note, plain }: { label: string; value: ReactNode; note?: ReactNode; plain?: boolean }) {
  return (
    <Card size="sm" className="min-w-0 gap-0.5 px-4">
      <span className="font-mono text-sm text-muted-foreground">{label}</span>
      <span className={cn('font-display leading-tight font-bold tabular-nums', plain ? 'text-xl text-foreground' : 'text-3xl text-primary')}>{value}</span>
      {note && <span className="text-xs text-muted-foreground wrap-anywhere">{note}</span>}
    </Card>
  )
}

/** A small mark beside a value: "best", "you", "older version". */
export function Mark({ children, tone = 'success' }: { children: ReactNode; tone?: 'success' | 'muted' }) {
  return (
    <Badge variant="outline" className={cn('ml-1.5 h-4 px-1.5 align-[2px] text-2xs', tone === 'success' ? 'border-success text-success' : 'text-muted-foreground')}>
      {children}
    </Badge>
  )
}

/** Secondary text in a cell or line. */
export function Muted({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-xs text-muted-foreground', className)}>{children}</span>
}

/** A note in place of a table: nothing yet, nothing matching, or (problem) something failed. */
export function Note({ title, children, action, problem }: { title?: string; children?: ReactNode; action?: ReactNode; problem?: boolean }) {
  return (
    <Empty className={cn('border bg-card', problem && 'border-destructive/50')} role={problem ? 'alert' : undefined}>
      <EmptyHeader>
        {title && <EmptyTitle>{title}</EmptyTitle>}
        {children && <EmptyDescription className={cn(problem && 'text-destructive')}>{children}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}

/** Placeholder rows in a table's shape while it loads, announced as loading. */
export function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <Card className="py-0" aria-busy="true" aria-label="Loading">
      <DataTable aria-hidden="true">
        <DataTableBody>
          {Array.from({ length: rows }, (_, r) => (
            <DataTableRow key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <DataTableCell key={c} className="py-3">
                  <Skeleton className={cn('h-4', c === 0 ? 'w-28' : 'w-12')} />
                </DataTableCell>
              ))}
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </Card>
  )
}
