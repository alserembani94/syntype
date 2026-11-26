import { useId } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { LabelledCheckbox, LabelledSwitch } from '@/components/composites/labelled'
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Section, State, States } from '../Section'

/** A control with a visible label beside it, naming it by id (shadcn's Aria controls put their own label inside the control). */
function Labelled({ label, children }: { label: string; children: (labelId: string) => React.ReactNode }) {
  const id = useId()
  return (
    <span className="flex items-center gap-2 text-sm">
      {children(id)}
      <span id={id}>{label}</span>
    </span>
  )
}

export function Forms() {
  const id = useId()
  return (
    <>
      <Section id="input" title="Input and input group">
        <States>
          <State label="Default, with a value, placeholder">
            <Input aria-label="Leaderboard name" defaultValue="Ada Types" />
            <Input aria-label="Find a player" placeholder="Find a player" />
          </State>
          <State label="Disabled, invalid">
            <Input aria-label="Disabled" defaultValue="Can't change this" disabled />
            <Input aria-label="Invalid" defaultValue="a" aria-invalid />
          </State>
          <State label="Input group: search with a clear button">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput aria-label="Search languages" placeholder="Search languages" defaultValue="rust" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton aria-label="Clear" size="icon-xs">
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </State>
        </States>
      </Section>

      <Section id="textarea" title="Textarea">
        <States>
          <State label="Default, placeholder">
            <Textarea aria-label="Note" placeholder="Tell the moderator what you saw" />
          </State>
          <State label="Disabled, invalid">
            <Textarea aria-label="Disabled note" defaultValue="Sent." disabled />
            <Textarea aria-label="Invalid note" defaultValue="Too long…" aria-invalid />
          </State>
        </States>
      </Section>

      <Section id="checkbox" title="Checkbox">
        <States>
          <State label="Unchecked, checked, indeterminate">
            <LabelledCheckbox label="Show me on the leaderboards" />
            <LabelledCheckbox label="Auto-close" defaultSelected />
            <LabelledCheckbox label="Some languages" isIndeterminate />
          </State>
          <State label="Disabled, invalid">
            <LabelledCheckbox label="Disabled" isDisabled />
            <LabelledCheckbox label="Disabled, checked" isDisabled defaultSelected />
            <LabelledCheckbox label="Invalid" isInvalid />
          </State>
          <State label="Bare (in a table row, named by aria-label)">
            <Checkbox aria-label="Select grace-417" />
            <Checkbox aria-label="Select LinusFast" defaultSelected />
          </State>
        </States>
      </Section>

      <Section id="radio-group" title="Radio group" note="As the report dialog uses it: each option a card, named by its title and described by its hint.">
        <States>
          <State label="Cards, one chosen">
            <RadioGroup aria-label="Reason" defaultValue="name" className="w-full max-w-sm">
              {[
                ['cheating', 'Cheating', 'The run looks automated or faked.'],
                ['name', 'Offensive name', 'The player’s name is abusive or inappropriate.'],
              ].map(([value, title, hint]) => (
                <FieldLabel key={value} htmlFor={`${id}-${value}`}>
                  <Field orientation="horizontal">
                    <RadioGroupItem value={value} id={`${id}-${value}`} aria-labelledby={`${id}-${value}-t`} aria-describedby={`${id}-${value}-h`} />
                    <FieldContent>
                      <span id={`${id}-${value}-t`} className="font-medium">
                        {title}
                      </span>
                      <FieldDescription id={`${id}-${value}-h`}>{hint}</FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          </State>
          <State label="Plain, disabled">
            <RadioGroup aria-label="Length" defaultValue="short" isDisabled className="w-auto">
              {['short', 'medium'].map((v) => (
                <Labelled key={v} label={v}>
                  {(l) => <RadioGroupItem value={v} aria-labelledby={l} />}
                </Labelled>
              ))}
            </RadioGroup>
          </State>
        </States>
      </Section>

      <Section id="switch" title="Switch">
        <States>
          <State label="Off, on, small">
            <LabelledSwitch label="Smooth caret" />
            <LabelledSwitch label="Auto-indent" defaultSelected />
            <LabelledSwitch label="Small" size="sm" defaultSelected />
          </State>
          <State label="Disabled">
            <LabelledSwitch label="Disabled" isDisabled />
            <LabelledSwitch label="Disabled, on" isDisabled defaultSelected />
          </State>
          <State label="Bare (named by aria-label)">
            <Switch aria-label="Smooth caret" />
          </State>
        </States>
      </Section>

      <Section id="slider" title="Slider" note="The replay scrubber.">
        <States>
          <State label="Default">
            <Slider aria-label="Replay position" defaultValue={40} className="max-w-sm" />
          </State>
          <State label="Disabled">
            <Slider aria-label="Replay position" defaultValue={70} isDisabled className="max-w-sm" />
          </State>
        </States>
      </Section>

      <Section id="field" title="Label and field" note="A form as Account & data and the name step build it.">
        <FieldSet className="max-w-md">
          <FieldLegend>Your name</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>Leaderboard name</FieldLabel>
              <Input id={`${id}-name`} defaultValue="Ada Types" />
              <FieldDescription>3 to 20 letters, digits, dots, dashes or underscores.</FieldDescription>
            </Field>
            <Field data-invalid>
              <FieldLabel htmlFor={`${id}-taken`}>Leaderboard name (taken)</FieldLabel>
              <Input id={`${id}-taken`} defaultValue="LinusFast" aria-invalid aria-describedby={`${id}-taken-error`} />
              <FieldError id={`${id}-taken-error`}>That name is taken.</FieldError>
            </Field>
            <Field>
              <Label htmlFor={`${id}-plain`}>Label on its own</Label>
              <Input id={`${id}-plain`} placeholder="Placeholder" />
            </Field>
          </FieldGroup>
        </FieldSet>
      </Section>
    </>
  )
}
