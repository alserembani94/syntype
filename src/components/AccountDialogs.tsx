/**
 * The account's dialogs: sign in and the leaderboard name (Account & data has
 * its own module). Loaded when one first opens (design system step 11).
 */
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { nameHint, saveName, signIn, type Player } from '../lib/account'
import { POLICY_LINKS } from '../seo/policyLinks'

/**
 * A modal dialog for the account: shadcn's Dialog, titled, with a close
 * button. React Aria contains focus, closes on Esc or a click outside, hides
 * the page behind from assistive tech and returns focus when it closes. On
 * phones it sits at the top, above the on-screen keyboard its fields open.
 */
export function AccountDialog({ title, description, onClose, children, className }: { title: string; description?: ReactNode; onClose: () => void; children: ReactNode; className?: string }) {
  return (
    <Dialog isOpen onOpenChange={(o) => !o && onClose()} className={cn('max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md max-sm:top-[max(1rem,env(safe-area-inset-top))] max-sm:translate-y-0', className)}>
      <DialogHeader>
        <DialogTitle className="pr-6 font-display text-lg">{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      {children}
    </Dialog>
  )
}

const GITHUB_ICON = 'M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5z'

export function SignInDialog({ onClose }: { onClose: () => void }) {
  return (
    <AccountDialog title="Sign in to Syntype" description="To put your runs on the leaderboards. Only your public profile is used: no email, and nothing is posted anywhere." onClose={onClose}>
      <div className="grid gap-2">
        <Button variant="outline" size="lg" autoFocus onPress={() => signIn('github')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={GITHUB_ICON} fill="currentColor" />
          </svg>
          Continue with GitHub
        </Button>
        <Button variant="outline" size="lg" onPress={() => signIn('google')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" fill="#4285F4" />
            <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
            <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14z" fill="#FBBC05" />
            <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 5.9 12 5.9z" fill="#EA4335" />
          </svg>
          Continue with Google
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Your run history stays on this device either way.
        {POLICY_LINKS.map((l) => (
          <span key={l.path}>
            {' '}
            <a href={l.path} target="_blank" rel="noreferrer" className="text-primary">
              {l.label}
            </a>
          </span>
        ))}
      </p>
      <DialogFooter>
        <Button variant="outline" slot="close">
          Not now
        </Button>
      </DialogFooter>
    </AccountDialog>
  )
}

export function NameDialog({ player, onClose, onSaved }: { player: Player; onClose: () => void; onSaved: (p: Player) => void }) {
  const [name, setName] = useState(player.name ?? player.suggestedName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Worked out once, when the dialog opens.
  const [waitUntil] = useState(() => (player.renameAfter && Date.parse(player.renameAfter) > Date.now() ? new Date(player.renameAfter) : null))
  const hint = nameHint(name)
  const problem = !!(error || (hint && name.trim()))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hint || saving) return
    setSaving(true)
    const result = await saveName(name)
    setSaving(false)
    if ('error' in result) setError(result.error)
    else onSaved(result.player)
  }
  return (
    <AccountDialog
      title={player.name ? 'Change your name' : 'Your leaderboard name'}
      description={player.name ? 'This is the name shown next to your runs on the leaderboards.' : 'Shown next to your runs on the leaderboards. Until you confirm one, your runs aren’t submitted.'}
      onClose={onClose}
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field data-invalid={problem || undefined}>
          <FieldLabel htmlFor="name-input">Name</FieldLabel>
          <Input
            id="name-input"
            value={name}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            aria-invalid={!!(hint || error)}
            aria-describedby="name-help"
            disabled={!!waitUntil}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
          />
          <FieldDescription id="name-help" className={cn(problem && 'text-destructive')} role={error ? 'alert' : undefined}>
            {waitUntil
              ? `You can change your name again after ${waitUntil.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.`
              : (error ?? hint ?? '3–24 characters: letters, numbers, spaces, - and _. You can change it once a week.')}
          </FieldDescription>
        </Field>
        <DialogFooter>
          <Button variant="outline" slot="close">
            {player.name ? 'Cancel' : 'Later'}
          </Button>
          <Button type="submit" isDisabled={!!hint || saving || !!waitUntil}>
            {saving ? 'Saving…' : player.name ? 'Save' : 'Continue'}
          </Button>
        </DialogFooter>
      </form>
    </AccountDialog>
  )
}
