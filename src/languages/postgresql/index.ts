import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import { packs, TYPES } from './completions'
import raw from './snippets.txt?raw'

const KEYWORDS =
  'SELECT FROM WHERE AND OR NOT NULL IS IN AS ON USING JOIN LEFT RIGHT INNER OUTER FULL CROSS GROUP BY ORDER HAVING LIMIT OFFSET DISTINCT INSERT INTO VALUES UPDATE SET DELETE RETURNING CREATE TABLE INDEX UNIQUE PRIMARY KEY FOREIGN REFERENCES DEFAULT CHECK CONSTRAINT ALTER ADD DROP COLUMN IF EXISTS CASCADE WITH RECURSIVE UNION ALL CASE WHEN THEN ELSE END ASC DESC OVER PARTITION ROWS RANGE BETWEEN UNBOUNDED PRECEDING FOLLOWING CURRENT ROW CONFLICT DO NOTHING BEGIN COMMIT ROLLBACK FUNCTION RETURNS RETURN LANGUAGE TRIGGER BEFORE AFTER FOR EACH EXECUTE REPLACE VIEW CONCURRENTLY TRUE FALSE LIKE ILIKE INTERVAL NEW OLD DECLARE'

export const postgresql: Language = {
  id: 'postgresql',
  name: 'PostgreSQL',
  extension: 'sql',
  indentSize: 2,
  highlight: {
    // Written uppercase, as in the PostgreSQL docs; matched in any case, like SQL.
    keywords: KEYWORDS.split(' '),
    caseInsensitive: true,
    types: TYPES.split(' '),
    lineComments: ['--'],
    blockComments: [['/*', '*/']],
    strings: ["'", '"'],
    // Dollar-quoted function bodies, shown as strings as VS Code's SQL grammar does.
    multilineStrings: ['$$'],
  },
  // From VS Code's SQL language configuration (extensions/sql/language-configuration.json).
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "N'", close: "'", notIn: ['string', 'comment'] },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
  ],
  // No in-browser language service: keywords, typed words (tables, columns,
  // aliases) and PostgreSQL's built-in functions and types. "." opens
  // table.column and alias.column.
  completion: {
    wordChar: /\w/,
    packs,
  },
  snippets: parseSnippets(raw),
}
