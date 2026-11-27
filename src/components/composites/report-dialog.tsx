/**
 * The report dialog (design system step 8; wired in step 11): shadcn's
 * Dialog, RadioGroup, Field, Textarea, Alert and Button. Opened from the
 * `trigger` (the flag on a leaderboard row); focus starts on the first reason
 * and returns to the trigger when it closes. Send is disabled until a reason
 * is chosen; a failed send shows inside the dialog as an alert.
 */
import { useId, useState, type ReactElement } from 'react'
import { DialogTrigger } from 'react-aria-components'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type { ReportReason } from '@/lib/apiTypes'
import { REASONS } from '@/lib/reportReasons'

const NOTE_MAX = 500

export interface ReportDialogProps {
  playerName: string
  /** The button that opens the dialog (the row's flag). */
  trigger: ReactElement
  /** Sends the report; resolves to a problem to show, or null when sent. */
  onSend: (report: { reason: ReportReason; note: string }) => Promise<string | null>
  /** After a successful send, once the dialog has closed (show the thank-you toast). */
  onSent: () => void
}

export function ReportDialog({ playerName, trigger, onSend, onSent }: ReportDialogProps) {
  const [open, setOpen] = useState(false)
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      {trigger}
      <Dialog className="sm:max-w-md">{open && <ReportForm playerName={playerName} onSend={onSend} onDone={() => (setOpen(false), onSent())} />}</Dialog>
    </DialogTrigger>
  )
}

function ReportForm({ playerName, onSend, onDone }: Pick<ReportDialogProps, 'playerName' | 'onSend'> & { onDone: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const id = useId()
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!reason || sending) return
        setSending(true)
        const result = await onSend({ reason, note })
        setSending(false)
        if (result) setProblem(result)
        else onDone()
      }}
    >
      <DialogHeader>
        <DialogTitle>Report {playerName}</DialogTitle>
        <DialogDescription>The moderator looks at every report. Reports are private: the player isn’t told who sent one.</DialogDescription>
      </DialogHeader>
      <FieldSet>
        <FieldLegend variant="label">What’s wrong?</FieldLegend>
        <RadioGroup aria-label="What’s wrong?" value={reason} onChange={(v) => setReason(v as ReportReason)}>
          {REASONS.map((r, i) => (
            <FieldLabel key={r.id} htmlFor={`${id}-${r.id}`}>
              <Field orientation="horizontal">
                {/* Named by its title alone (the whole card is its label, which would add the hint), described by the hint. */}
                <RadioGroupItem value={r.id} id={`${id}-${r.id}`} autoFocus={i === 0} aria-labelledby={`${id}-${r.id}-title`} aria-describedby={`${id}-${r.id}-hint`} />
                <FieldContent>
                  <span id={`${id}-${r.id}-title`} className="font-medium">
                    {r.label}
                  </span>
                  <FieldDescription id={`${id}-${r.id}-hint`}>{r.hint}</FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </FieldSet>
      <Field>
        <FieldLabel htmlFor={`${id}-note`}>Note (optional)</FieldLabel>
        <Textarea id={`${id}-note`} value={note} maxLength={NOTE_MAX} rows={3} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {problem && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button variant="outline" slot="close">
          Cancel
        </Button>
        <Button type="submit" isDisabled={!reason || sending}>
          {sending ? 'Sending…' : 'Send report'}
        </Button>
      </DialogFooter>
    </form>
  )
}
