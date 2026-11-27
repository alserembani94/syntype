import type { CompletionItem, Language, SuggestionKind, VocabularyPack } from '../types'
import { meta } from './meta'
import { parseSnippets } from '../snippets'
import { python } from '../python'
import raw from './snippets.txt?raw'

const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

/** pytest's API and built-in fixtures, always on in this track. */
const pytestPack: VocabularyPack = {
  name: 'pytest',
  globals: [
    { label: 'pytest', kind: 'module' },
    // Built-in fixtures, requested by naming them as test arguments.
    ...items('tmp_path monkeypatch capsys caplog request', 'variable'),
  ],
  members: {
    pytest: items('fixture mark raises approx param skip fail warns importorskip', 'function'),
    mark: items('parametrize skip skipif xfail usefixtures', 'function'),
    // monkeypatch, capsys and tmp_path methods, offered after any other ".".
    '*': items('setenv delenv setattr delattr chdir readouterr write_text read_text exists mkdir', 'method'),
  },
}

/** pytest tests in Python: everything from the Python language, plus pytest's vocabulary. */
export const pytest: Language = {
  ...python,
  ...meta,
  completion: { ...python.completion, packs: [...(python.completion?.packs ?? []), pytestPack] },
  snippets: parseSnippets(raw),
}
