/**
 * Where a view sits, as breadcrumbs (design system step 12): "My runs ›
 * Python › short › clamp.py". The parts you can go back to are links; the
 * last part is the current page. From shadcn's Breadcrumb (React Aria's
 * Breadcrumbs), navigating in the app rather than loading a page.
 */
import type { ReactNode } from 'react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb'

export interface Crumb {
  label: string
  /** Goes back to this level; without it the part is plain text. */
  onPress?: () => void
}

export function Crumbs({ trail, current, currentId }: { trail: Crumb[]; current: ReactNode; currentId?: string }) {
  return (
    <Breadcrumb>
      {/* m-0 p-0: the base reset gives lists their default indent back. */}
      <BreadcrumbList className="m-0 list-none p-0">
        {trail.map((c, i) => (
          <BreadcrumbItem key={i}>
            {c.onPress ? (
              <BreadcrumbLink className="cursor-pointer underline-offset-4 hover:underline" onPress={c.onPress}>
                {c.label}
              </BreadcrumbLink>
            ) : (
              <span>{c.label}</span>
            )}
          </BreadcrumbItem>
        ))}
        <BreadcrumbItem>
          <BreadcrumbPage id={currentId}>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
