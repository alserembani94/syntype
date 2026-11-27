import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    // Local edit: bg-foreground/10, not bg-muted, which matches the card in dark themes and
    // left the placeholder invisible there (design system step 12).
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-foreground/10", className)}
      {...props}
    />
  )
}

export { Skeleton }
