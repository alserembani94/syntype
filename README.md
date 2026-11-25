# Keystroke

A typing speed test for code, in the spirit of monkeytype. It uses real code snippets, colours them like an editor, and reports how fast and how accurately you type them. JavaScript is the only language so far; the game is built so more can be added.

## Run it

```bash
npm install
npm run dev
```

Other scripts: `npm test` (engine tests, Vitest), `npm run build`, `npm run lint`.

## How it plays

- The timer starts on your first key. `Esc` loads a new snippet.
- **Auto-indent** (on by default) skips the leading spaces after Enter, the way an editor would. Skipped spaces don't count toward your score. With it off, you type the indentation, and Tab inserts 2 spaces.
- `Ctrl+Backspace` deletes a word.
- WPM is correct characters ÷ 5 per minute. Accuracy counts every keystroke, so fixed mistakes still cost you.
- Results show raw WPM, symbol accuracy (brackets, `=>`, `;` and so on), a speed-over-time chart, and the keys you missed most.
- Personal bests are kept per language and length in `localStorage`. Runs under 75% accuracy don't count.

## Project layout

```
src/
  languages/
    index.ts            the LANGUAGES registry
    types.ts            Language, Snippet and HighlightRules types
    snippets.ts         parses snippets files, picks a random snippet
    javascript/
      index.ts          name, extension and highlighting rules
      snippets.txt      the snippets: "=== name.js" header, then the code
  lib/engine.ts         pure typing engine (type, backspace, auto-indent, counts)
  lib/stats.ts          WPM, accuracy and the results summary
  lib/tokenize.ts       highlighter driven by a language's HighlightRules
  hooks/useTypingTest.ts  engine + clock as a React reducer
  components/           CodeView, ConfigBar, Results, SpeedChart
  App.tsx               layout, keyboard handling, settings, personal bests
```

## Adding a language

1. Create `src/languages/<id>/snippets.txt` with snippets in the format below. Name each file with the language's extension.
2. Create `src/languages/<id>/index.ts`, copying `javascript/index.ts` and changing `id`, `name`, `extension` and `highlight` (keywords, comment and string syntax).
3. Add it to `LANGUAGES` in `src/languages/index.ts`.

It then appears in the language picker. `npm test` checks every registered language's snippets.

## Adding snippets

Append a block to the language's `snippets.txt`:

```
=== myThing.js
const myThing = () => 42;
```

Use 2-space indentation and no tabs or trailing spaces (the tests check this). Length is picked from the character count: under 120 is short, up to 300 is medium, longer is long.
