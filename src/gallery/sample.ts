/**
 * Made-up content for the gallery. The language list mirrors the picker's
 * sections without importing the languages themselves (their snippets would
 * bloat the gallery for nothing).
 */
export const LANGUAGE_SECTIONS = ['Web', 'Systems', 'Scripting', 'Data & config', 'Testing & QA', 'Mainframe', 'Esoteric'] as const

export const SAMPLE_LANGUAGES: { id: string; name: string; section: string; aliases?: string }[] = [
  { id: 'javascript', name: 'JavaScript', section: 'Web', aliases: 'js' },
  { id: 'typescript', name: 'TypeScript', section: 'Web', aliases: 'ts' },
  { id: 'php', name: 'PHP', section: 'Web' },
  { id: 'rust', name: 'Rust', section: 'Systems' },
  { id: 'go', name: 'Go', section: 'Systems', aliases: 'golang' },
  { id: 'assembly', name: 'x86-64 Assembly', section: 'Systems', aliases: 'asm' },
  { id: 'python', name: 'Python', section: 'Scripting', aliases: 'py' },
  { id: 'yaml', name: 'YAML', section: 'Data & config' },
  { id: 'postgresql', name: 'PostgreSQL', section: 'Data & config', aliases: 'sql' },
  { id: 'playwright', name: 'Playwright', section: 'Testing & QA' },
  { id: 'pytest', name: 'pytest', section: 'Testing & QA' },
  { id: 'cobol', name: 'COBOL', section: 'Mainframe' },
  { id: 'brainfuck', name: 'Brainfuck', section: 'Esoteric' },
]
