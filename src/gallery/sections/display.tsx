import { ChevronsUpDownIcon, HistoryIcon, TriangleAlertIcon } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Section, State, States } from '../Section'

const ROWS = [
  { rank: 1, name: 'grace-417', wpm: 288, acc: '100%', when: 'yesterday' },
  { rank: 2, name: 'LinusFast', wpm: 278, acc: '97%', when: '2 days ago' },
  { rank: 3, name: 'margaret_h', wpm: 277, acc: '98%', when: '3 days ago' },
]

export function Navigation() {
  return (
    <>
      <Section id="tabs" title="Tabs" note="Admin's Reports / Players / Activity, and Account & data's sections.">
        <States>
          {(['default', 'line'] as const).map((variant) => (
            <State key={variant} label={variant === 'default' ? 'Default' : 'Line'}>
              <Tabs defaultSelectedKey="reports" className="w-full">
                <TabsList variant={variant} aria-label="Admin">
                  <TabsTrigger id="reports">Reports</TabsTrigger>
                  <TabsTrigger id="players">Players</TabsTrigger>
                  <TabsTrigger id="activity" isDisabled>
                    Activity
                  </TabsTrigger>
                </TabsList>
                <TabsContent id="reports" className="text-sm text-muted-foreground">
                  3 open reports.
                </TabsContent>
                <TabsContent id="players" className="text-sm text-muted-foreground">
                  Find a player.
                </TabsContent>
              </Tabs>
            </State>
          ))}
        </States>
      </Section>

      <Section id="breadcrumb" title="Breadcrumb" note="Leaderboards › Python › clamp.py.">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#breadcrumb">Leaderboards</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink href="#breadcrumb">Python</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>clamp.py</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Section>
    </>
  )
}

export function Display() {
  return (
    <>
      <Section id="card" title="Card">
        <States>
          <State label="Header, action, content, footer">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle>python · clamp.py</CardTitle>
                <CardDescription>Your best: 71 wpm, 95% accuracy</CardDescription>
                <CardAction>
                  <Badge variant="secondary">short</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="text-sm">Played 12 times. Last played yesterday.</CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">Type it again</Button>
                <Button size="sm" variant="outline">
                  Replay
                </Button>
              </CardFooter>
            </Card>
          </State>
          <State label="Small">
            <Card size="sm" className="w-full max-w-xs">
              <CardHeader>
                <CardTitle>New personal best</CardTitle>
                <CardDescription>76 wpm on retry.py</CardDescription>
              </CardHeader>
            </Card>
          </State>
        </States>
      </Section>

      <Section id="badge" title="Badge">
        <State label="Variants">
          <Badge>New personal best</Badge>
          <Badge variant="secondary">indent</Badge>
          <Badge variant="outline">close</Badge>
          <Badge variant="destructive">Cheating</Badge>
          <Badge variant="ghost">auto</Badge>
          <Badge variant="link">you</Badge>
        </State>
      </Section>

      <Section id="alert" title="Alert">
        <States>
          <State label="Default, with an action">
            <Alert>
              <HistoryIcon />
              <AlertTitle>These snippets have since changed</AlertTitle>
              <AlertDescription>Their boards are closed. Their runs and replays stay.</AlertDescription>
              <AlertAction>
                <Button size="xs" variant="outline">
                  Show
                </Button>
              </AlertAction>
            </Alert>
          </State>
          <State label="Destructive">
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>The report wasn’t sent</AlertTitle>
              <AlertDescription>You can send 5 reports an hour. Try again later.</AlertDescription>
            </Alert>
          </State>
        </States>
      </Section>

      <Section id="empty" title="Empty">
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon />
            </EmptyMedia>
            <EmptyTitle>No runs yet</EmptyTitle>
            <EmptyDescription>Finish a snippet and it shows up here, with a replay.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm">Start typing</Button>
          </EmptyContent>
        </Empty>
      </Section>

      <Section id="kbd" title="Kbd">
        <State label="Keys and combinations">
          <Kbd>Enter</Kbd>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>Enter</Kbd>
          </KbdGroup>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>Shift</Kbd>
            <Kbd>L</Kbd>
          </KbdGroup>
        </State>
      </Section>

      <Section id="separator" title="Separator">
        <div className="grid max-w-sm gap-3 text-sm">
          <p>Horizontal</p>
          <Separator />
          <div className="flex h-5 items-center gap-3">
            <span>wpm</span>
            <Separator orientation="vertical" />
            <span>accuracy</span>
            <Separator orientation="vertical" />
            <span>time</span>
          </div>
        </div>
      </Section>

      <Section id="skeleton" title="Skeleton and spinner" note="Loading a leaderboard.">
        <States>
          <State label="Skeleton rows">
            <div className="grid w-full max-w-sm gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </State>
          <State label="Spinner, alone and in a button">
            <Spinner />
            <Spinner className="size-6" />
            <Button variant="outline" isDisabled>
              <Spinner data-icon="inline-start" /> Loading
            </Button>
          </State>
        </States>
      </Section>

      <Section id="table" title="Table" note="React Aria's table with shadcn's styles. Step 12 decides between this and a native table for the leaderboards.">
        <Table aria-label="Leaderboard" className="max-w-xl">
          <TableHeader>
            <TableHead isRowHeader>#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">wpm</TableHead>
            <TableHead className="text-right">Accuracy</TableHead>
            <TableHead>When</TableHead>
          </TableHeader>
          <TableBody>
            {ROWS.map((r) => (
              <TableRow key={r.rank} id={r.rank}>
                <TableCell>{r.rank}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-right font-mono text-primary">{r.wpm}</TableCell>
                <TableCell className="text-right">{r.acc}</TableCell>
                <TableCell className="text-muted-foreground">{r.when}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section id="collapsible" title="Collapsible">
        <Collapsible className="grid max-w-sm gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Older versions (2)</span>
            {/* The trigger is itself a button: styled as one, not wrapping one. */}
            <CollapsibleTrigger className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })} aria-label="Show older versions">
              <ChevronsUpDownIcon />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="grid gap-1 text-sm text-muted-foreground">
            <p>clamp.py · changed Oct 2026</p>
            <p>retry.py · changed Sep 2026</p>
          </CollapsibleContent>
        </Collapsible>
      </Section>
    </>
  )
}
