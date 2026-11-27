import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { mount } from '@/test/mount'
import { useLanguage } from './useLanguage'

function Probe({ id }: { id: string | null }) {
  const { language, failed } = useLanguage(id)
  return <p>{failed ? 'failed' : language ? `loaded ${language.name}` : 'waiting'}</p>
}

describe('useLanguage', () => {
  test('nothing asked for: waiting, not failed (a replay asks only once its data is in)', async () => {
    await mount(<Probe id={null} />)
    await expect.element(page.getByText('waiting')).toBeVisible()
  })

  test('loads the language it is given', async () => {
    await mount(<Probe id="rust" />)
    await expect.element(page.getByText('loaded Rust')).toBeVisible()
  })
})
