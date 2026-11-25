# Syntype

A typing speed test for code (Vite + React + TypeScript). See README.md for how it plays and how it's built.

## Commands

- `npm test`: all tests, including the language conformance suite. Run before every commit.
- `npm run lint`, `npx tsc -b`: must be clean.
- `npm run build`: regular build (the TypeScript worker is a separate file).
- `npm run build:page`: one self-contained page in `dist-page/index.html`, used for the published artifact.

## Language rules

Every language must meet these. `src/languages/conformance.test.ts` checks them for every entry in `LANGUAGES`, so adding a language to the registry is enough to hold it to all of them. When adding or changing a language, go through this list; when a rule changes, change it here and in that test together.

- **R1 · Identity.** A unique `id`, a display `name`, a lowercase `extension` without a dot, and highlighting keywords.
- **R2 · Variety.** At least 4 snippets for each length: short (under 120 characters), medium (up to 300) and long. More is welcome.
- **R3 · Snippet names.** Unique within the language, each ending in the language's extension (`debounce.js`).
- **R4 · Formatting.** Printable ASCII only; no trailing spaces; indentation in 2-space steps; lines of 88 characters or fewer; no leading blank line.
- **R5 · Highlighting.** The language's highlight rules tokenize every snippet, and its keywords are highlighted in them.
- **R6 · Playable without a service.** Every snippet can be typed literally to the end with auto-indent, auto-close and basic suggestions on, without a single wrong character. This is the experience before a language service is ready.
- **R7 · Service stand-in.** A language with a completion service has a synchronous stand-in for it in `TEST_COMPLETERS` (`src/test/harness.ts`).
- **R8 · Commit characters are safe.** With the service, typing every snippet literally never lets a commit character (`.` `,` `;` `(`) insert a wrong word. If one does, it's usually an undeclared name that fuzzy-matches something else: declare or import it in the snippet (as `server.js` imports `db`).
- **R9 · Suggestions help.** Accepting suggestions whenever the right word is selected finishes every snippet without mistakes and saves keystrokes overall.

Beyond the automated rules, a new language also needs:

- **VS Code parity.** Auto-close pairs copied from the language's VS Code `language-configuration.json`. If it has a language service, completion behaviour (triggers, commit characters, ranking) taken from VS Code's extension for that language, checked against its source rather than memory.
- **Snippets that are real code.** Idiomatic, the kind people actually write. Prefer declaring the types and names a snippet uses, so suggestions have something to work with. Names from code outside the snippet (`items`, `todos`) are fine as long as R8 passes.
- **Don't copy JavaScript's service settings** (`completion.service`, `serviceMode`, `triggerCharacters`) into a language that doesn't use TypeScript's service.

## Working in this repo

- Commits are authored as Atif <alserembani94@gmail.com> (set in the repo's git config).
- Remote: https://github.com/alserembani94/syntype, branch `main`.
- The published page is the claude.ai artifact https://claude.ai/artifact/G6DgBP2VgTzXX7X3zabmyg. Update it from `dist-page/index.html` after `npm run build:page`.
