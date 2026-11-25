# Syntype

A typing speed test for code (Vite + React + TypeScript). See README.md for how it plays and how it's built.

## Commands

- `npm test`: all tests, including the language conformance suite. Run before every commit.
- `npm run lint`, `npx tsc -b`: must be clean.
- `npm run build`: regular build (the TypeScript worker is a separate file).
- `npm run build:page`: one self-contained page in `dist-page/index.html`, used for the published artifact.

## Language rules

Every language must meet these. `src/languages/conformance.test.ts` checks them for every entry in `LANGUAGES`, so adding a language to the registry is enough to hold it to all of them. When adding or changing a language, go through this list; when a rule changes, change it here and in that test together.

- **R1 · Identity.** A unique `id`, a display `name`, a picker section (`category`, one of `CATEGORIES` in `src/languages/types.ts`: Web, Systems, Scripting, Data & config, Testing & QA, Mainframe, Esoteric; add a section there if none fits), a lowercase `extension` without a dot, and highlighting keywords (not needed for a `symbolic` language, see below). Add `aliases` for other names people search for (`golang`, `sql`).
- **R2 · Variety.** At least 4 snippets for each length: short (under 120 characters), medium (up to 300) and long. More is welcome.
- **R3 · Snippet names.** Unique within the language, each ending in the language's extension (`debounce.js`).
- **R4 · Formatting.** Printable ASCII only; no trailing whitespace; indentation in steps of the language's `indentSize` (2 by default, 4 for Python and Rust) after its `indentOffset` (0 by default, 7 for fixed-format COBOL), or tabs only for a language with `indentWithTabs` (Go, as gofmt does), and no tabs anywhere else; lines of 88 columns or fewer (or the language's `maxLineLength`, 72 for COBOL), counting a tab as `indentSize`; no leading blank line.
- **R5 · Highlighting.** The language's highlight rules tokenize every snippet, and its keywords are highlighted in them. For a `symbolic` language, every command symbol gets its colour and everything else reads as a comment.
- **R6 · Playable without a service.** Every snippet can be typed literally to the end with auto-indent, auto-close and basic suggestions on, without a single wrong character. This is the experience before a language service is ready.
- **R7 · Service stand-in.** A language with a completion service has a synchronous stand-in for it in `TEST_COMPLETERS` (`src/test/harness.ts`).
- **R8 · Commit characters are safe.** With the service, typing every snippet literally never lets a commit character (`.` `,` `;` `(`) insert a wrong word. If one does, it's usually an undeclared name that fuzzy-matches something else: declare or import it in the snippet (as `server.js` imports `db`).
- **R9 · Suggestions help.** Accepting suggestions whenever the right word is selected finishes every snippet without mistakes and saves keystrokes overall. A `symbolic` language must still finish without mistakes, but has no words to save.

**`symbolic` languages** (Brainfuck) are built from single-character commands, not words. It's the only exception to the rules above, and only to R1, R5 and R9 as described. Every other rule still applies. Don't mark a language symbolic just to get past a rule: it's for languages that truly have no keywords.

Beyond the automated rules, a new language also needs:

- **VS Code parity.** Auto-close pairs copied from the language's VS Code `language-configuration.json`. If VS Code has no built-in support for the language (COBOL), use the configuration of its most widely used VS Code extension and say which in a comment. If it has a language service, completion behaviour (triggers, commit characters, ranking) taken from VS Code's extension for that language, checked against its source rather than memory.
- **Snippets that are real code.** Idiomatic, the kind people actually write. Prefer declaring the types and names a snippet uses, so suggestions have something to work with. Names from code outside the snippet (`items`, `todos`) are fine as long as R8 passes.
- **Framework tracks** (Playwright, Selenium, pytest) are entries built on a language Syntype already has: spread the base language (`...typescript`), set `basedOn`, and add only what's new: snippets, plus a vocabulary pack (`seleniumPack`) or, for a language with a service, a type stub in `src/lib/ts/stubs.ts` (`@playwright/test`) loaded by both the worker and `src/test/tsCompleter.ts`. A track on a service language also needs an entry in `TEST_COMPLETERS` (R7). Tracks meet every rule like any language; their snippets must be self-contained, since R8 catches fragments that use names like `page` without declaring them.
- **Don't copy JavaScript's service settings** (`completion.service`, `serviceMode`, `triggerCharacters`) into a language that doesn't use TypeScript's service.

## Theme rules

Every theme in `THEMES` (`src/themes/index.ts`) must meet these; `src/themes/themes.test.ts` checks them. Colours live only in `src/themes/themes.css`, one `[data-syntype-theme="<id>"]` block per theme.

- **T1 · Complete.** A unique id, a picker section (`THEME_SECTIONS`), and one block setting every variable (`--bg` … `--tok-pun`, `--glow`, `--tab-dot`) and `color-scheme`. Syntype Dark's block and the System dark-mode block stay identical.
- **T2 · Swatches.** A theme's `swatches` name themes that exist.
- **T3 · Readable.** Contrast against the backgrounds of at least 4.5:1 for text (`--fg`, `--muted`), 4:1 for code colours, 2.5:1 for comments, and 3:1 for `--accent`, `--err` and `--ok`. When a borrowed palette falls short, use another colour from the same theme (One Dark Pro's status bar text for `--muted`) rather than inventing one.

- **T4 · Colour vision.** A theme made for a colour vision deficiency (`vision` in `THEMES`) keeps plain text, comments, mistakes and the five code colours at least 12 apart (CIEDE2000) from each other, both as its audience sees them (Machado et al. 2009 simulation, full severity, in `src/test/colour.ts`) and with normal vision; mistakes and success at least 30 apart; and its text and signal colours readable as its audience sees them. Pick colours from the base palette's own scales; don't trust a palette's colour-blind label without running the check (GitHub's own syntax colours fail it).

A theme borrowed from an editor takes its colours from that theme's source files, not memory, with the file named in a comment above its block.

## Working in this repo

- Commits are authored as Atif <alserembani94@gmail.com> (set in the repo's git config).
- Remote: https://github.com/alserembani94/syntype, branch `main`.
- The published page is the claude.ai artifact https://claude.ai/artifact/G6DgBP2VgTzXX7X3zabmyg. Update it from `dist-page/index.html` after `npm run build:page`.
