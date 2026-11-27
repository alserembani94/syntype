import type { LanguageMeta } from '../types'

/** csharp's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'csharp',
  name: 'C#',
  category: 'Applications',
  aliases: ['c#', 'cs', 'dotnet', '.net'],
  extension: 'cs',
} satisfies LanguageMeta
