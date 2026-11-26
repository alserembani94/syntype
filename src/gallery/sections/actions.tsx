import { BoldIcon, ItalicIcon, PlayIcon, RotateCcwIcon, UnderlineIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Section, State, States } from '../Section'

const VARIANTS = ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'] as const

export function Actions() {
  return (
    <>
      <Section id="button" title="Button">
        <States>
          <State label="Variants">
            {VARIANTS.map((v) => (
              <Button key={v} variant={v}>
                {v[0].toUpperCase() + v.slice(1)}
              </Button>
            ))}
          </State>
          <State label="Sizes">
            <Button size="xs">Extra small</Button>
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
          </State>
          <State label="With an icon, icon only">
            <Button>
              <PlayIcon data-icon="inline-start" /> Type this snippet
            </Button>
            <Button size="icon" variant="outline" aria-label="Retry">
              <RotateCcwIcon />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Retry">
              <RotateCcwIcon />
            </Button>
          </State>
          <State label="Disabled, pending">
            <Button isDisabled>Send report</Button>
            <Button variant="outline" isDisabled>
              Cancel
            </Button>
            <Button isDisabled>
              <Spinner data-icon="inline-start" /> Sending…
            </Button>
          </State>
        </States>
      </Section>

      <Section id="toggle" title="Toggle">
        <States>
          <State label="Default and outline, off and on">
            <Toggle aria-label="Bold">
              <BoldIcon />
            </Toggle>
            <Toggle aria-label="Bold" defaultSelected>
              <BoldIcon />
            </Toggle>
            <Toggle variant="outline">auto-indent</Toggle>
            <Toggle variant="outline" defaultSelected>
              auto-close
            </Toggle>
          </State>
          <State label="Sizes, disabled">
            <Toggle size="sm">Small</Toggle>
            <Toggle size="lg">Large</Toggle>
            <Toggle isDisabled>Disabled</Toggle>
            <Toggle isDisabled defaultSelected>
              Disabled, on
            </Toggle>
          </State>
        </States>
      </Section>

      <Section id="toggle-group" title="Toggle group" note="One choice (the snippet length) or several (formatting).">
        <States>
          <State label="Single choice">
            <ToggleGroup aria-label="Snippet length" selectionMode="single" defaultSelectedKeys={['short']} disallowEmptySelection>
              <ToggleGroupItem id="short">short</ToggleGroupItem>
              <ToggleGroupItem id="medium">medium</ToggleGroupItem>
              <ToggleGroupItem id="long">long</ToggleGroupItem>
            </ToggleGroup>
          </State>
          <State label="Several, outline">
            <ToggleGroup aria-label="Formatting" selectionMode="multiple" variant="outline" defaultSelectedKeys={['bold']}>
              <ToggleGroupItem id="bold" aria-label="Bold">
                <BoldIcon />
              </ToggleGroupItem>
              <ToggleGroupItem id="italic" aria-label="Italic">
                <ItalicIcon />
              </ToggleGroupItem>
              <ToggleGroupItem id="underline" aria-label="Underline">
                <UnderlineIcon />
              </ToggleGroupItem>
            </ToggleGroup>
          </State>
          <State label="Disabled">
            <ToggleGroup aria-label="Snippet length" selectionMode="single" defaultSelectedKeys={['medium']} isDisabled>
              <ToggleGroupItem id="short">short</ToggleGroupItem>
              <ToggleGroupItem id="medium">medium</ToggleGroupItem>
              <ToggleGroupItem id="long">long</ToggleGroupItem>
            </ToggleGroup>
          </State>
        </States>
      </Section>
    </>
  )
}
