import { useState } from 'react'
import { FlagIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccountMenu } from '@/components/composites/account-menu'
import { Picker } from '@/components/composites/picker'
import { ReportDialog } from '@/components/composites/report-dialog'
import { Toaster } from '@/components/composites/toast'
import { useToast } from '@/components/composites/use-toast'
import { LANGUAGE_SECTIONS, SAMPLE_LANGUAGES } from '../sample'
import { Section, State, States } from '../Section'

function ToastButtons() {
  const toast = useToast()
  return (
    <>
      <Button variant="outline" onPress={() => toast.show('Thanks. The report was sent to the moderator.')}>
        Show a confirmation
      </Button>
      <Button variant="outline" onPress={() => toast.show('That sign-in took too long or was started in another tab. Please try again.', { tone: 'error' })}>
        Show an error
      </Button>
    </>
  )
}

function LanguagePicker() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('python')
  const name = SAMPLE_LANGUAGES.find((l) => l.id === current)?.name
  return (
    <>
      <Button variant="outline" onPress={() => setOpen(true)}>
        {name}
      </Button>
      {open && (
        <Picker
          label="Choose a language"
          placeholder="Search languages"
          items={SAMPLE_LANGUAGES}
          sections={LANGUAGE_SECTIONS}
          sectionOf={(l) => l.section}
          idOf={(l) => l.id}
          textOf={(l) => `${l.name} ${l.aliases ?? ''}`}
          currentId={current}
          renderItem={(l) => l.name}
          onSelect={(id) => (setCurrent(id), setOpen(false))}
          onClose={() => setOpen(false)}
          empty="No language matches."
        />
      )}
    </>
  )
}

export function Composites() {
  return (
    <>
      <Section id="toast" title="Toast" note="Confirmations hide after 6 s (not while hovered or focused); errors stay until dismissed. Each is announced to screen readers.">
        <Toaster>
          <State label="Show one">
            <ToastButtons />
          </State>
        </Toaster>
      </Section>

      <Section id="report-dialog" title="Report dialog" note="Sending fails on purpose here, to show the error.">
        <ReportDialog
          playerName="LinusFast"
          trigger={
            <Button size="icon-sm" variant="ghost" aria-label="Report LinusFast">
              <FlagIcon />
            </Button>
          }
          onSend={async () => 'You can send 5 reports an hour. Try again later.'}
          onSent={() => {}}
        />
      </Section>

      <Section id="account-menu" title="Account menu">
        <AccountMenu name="Ada Types" provider="GitHub" trigger="Ada Types" triggerLabel="Account: Ada Types" onAction={() => {}} />
      </Section>

      <Section id="picker" title="Picker" note="The language picker. The theme picker at the top of the page is the same composite, with live preview.">
        <States>
          <State label="Open it">
            <LanguagePicker />
          </State>
        </States>
      </Section>
    </>
  )
}
