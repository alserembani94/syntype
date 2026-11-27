import type { LanguageMeta } from '../types'

/** selenium's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'selenium',
  name: 'Selenium',
  category: 'Testing & QA',
  aliases: ['webdriver'],
  basedOn: 'Python',
  extension: 'py',
} satisfies LanguageMeta
