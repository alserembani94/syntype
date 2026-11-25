# Syntype

A typing speed test for code, in the spirit of monkeytype. It uses real code snippets, colours them like an editor, and reports how fast and how accurately you type them. Languages: JavaScript and TypeScript. The game is built so more can be added.

## Run it

```bash
npm install
npm run dev
```

Other scripts: `npm test` (engine tests, Vitest), `npm run build`, `npm run lint`.

## How it plays

- Nothing is scored on screen while you type: no clock, no WPM, no accuracy, no personal best. Timing starts quietly on your first key, and everything appears on the results screen when you finish. `Esc` loads a new snippet.
- When the page can't receive keys (on first load in a frame, after clicking elsewhere, or when switching tab or window), the code blurs and asks you to click, or tap on phones. Mid-run, this **pauses the clock**. Time away isn't counted, and results show how long you were paused.
- **Results:** WPM and accuracy beside a per-second chart (wpm, raw, and errors as ✕ with their own axis). Below that: test details, raw WPM, characters (right / wrong / suggested / auto-inserted), **consistency** (100% minus the variation in your per-second speed, shown for runs of 3 seconds or more) and time. A second row has code speed, keys saved, symbol accuracy and the keys you missed most. **Review** (`v`) shows the snippet with your mistakes, suggested text and auto-inserted text marked.
- **Auto-indent** (on by default) skips the leading spaces after Enter, the way an editor would. Skipped spaces don't count toward your score. With it off, you type the indentation, and Tab inserts 2 spaces.
- **Auto-close** (on by default) behaves like VS Code:
  - Typing `(`, `[`, `{` or a quote inserts the closer after the caret (highlighted). Type the closer to step over it, or press `→` / `End` to move past it.
  - Enter between `{` and its closer moves the closer down onto its own line. At the end of the block press `↓` to move past it. Pressing Enter there counts as a mistake, because VS Code would add a blank line.
  - VS Code's rules apply: quotes don't auto-close inside strings, `'` and `` ` `` don't inside comments, and no quote closes right after a letter or digit. Nothing auto-closes unless the next character is whitespace, end of line or one of `;:.,=}])>`.
  - Backspace on an opener also removes the closer it inserted.
  - The one difference from VS Code: a mistyped opener doesn't auto-close anything.
  - Closers you move past with `→`, `End` or `↓` don't count toward WPM. Personal bests are kept separately with auto-close on and off.
- **IntelliSense** (on by default) is a constrained version of VS Code's suggestion list:
  - It suggests the language's keywords, its built-ins (`console`, `Math`, `Promise`, `setTimeout`…), and words you've already typed in the snippet. Words that appear later in the snippet aren't offered, because a real file wouldn't have them yet.
  - Typing `.` opens members straight away. Known receivers (`Math.`, `console.`, `Object.`, `Promise.`…) show only their own members. Unknown ones (`list.`, or after `)`) show common methods such as `map`, `filter`, `then` and `trim`, plus words already typed. Chains continued on a new line (`.filter(…)`) and optional chaining (`a?.b`) work too. Spreads (`...`) and numbers (`0.5`) don't open the list.
  - Library packs switch on when the snippet imports the library: React (`useState`, `useCallback`…) and Express (`express.json`, and members for `app.`, `req.` and `res.`).
  - Ties are ranked as in VS Code with TypeScript: names from the file first, then alphabetical.
  - The list opens as you type a word, but not inside strings or comments (VS Code's `quickSuggestions` defaults). Matching is fuzzy, so `uC` finds `useCallback`.
  - `Tab` or `Enter` accepts, `↑`/`↓` choose and `Esc` closes. Clicking or tapping a row also accepts. As in VS Code (`acceptSuggestionOnEnter: "on"`), Enter accepts even when the word is already complete. Press `Esc` first if you want a new line.
  - Accepting a wrong suggestion inserts it anyway, and its letters are checked like typed ones.
- **IntelliSense is type-aware.** JavaScript and TypeScript snippets both get suggestions from TypeScript's real language service, the engine VS Code uses for both, running in a Web Worker. JavaScript is analysed for inference only (no type errors), as VS Code does without `// @ts-check`. Names it can't resolve are offered as plain words, as in VS Code. It knows the types declared in the snippet: after `interface User { name: string }`, `u.` offers `name`, `users.filter((x) => x.` knows `x` is a `User`, and `Pick<>`, generics, union narrowing, enums and string-literal unions (`"up"`) all work. It only sees what you've typed so far, as a real editor would, so a typo breaks suggestions there too. The status bar shows "… IntelliSense starting…" while it loads (about a second). Until then, and if it can't start, basic suggestions (keywords, built-ins, React/Express packs and typed words) are used.
- **Commit characters** (VS Code's): with the list open, typing `.` `,` `;` or `(` accepts the selected item and then types the character. They apply everywhere except where you're declaring a new name, because the service knows those spots. With basic suggestions (before the service is ready), they apply only in member lists after a dot, since basic suggestions can't tell when a new name is being declared. An exact, fully typed word always outranks longer words it starts (VS Code's full-match boost), so typing `fetch(` commits `fetch`, not `fetchUser`.
- **Scoring with assists:** WPM counts only characters you typed. **Code speed** counts every right character on screen, including suggested and auto-inserted text, and **keys saved** shows what suggestions saved you. Personal bests are kept separately for each combination of assists.
- `Ctrl+Backspace` deletes a word.
- WPM is correct typed characters ÷ 5 per minute. Accuracy counts every keystroke, so fixed mistakes still cost you.
- Results show raw WPM, symbol accuracy (brackets, `=>`, `;` and so on), a speed-over-time chart, and the keys you missed most.
- Personal bests are kept per language and length in `localStorage`. Runs under 75% accuracy don't count.

## Project layout

```
src/
  languages/
    index.ts            the LANGUAGES registry
    types.ts            Language, Snippet and HighlightRules types
    snippets.ts         parses snippets files, picks a random snippet
    typescript/         TypeScript: highlighting, snippets, and its language service
    javascript/
      index.ts          name, extension, highlighting, auto-close and completion settings
      completions.ts    vocabulary: built-ins, React and Express packs
      snippets.txt      the snippets: "=== name.js" header, then the code
  lib/engine.ts         pure typing engine (type, backspace, auto-indent, auto-close, →/End/↓)
  lib/suggest.ts        IntelliSense: context (word or member), local candidates, fuzzy matching, ranking
  lib/service.ts        the interface a language's completion service implements
  lib/ts/               TypeScript service: completer (pure), worker, client, ES library types, stubs
  lib/pairs.ts          matches brackets and quotes per snippet, with VS Code's auto-close rules
  lib/stats.ts          WPM, accuracy and the results summary
  lib/tokenize.ts       highlighter driven by a language's HighlightRules
  hooks/useTypingTest.ts  engine + clock as a React reducer
  components/           CodeView, ConfigBar, Results, Review, SpeedChart, SuggestBox
  hooks/usePageFocus.ts whether keys can reach the game (drives the focus overlay and pausing)
  App.tsx               layout, keyboard handling, settings, personal bests
```

## Adding a language

1. Create `src/languages/<id>/snippets.txt` with snippets in the format below. Name each file with the language's extension.
2. Create `src/languages/<id>/index.ts`, copying `javascript/index.ts` and changing `id`, `name`, `extension`, `highlight` (keywords, comment and string syntax), `autoClosingPairs` and `completion.wordChar` (what counts as a word character). Copy `autoClosingPairs` from the language's VS Code `language-configuration.json` so auto-close matches the editor.
3. Add it to `LANGUAGES` in `src/languages/index.ts`.

It then appears in the language picker. `npm test` checks every registered language's snippets.

### Suggestions for a language

A language can have a **completion service** (`completion.service`, see `src/lib/service.ts`) that understands the code, like TypeScript's in `src/lib/ts/`. Services run asynchronously, usually in a worker, and are asked for suggestions at the start of a word or after a trigger character (`completion.triggerCharacters`). The list is then filtered locally as you type, as VS Code does. Languages without a service use vocabulary packs, described below.

A language's `completion` section sets which characters make a word (`wordChar`), what opens member lists (`memberTriggers`, e.g. `["."]` or `["::", "->"]`) and its vocabulary `packs`. See `src/languages/javascript/completions.ts`. A pack without `detect` is always on (built-ins). A pack with `detect` switches on when the snippet matches it, usually an import. Each pack has `globals` and `members`, keyed by receiver, with `"*"` for receivers whose type we can't know.

`npm test` prints how many words in the snippets suggestions can offer at the moment they're typed, and which are missed most. Use it to see what vocabulary to add with new snippets.

## Adding snippets

**Declare or import every name a snippet uses.** A real file would, and IntelliSense relies on it. With an undeclared `db`, typing `db.` would commit the `debugger` keyword (the `.` is a commit character), exactly as VS Code would. `npm test` types every snippet literally with suggestions on and fails if that happens.

Append a block to the language's `snippets.txt`:

```
=== myThing.js
const myThing = () => 42;
```

Use 2-space indentation and no tabs or trailing spaces (the tests check this). Length is picked from the character count: under 120 is short, up to 300 is medium, longer is long.

## TypeScript dependency note

The project builds with TypeScript 7, the native Go compiler, which has no JavaScript API that runs in a browser. The in-browser language service is TypeScript **6.0.3**, the last JavaScript-based release, installed under the alias `ts-lang`. It ships as a separate worker file of about 1 MB gzipped, shared by JavaScript and TypeScript, and loaded in the background as soon as a snippet opens with IntelliSense on. Its browser globals, React and Express types are small stubs (`src/lib/ts/stubs.ts`) rather than the full DOM and `@types/react` declarations.
