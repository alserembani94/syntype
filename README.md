# Syntype

A typing speed test for code, in the spirit of monkeytype. It uses real code snippets, colours them like an editor, and reports how fast and how accurately you type them. Languages: JavaScript, TypeScript, Python, Rust, Go, x86-64 Assembly, PHP, YAML, PostgreSQL, COBOL, Brainfuck and LOLCODE. The game is built so more can be added.

## Run it

```bash
npm install
npm run dev
```

Other scripts: `npm test` (unit and playthrough tests, Vitest), `npm run build`, `npm run lint`.

`npm run build:page` builds `dist-page/index.html`: the whole app as one self-contained page, for hosts that serve a single HTML file (such as a claude.ai artifact). The TypeScript worker is embedded in the page and started from a `blob:` URL as a classic worker, so it runs even where the page has no address of its own or sits in a sandboxed frame. The regular `npm run build` keeps the worker as a separate file.

## Deploy

The site deploys to Cloudflare as a Worker with static assets (`wrangler.jsonc`): `npm run build` produces `dist/`, and Cloudflare serves those files as they are. There is no server code. `public/_headers` caches the hashed files in `/assets/` for a year and keeps `index.html` fresh, so a new deploy shows up at once.

- **From GitHub (recommended):** in the Cloudflare dashboard, Workers & Pages → Create → import this repository. Build command `npm run build`, deploy command `npx wrangler deploy`. Every push to `main` then deploys.
- **From your computer:** `npx wrangler login` once, then `npm run build && npx wrangler deploy`.

## How it plays

- Nothing is scored on screen while you type: no clock, no WPM, no accuracy, no personal best. Timing starts quietly on your first key, and everything appears on the results screen when you finish. The status bar does show your line, column and how many characters are done. The **new snippet** button next to the language button, or `Ctrl+Enter` (`⌘+Enter` on a Mac), loads a different snippet. `Esc` only ever closes things (the suggestion list, a picker), so it can't throw a run away.
- **Length:** short (under 120 characters), medium (up to 300) or long. There is no mixed "any" option: a short snippet's best WPM runs well above a long one's for the same typist, so speeds are only ever compared within one length. Personal bests saved under the old "any" are dropped.
- **Language:** the button above the editor (`</> JavaScript`), or `Ctrl+Shift+L` (`⌘+Shift+L`), opens a searchable list of languages, grouped into sections (Web, Systems, Scripting, Data & config, Testing & QA, Mainframe, Esoteric). Type to filter by name, extension, alias (`golang`, `sql`, `yml`) or section (`web` lists every web language), `↑`/`↓` and `Enter` to choose, `Esc` or a click outside to close. While it's open, keys go to the search and a run in progress is paused.
- **Theme:** the button at the bottom right, or `Ctrl+K` then `T` (`⌘+K` then `T`), opens the theme list. **System** (the default) uses Syntype Light or Syntype Dark to match your computer; the others are Syntype Light and Dark themselves, **Dark High Contrast** (VS Code's pure-black theme), **One Dark Pro**, **GitHub Light**, **Green Phosphor** (a retro terminal with a soft glow), and three **colour vision** themes, for **protanopia**, **deuteranopia** and **tritanopia**. Those three are built on GitHub Dark with GitHub's colour-blind error and success colours, and code colours chosen so that text, comments, mistakes and each kind of code stay clearly apart as someone with that colour vision sees them (checked in the tests with the Machado et al. 2009 simulation). Resting on a theme in the list previews it (after a short pause, so sweeping past rows doesn't flash each one), and colours cross-fade rather than switch at once; `Enter` or a click keeps it, `Esc` puts the previous one back. The choice is saved and applied before the page first draws, so it never flashes the default colours.
- When the page can't receive keys (on first load in a frame, after clicking elsewhere, or when switching tab or window), the code blurs and asks you to click, or tap on phones. Mid-run, this **pauses the clock**. Time away isn't counted, and results show how long you were paused.
- **Results:** WPM and accuracy beside a per-second chart (wpm, raw, and errors as ✕ with their own axis). Below that: test details, raw WPM, characters (right / wrong / suggested / auto-inserted), **consistency** (100% minus the variation in your per-second speed, shown for runs of 3 seconds or more) and time. A second row has code speed, keys saved, symbol accuracy and the keys you missed most. **Review** (`v`) shows the snippet with your mistakes, suggested text and auto-inserted text marked.
- **Ad spaces:** placeholders only for now, at fixed sizes so nothing shifts once they're filled: a 728×90 banner on the results screen, below the buttons (it narrows on small screens), and a 160×600 column either side of the app on screens at least 1360px wide and 680px tall, which fades back while you type. Sizes are in `src/lib/ads.ts`, the placeholder in `src/components/AdSlot.tsx`.
- **Auto-indent** (on by default) skips the leading spaces after Enter, the way an editor would. Skipped spaces don't count toward your score. With it off, you type the indentation, and Tab inserts 2 spaces.
- **Auto-close** (on by default) behaves like VS Code:
  - Typing `(`, `[`, `{` or a quote inserts the closer after the caret (highlighted). Type the closer to step over it, or press `→` / `End` to move past it.
  - Enter between `{` and its closer moves the closer down onto its own line. At the end of the block press `↓` to move past it. Pressing Enter there counts as a mistake, because VS Code would add a blank line.
  - VS Code's rules apply: quotes don't auto-close inside strings, `'` and `` ` `` don't inside comments, and no quote closes right after a letter or digit. Nothing auto-closes unless the next character is whitespace, end of line or one of `;:.,=}])>`.
  - Backspace on an opener also removes the closer it inserted.
  - The one difference from VS Code: a mistyped opener doesn't auto-close anything.
  - Closers you move past with `→`, `End` or `↓` don't count toward WPM.
- **Autocomplete** (on by default) behaves like VS Code's suggestion list (IntelliSense):
  - It opens as you start a word or type a trigger character such as `.`, but not for words inside strings or comments (VS Code's `quickSuggestions` defaults). A quote is a trigger character, so `"` can still offer a string union's values. Matching is fuzzy, so `uC` finds `useCallback`.
  - `Tab` or `Enter` accepts, `↑`/`↓` choose and `Esc` closes. Clicking or tapping a row also accepts. As in VS Code (`acceptSuggestionOnEnter: "on"`), Enter accepts even when the word is already complete. Press `Esc` first if you want a new line.
  - Ranking follows VS Code: match quality, then the language's own priority (names from the file before globals and keywords), then alphabetical. Recommended items are pre-selected.
  - Accepting a wrong suggestion inserts it anyway, and its letters are checked like typed ones.
- **Python suggestions** come from keywords, words you've typed, and vocabulary for Python's built-ins plus the standard-library modules a snippet imports (`json`, `re`, `collections`, `pathlib`, `asyncio` and more). There's no type engine for Python yet, so after a dot on an unknown value it offers common `str`/`list`/`dict`/`set` methods. Auto-close follows VS Code's Python configuration, including string prefixes (`f"`, `r'`), and indentation is 4 spaces.
- **Rust suggestions** work the same way: keywords, typed words, the prelude (`Vec`, `String`, `Option`, `Some`/`None`, primitive types, macros like `println`/`vec`) and the `std` modules a snippet `use`s (`collections`, `fs`, `io`, `fmt`, `thread`, `sync`). Both `.` and `::` open member lists, so `String::` offers `new`/`from` and `HashMap::` offers `new`. Auto-close follows VS Code's Rust configuration: brackets and `"` only, with no `'` pair because Rust uses `'` for lifetimes and chars. Indentation is 4 spaces (rustfmt).
- **Go suggestions** cover keywords, typed words, built-ins (`len`, `make`, `append`…) and the standard-library packages a snippet imports, including inside an `import ( … )` block (`fmt`, `strings`, `errors`, `sync`, `time`, `net/http`, `encoding/json`, `context` and more). A package's members follow its last path part, so `net/http` gives `http.`. Go is indented with **tabs**, as gofmt does: auto-indent skips them, Tab types one, they display 4 columns wide, and the status bar shows "Tab Size: 4". Auto-close follows VS Code's Go configuration, including backtick raw strings and `'` runes.
- **PHP suggestions** cover keywords, typed words and PHP's built-in functions, classes and constants (no imports needed). `$` is part of a word, as in VS Code's PHP word pattern, so `$us` finds `$user`. Both `->` and `::` open member lists (`PDO::` offers `FETCH_ASSOC`). Auto-close follows VS Code's PHP configuration, where brackets don't auto-close inside strings, so `"{$name}"` types as written. Indentation is 4 spaces (PSR-12).
- **YAML suggestions** offer words from the file, as VS Code does, plus the keys of formats Syntype recognises from the file's shape: GitHub Actions, Docker Compose, Kubernetes, GitLab CI, OpenAPI and Ansible. That stands in for the schema-based completion the YAML extension gives VS Code. Keys are highlighted, and auto-close follows VS Code's YAML configuration (brackets and both quotes, so `${{ … }}` expressions nest). Indentation is 2 spaces.
- **PostgreSQL** snippets follow the PostgreSQL docs' style: keywords uppercase, types lowercase. Keywords are highlighted in any case, types (`integer`, `timestamptz`, `jsonb`) in their own colour, and `$$ … $$` function bodies as strings. Suggestions cover keywords, PostgreSQL's built-in functions and types, and tables, columns and aliases typed earlier (`u.` offers columns). Auto-close follows VS Code's SQL configuration, including the `N'` prefix.
- **x86-64 Assembly** is NASM (Intel) syntax for Linux: labels at column 0, instructions one level (4 spaces) in. Instructions, directives and registers are matched in any case; labels (`_start:`, `.loop:`) are coloured as names and registers as types, `;` starts a comment, and hex numbers (`0x3c`) are numbers. Suggestions cover instructions, directives, registers, and labels and data names typed earlier; a local label like `.loop` is one word, dot included. VS Code has no built-in assembly support, so auto-close comes from the most used x86-64 assembly extension (`13xforever.language-x86-64-assembly`: brackets and `"`). Every snippet is real code, checked in the tests: NASM assembles each one, programs are run and their output checked, and functions are called from a small C program (skipped where NASM, ld or a C compiler isn't installed).
- **COBOL** is written in **fixed format**: code starts at column 8 (Area A), statements at column 12 (Area B), nothing past column 72. Auto-indent skips the 7-column margin, so typing starts at column 8. Hyphenated words (`WS-TOTAL`, `END-PERFORM`) are single words for highlighting and suggestions, keywords are matched in any case, and `*>` starts a comment. Suggestions cover keywords, intrinsic functions (`UPPER-CASE`, `CURRENT-DATE`) and data names declared earlier. VS Code has no built-in COBOL support, so auto-close comes from the widely used COBOL extension (`bitlang.cobol`).
- **Esoteric:** **Brainfuck** is a pure symbol drill: its eight commands are coloured by role (`+ -` values, `< >` moves, `[ ]` loops, `. ,` input and output) and everything else is a comment. Every snippet is a working program, checked by running it through an interpreter in the tests. **LOLCODE** has its lolcat keywords (`HAI`, `I HAS A`, `VISIBLE`, `O RLY?`, `KTHXBYE`), `BTW` and `OBTW … TLDR` comments, and suggestions for keywords and variables. Neither has built-in VS Code support, so auto-close comes from their VS Code extensions (Brainfuck: only `[`).
- **Testing & QA** holds framework tracks built on a language Syntype already has: **Playwright** on TypeScript, with type-aware autocomplete for `page`, locators and `expect` matchers through a `@playwright/test` type stub; **Selenium** on Python (`webdriver`, `By`, `WebDriverWait`, expected conditions); and **pytest** on Python (`pytest.mark`, `raises`, `approx`, built-in fixtures). Each keeps its base language's highlighting, auto-close and indentation.
- After a member trigger (`.`, `::`, `->`), in languages without a type engine, the vocabulary's methods are listed before words from the file, and the language's keywords are never offered as members.
- **Autocomplete is type-aware** for JavaScript and TypeScript: their snippets both get suggestions from TypeScript's real language service, the engine VS Code uses for both, running in a Web Worker. JavaScript is analysed for inference only (no type errors), as VS Code does without `// @ts-check`. Names it can't resolve are offered as plain words, as in VS Code. It knows the types declared in the snippet: after `interface User { name: string }`, `u.` offers `name`, `users.filter((x) => x.` knows `x` is a `User`, and `Pick<>`, generics, union narrowing, enums and string-literal unions (`"up"`) all work. It only sees what you've typed so far, as a real editor would, so a typo breaks suggestions there too. The status bar shows "… autocomplete starting…" while it loads (about a second). Until then, and if it can't start, basic suggestions (keywords and words you've typed) are used. If it can't start, hovering over the status-bar label shows why.
- **Commit characters** (VS Code's): with the list open, typing `.` `,` `;` or `(` accepts the selected item and then types the character. They apply everywhere except where you're declaring a new name, because the service knows those spots. Basic suggestions have none, since they can't tell when a new name is being declared. An exact, fully typed word always outranks longer words it starts (VS Code's full-match boost), so typing `fetch(` commits `fetch`, not `fetchUser`.
- **Scoring with assists:** WPM counts only characters you typed. **Code speed** counts every right character on screen, including suggested and auto-inserted text, and **keys saved** shows what suggestions saved you.
- WPM is correct typed characters ÷ 5 per minute. Accuracy counts every keystroke, so fixed mistakes still cost you. Symbol accuracy covers brackets, `=>`, `;` and the like.
- **Personal bests** are kept in `localStorage`, separately for each language, length, and auto-close and autocomplete setting (auto-indent isn't part of it). Runs under 75% accuracy don't count.
- `Ctrl+Backspace` deletes a word.

## Pages and SEO

The site lives at https://syntype.vercel.my. Every language has its own page (`/python`, `/rust`, `/cobol` …) that opens with that language selected; choosing another language moves to its page, so the address can be shared. The build writes these pages from `src/seo/site.ts`, each with its own title, description, canonical URL, link preview (Open Graph and Twitter tags with `public/og.png`), structured data, and an intro, FAQ and language list in the HTML itself, so search engines and link previews can read them without running any script. Once the app runs, that intro moves out of the page into an **About** dialog, opened from the footer; its language links switch language without reloading. `sitemap.xml` and `robots.txt` are generated from the same list.

`node scripts/og-image.mjs` re-renders the preview image (from `scripts/og/og.html`, in Syntype Light) and the home screen icon; run it after adding a language, since the image counts them.

## Shortcuts

Every plain key is typing, so shortcuts use Ctrl (⌘ on a Mac; either works everywhere). They're defined in `src/lib/shortcuts.ts`.

| Keys | Does |
|---|---|
| `Ctrl+Enter` / `⌘+Enter` | New snippet, while typing or on the results screen |
| `Ctrl+Shift+L` / `⌘+Shift+L` | Change language |
| `Ctrl+K`, then `T` / `⌘+K`, then `T` | Change theme. Two steps, like VS Code's `Ctrl+K Ctrl+T`; the second is a plain `T` because browsers keep `Ctrl+T` for a new tab. Any other second key cancels without typing anything. |
| `Esc` | Closes the suggestion list or a picker; otherwise does nothing |
| `Enter`, `r`, `v` | On the results screen: next snippet, retry, review |
| `Ctrl+Backspace` | Deletes a word |

## Project layout

```
src/
  languages/
    index.ts            the LANGUAGES registry
    types.ts            Language, Snippet and HighlightRules types
    snippets.ts         parses snippets files, picks a random snippet
    javascript/
      index.ts          name, extension, highlighting, auto-close and completion settings
      snippets.txt      the snippets: "=== name.js" header, then the code
    typescript/         the same for TypeScript (its service lives in lib/ts/)
    python/             the same for Python, plus completions.ts (built-in and stdlib vocabulary)
    rust/               the same for Rust, plus completions.ts (prelude and std vocabulary)
    go/                 the same for Go, plus completions.ts (built-ins and stdlib packages)
    php/                the same for PHP, plus completions.ts (built-in functions, classes, constants)
    yaml/               the same for YAML, plus completions.ts (keys of recognised file formats)
    postgresql/         the same for PostgreSQL, plus completions.ts (built-in functions and types)
    assembly/           the same for x86-64 Assembly, plus completions.ts (registers) and a test
                        that assembles and runs every snippet with NASM
    cobol/              the same for COBOL, plus completions.ts (intrinsic functions)
    brainfuck/          the same for Brainfuck, plus a test that runs every snippet
    lolcode/            the same for LOLCODE
    playwright/         a TypeScript track: snippets (its types are in lib/ts/stubs.ts)
    selenium/, pytest/  Python tracks: snippets plus a vocabulary pack each
  lib/engine.ts         pure typing engine (type, backspace, auto-indent, auto-close, →/End/↓)
  lib/suggest.ts        autocomplete: context (word or member), local candidates, fuzzy matching, ranking
  lib/service.ts        the interface a language's completion service implements
  lib/ts/               TypeScript service: completer (pure), worker, client, ES library types, stubs
  lib/pairs.ts          matches brackets and quotes per snippet, with VS Code's auto-close rules
  lib/stats.ts          WPM, accuracy and the results summary
  lib/tokenize.ts       highlighter driven by a language's HighlightRules
  lib/storage.ts        localStorage wrapper for settings and personal bests
  hooks/useTypingTest.ts  engine, clock and suggestion requests as a React reducer
  hooks/usePageFocus.ts whether keys can reach the game (drives the focus overlay and pausing)
  components/           AboutDialog, AdSlot, CodeView, ConfigBar, LanguagePicker, Picker (shared by both pickers),
                        Results, Review, SpeedChart, SuggestBox, ThemePicker
  seo/                  site.ts: the site's address, every page's title, description and intro, the sitemap
  themes/               themes.css (every theme's colours), index.ts (the list), themes.test.ts (rules T1–T4)
  App.tsx               layout, keyboard handling, settings, personal bests
```

## Adding a language

1. Create `src/languages/<id>/snippets.txt` with snippets in the format below. Name each file with the language's extension.
2. Create `src/languages/<id>/index.ts`, using `javascript/index.ts` as a model: set `id`, `name`, `extension`, `indentSize` (and `indentWithTabs` if the language's formatter uses tabs), `highlight` (keywords, comment and string syntax, and optionally a `keyPattern` for languages whose keys should be coloured, like YAML, `types` for built-in type names, `caseInsensitive` for languages like SQL, `identifier` for languages whose names contain other characters (COBOL's hyphens), and `capitalizedTypes: false` where capitals don't mean a type), plus `indentOffset` and `maxLineLength` for fixed-format languages, `autoClosingPairs` and `completion`. Copy `autoClosingPairs` from the language's VS Code `language-configuration.json` so auto-close matches the editor. **Don't copy JavaScript's `completion.service`, `serviceMode` or `triggerCharacters`**: those wire in TypeScript's service. A language without its own service sets `wordChar` and, if useful, vocabulary `packs` (see below).
3. Add it to `LANGUAGES` in `src/languages/index.ts`.

It then appears in the language picker, and `npm test` holds it to every language rule (R1–R9 in `CLAUDE.md`, checked by `src/languages/conformance.test.ts`): identity, at least 4 snippets per length, formatting, highlighting, playthroughs with and without its service, and suggestions that save keystrokes. A language with a service also needs a stand-in for it in `TEST_COMPLETERS` (`src/test/harness.ts`).

### Suggestions for a language

A language can have a **completion service** (`completion.service`, see `src/lib/service.ts`) that understands the code, like TypeScript's in `src/lib/ts/`. Services run asynchronously, usually in a worker, and are asked for suggestions at the start of a word or after a trigger character (`completion.triggerCharacters`). The list is then filtered locally as you type, as VS Code does. Languages without a service get keywords and words already typed, plus optional vocabulary packs: `completion.packs`, with `wordChar` for what makes a word and `memberTriggers` (e.g. `["."]` or `["::", "->"]`) for what opens member lists. A pack without `detect` is always on (built-ins); one with `detect` switches on when the snippet matches it, usually an import. Each pack has `globals`, and `members` keyed by receiver, with `"*"` for receivers whose type is unknown. The test language in `src/lib/suggest.test.ts` shows the shape. JavaScript and TypeScript don't use packs, because the service covers them.

`npm test` reports how many keystrokes suggestions save for each language, and fails if typing any snippet literally lets a commit character insert a wrong word.

## Adding a theme

1. Add a block to `src/themes/themes.css`: `[data-syntype-theme="<id>"] { … }`, setting every variable the others set (backgrounds, text, accent, errors, the seven code colours, `--glow`, `--tab-dot`) and `color-scheme`. For a theme borrowed from an editor, take the colours from the theme's own source files and say which in a comment above the block.
2. List it in `THEMES` in `src/themes/index.ts` with a name and a section.
3. Run `npm test`: `src/themes/themes.test.ts` checks the rules in CLAUDE.md (every colour set, readable contrast).

## Adding snippets

A snippet can use names from code around it that isn't shown, such as `items`, `todos` or `user`. The suggestion service treats them as unknown, as a real editor would with that code missing. One case needs care: an undeclared name that fuzzy-matches something else can be swapped by a commit character. In `server.js`, an undeclared `db` made `db.` commit the `debugger` keyword, exactly as VS Code would. `npm test` types every snippet literally with suggestions on and fails if that happens. If it does, declare or import the name in the snippet, as `server.js` now imports `db`.

Append a block to the language's `snippets.txt`:

```
=== myThing.js
const myThing = () => 42;
```

Use printable ASCII, 2-space indentation, lines of 88 characters or fewer, and no trailing spaces (rule R4; the tests check this). Each language needs at least 4 snippets per length (R2). Length is picked from the character count: under 120 is short, up to 300 is medium, longer is long.

## TypeScript dependency note

The project builds with TypeScript 7, the native Go compiler, which has no JavaScript API that runs in a browser. The in-browser language service is TypeScript **6.0.3**, the last JavaScript-based release, installed under the alias `ts-lang`. It ships as a separate worker file of about 1 MB gzipped, shared by JavaScript and TypeScript, and loaded in the background as soon as a snippet opens with autocomplete on. Its browser globals, React and Express types are small stubs (`src/lib/ts/stubs.ts`) rather than the full DOM, `@types/react` and `@types/express` declarations.
