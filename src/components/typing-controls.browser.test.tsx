/**
 * The typing screen's controls in a real browser (design system step 10):
 * the shared key check, the settings row's toolbar keys, and labelled
 * switches and checkboxes.
 */
import { useEffect, useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { LabelledCheckbox, LabelledSwitch } from '@/components/composites/labelled'
import { Shortcut, Tip } from '@/components/composites/tip'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ownsKey } from '@/lib/keyTarget'
import { mount } from '@/test/mount'
import { SettingsBar } from '../blocks/SettingsBar'
import type { SnippetLength } from '../languages'

/**
 * Records, for each key pressed, whether the focused control owns it (as the
 * app's key handler asks). It listens in the capture phase: React Aria stops
 * the keys its controls handle from bubbling, so they never reach the app's
 * own (bubbling) listener at all; ownsKey must still agree.
 */
function useOwnership() {
  const seen: [string, boolean][] = []
  const listen = () => {
    const on = (e: KeyboardEvent) => seen.push([e.key, ownsKey(e)])
    document.addEventListener('keydown', on, true)
    return () => document.removeEventListener('keydown', on, true)
  }
  return { seen, listen }
}

describe('ownsKey', () => {
  test.each([
    ['a button', 'Enter', true],
    ['a button', ' ', true],
    ['a button', 'a', false],
    ['a button', 'ArrowLeft', false],
    ['a slider', 'ArrowRight', true],
    ['a slider', 'PageUp', true],
    ['a slider', 'x', false],
    ['a text field', 'x', true],
    ['the editor input', 'x', false],
    ['a button', 'Tab', true],
    ['a text field', 'Tab', true],
    ['the editor input', 'Tab', false],
  ])('%s, %j: %s', async (what, key, owns) => {
    const { seen, listen } = useOwnership()
    await mount(
      <>
        <Button>Go</Button>
        <Slider aria-label="Position" defaultValue={50} />
        <input aria-label="Search" />
        <textarea aria-label="Type the code here" data-typing-input="" />
      </>,
    )
    const target = {
      'a button': () => page.getByRole('button', { name: 'Go' }),
      'a slider': () => page.getByRole('slider', { name: 'Position' }),
      'a text field': () => page.getByRole('textbox', { name: 'Search' }),
      'the editor input': () => page.getByRole('textbox', { name: 'Type the code here' }),
    }[what]!()
    ;(target.element() as HTMLElement).focus()
    const stop = listen()
    await userEvent.keyboard(key === ' ' ? ' ' : `{${key}}`.replace(/^\{(.)\}$/, '$1'))
    stop()
    expect(seen.at(-1)).toEqual([key, owns])
  })
})

function Settings({ onLength = () => {}, onIndent = () => {} }: { onLength?: (l: SnippetLength) => void; onIndent?: () => void }) {
  const [length, setLength] = useState<SnippetLength>('short')
  const [indent, setIndent] = useState(true)
  useEffect(() => onLength(length), [length, onLength])
  return (
    <SettingsBar
      languageName="Python"
      languageShortcut="Ctrl+Shift+L"
      onLanguage={() => {}}
      length={length}
      autoIndent={indent}
      autoClose={false}
      autocomplete={false}
      onLength={setLength}
      onToggleIndent={() => (setIndent((v) => !v), onIndent())}
      onToggleClose={() => {}}
      onToggleAutocomplete={() => {}}
      newSnippetShortcut="Ctrl+Enter"
      onNewSnippet={() => {}}
    />
  )
}

describe('the settings row', () => {
  test('Tab reaches each control once: language, length, aids, new snippet', async () => {
    await mount(<Settings />)
    const order: string[] = []
    for (let i = 0; i < 4; i++) {
      await userEvent.keyboard('{Tab}')
      order.push(document.activeElement?.textContent?.trim() ?? '')
    }
    expect(order).toEqual(['Python', 'short', 'auto-indent', 'new snippet'])
  })

  test('← → choose a length, and the app leaves those arrows alone', async () => {
    const onLength = vi.fn()
    const { seen, listen } = useOwnership()
    await mount(<Settings onLength={onLength} />)
    await userEvent.keyboard('{Tab}{Tab}')
    const stop = listen()
    await userEvent.keyboard('{ArrowRight}{Enter}')
    stop()
    expect(onLength).toHaveBeenLastCalledWith('medium')
    await expect.element(page.getByRole('radio', { name: 'medium' })).toBeChecked()
    expect(seen).toEqual([
      ['ArrowRight', true],
      ['Enter', true],
    ])
  })

  test('Space switches an aid; a letter typed there is the editor’s', async () => {
    const onIndent = vi.fn()
    const { seen, listen } = useOwnership()
    await mount(<Settings onIndent={onIndent} />)
    await userEvent.keyboard('{Tab}{Tab}{Tab}')
    await expect.element(page.getByRole('button', { name: 'auto-indent' })).toHaveFocus()
    const stop = listen()
    await userEvent.keyboard(' x')
    stop()
    expect(onIndent).toHaveBeenCalledOnce()
    expect(seen).toEqual([
      [' ', true],
      ['x', false],
    ])
  })

  test('the language button shows its shortcut in a tooltip', async () => {
    await mount(<Settings />)
    // React Aria ignores the very first hover on a fresh page; move the pointer once first.
    await page.getByRole('button', { name: 'new snippet' }).hover()
    await page.getByRole('button', { name: 'Python' }).hover()
    await expect.element(page.getByRole('tooltip')).toBeVisible()
    expect(page.getByRole('tooltip').element().textContent?.replace(/\s+/g, ' ')).toMatch(/^Change language ?Ctrl ?Shift ?L$/)
  })
})

describe('keys reach the app from controls with a tooltip', () => {
  // shadcn's TooltipTrigger wrapped its trigger in <Focusable>, which stopped every key
  // from bubbling: the results' V and R did nothing while a button had focus (local edit).
  test('a letter pressed on a button inside a Tip bubbles to the page', async () => {
    await mount(
      <Tip label="Retry">
        <Button>Retry</Button>
      </Tip>,
    )
    const seen: string[] = []
    const on = (e: KeyboardEvent) => seen.push(e.key)
    document.addEventListener('keydown', on)
    await userEvent.keyboard('{Tab}v')
    document.removeEventListener('keydown', on)
    expect(seen).toContain('v')
  })
})

describe('labelled switch and checkbox', () => {
  test('the visible text names the control and toggles it', async () => {
    const onChange = vi.fn()
    await mount(
      <>
        <LabelledSwitch label="Smooth caret" onChange={onChange} />
        <LabelledCheckbox label="Show me on the leaderboards" defaultSelected />
      </>,
    )
    await page.getByText('Smooth caret').click()
    await expect.element(page.getByRole('switch', { name: 'Smooth caret' })).toBeChecked()
    expect(onChange).toHaveBeenCalledWith(true)
    await page.getByText('Show me on the leaderboards').click()
    await expect.element(page.getByRole('checkbox', { name: 'Show me on the leaderboards' })).not.toBeChecked()
  })
})

describe('shortcut keys', () => {
  test.each([
    ['Enter', ['Enter']],
    ['Esc', ['Esc']],
    ['R', ['R']],
    ['Ctrl+Shift+L', ['Ctrl', 'Shift', 'L']],
    ['⌘⇧L', ['⌘', '⇧', 'L']],
    ['⌘↩', ['⌘', '↩']],
    ['Ctrl+K, then T', ['Ctrl', 'K', 'T']],
  ])('%s shows as %j', async (keys, shown) => {
    await mount(<Shortcut keys={keys} />)
    expect([...document.querySelectorAll('[data-slot="kbd"]')].map((k) => k.textContent)).toEqual(shown)
  })
})
