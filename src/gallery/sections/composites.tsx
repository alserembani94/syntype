import { useState } from 'react'
import { FlagIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccountMenu } from '@/components/composites/account-menu'
import { Choice, Toggles } from '@/components/composites/choices'
import { Crumbs } from '@/components/composites/crumbs'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '@/components/composites/data-table'
import { Picker } from '@/components/composites/picker'
import { ReportDialog } from '@/components/composites/report-dialog'
import { Toaster } from '@/components/composites/toast'
import { Tip } from '@/components/composites/tip'
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

function ChoiceRows() {
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium')
  const [aids, setAids] = useState({ autoIndent: true, autoClose: false, autocomplete: true })
  return (
    <>
      <Choice label="Length" options={(['short', 'medium', 'long'] as const).map((id) => ({ id, label: id }))} value={length} onChange={setLength} />
      <Toggles
        label="Typing aids"
        options={[
          { id: 'autoIndent', label: 'auto-indent', tip: 'Skip leading spaces after Enter' },
          { id: 'autoClose', label: 'auto-close' },
          { id: 'autocomplete', label: 'autocomplete' },
        ]}
        on={aids}
        onToggle={(id) => setAids((a) => ({ ...a, [id]: !a[id] }))}
      />
    </>
  )
}

const BOARD = [
  { rank: 1, name: 'grace-h27', wpm: 214, accuracy: 99 },
  { rank: 2, name: 'LinusFast', wpm: 208, accuracy: 97 },
  { rank: 3, name: 'margaret_h', wpm: 191, accuracy: 100 },
]

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

      <Section id="tip" title="Tip" note="A tooltip with the control's keyboard shortcut as keys, replacing title. Hover or focus the buttons.">
        <State label="With shortcuts">
          <Tip label="Change language" shortcut="Ctrl+Shift+L">
            <Button variant="outline">Python</Button>
          </Tip>
          <Tip label="Theme" shortcut="Ctrl+K, then T">
            <Button variant="outline">Ctrl+K chord</Button>
          </Tip>
          <Tip label="New snippet" shortcut="⌘↩">
            <Button variant="outline">Mac keys</Button>
          </Tip>
        </State>
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
        <AccountMenu name="Ada Types" provider="GitHub" trigger={<>Ada Types<span className="sr-only">, account</span></>} onAction={() => {}} />
      </Section>

      <Section id="picker" title="Picker" note="The language picker. The theme picker at the top of the page is the same composite, with live preview.">
        <States>
          <State label="Open it">
            <LanguagePicker />
          </State>
        </States>
      </Section>

      <Section id="choices" title="Choices and toggles" note="One Tab stop each; ← → move inside, Space or Enter chooses. A choice picks one; toggles switch any number.">
        <State label="Length and typing aids">
          <ChoiceRows />
        </State>
      </Section>

      <Section id="crumbs" title="Crumbs" note="Where a view sits; the parts you can go back to are links.">
        <Crumbs trail={[{ label: 'My runs', onPress: () => {} }, { label: 'Python' }, { label: 'short' }]} current="clamp.py" />
      </Section>

      <Section id="data-table" title="Data table" note="A native table: screen readers get table navigation; each row's own link is the keyboard's way in, and a click anywhere on the row opens it.">
        <DataTable>
          <DataTableHeader>
            <tr>
              <DataTableHead numeric>#</DataTableHead>
              <DataTableHead>Player</DataTableHead>
              <DataTableHead numeric>WPM</DataTableHead>
              <DataTableHead numeric>Accuracy</DataTableHead>
              <DataTableHead>
                <span className="sr-only">Open</span>
              </DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {BOARD.map((r) => (
              <DataTableRow key={r.rank} onOpen={() => {}}>
                <DataTableCell numeric className="text-muted-foreground">
                  {r.rank}
                </DataTableCell>
                <DataTableCell className="font-mono">{r.name}</DataTableCell>
                <DataTableCell numeric className="font-display font-bold text-primary">
                  {r.wpm}
                </DataTableCell>
                <DataTableCell numeric>{r.accuracy}%</DataTableCell>
                <DataTableCell className="text-right">
                  <Button variant="link" size="sm" className="h-auto p-0" aria-label={`Replay ${r.name}’s run`}>
                    replay
                  </Button>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </Section>
    </>
  )
}
