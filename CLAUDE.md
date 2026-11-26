# Syntype

A typing speed test for code (Vite + React + TypeScript). See README.md for how it plays and how it's built.

## Commands

- `npm test`: all tests, including the language conformance suite. Run before every commit.
- `npm run lint`, `npx tsc -b`: must be clean.
- `npm run build`: regular build (the TypeScript worker is a separate file, and the leaderboard, My runs, About and Account & data views are loaded on demand).
- `npm run build:page`: one self-contained page in `dist-page/index.html`, used for the published artifact (its own build, with every view in one script and the worker gzipped inside the page).

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

- **VS Code parity.** Auto-close pairs copied from the language's VS Code `language-configuration.json`. If VS Code has no built-in support for the language (COBOL), use the configuration of its most widely used VS Code extension and say which in a comment. If it has a language service, completion behaviour (triggers, commit characters, ranking) taken from VS Code's extension for that language, checked against its source rather than memory. One deliberate difference, in the engine: Enter at a line break that auto-close already inserted (the closer moved down by an earlier Enter) steps over it rather than adding a blank line, because that's the key players press (`src/lib/engine.ts`).
- **Snippets that are real code.** Idiomatic, the kind people actually write. Prefer declaring the types and names a snippet uses, so suggestions have something to work with. Names from code outside the snippet (`items`, `todos`) are fine as long as R8 passes.
- **Framework tracks** (Playwright, Selenium, pytest) are entries built on a language Syntype already has: spread the base language (`...typescript`), set `basedOn`, and add only what's new: snippets, plus a vocabulary pack (`seleniumPack`) or, for a language with a service, a type stub in `src/lib/ts/stubs.ts` (`@playwright/test`) loaded by both the worker and `src/test/tsCompleter.ts`. A track on a service language also needs an entry in `TEST_COMPLETERS` (R7). Tracks meet every rule like any language; their snippets must be self-contained, since R8 catches fragments that use names like `page` without declaring them.
- **Its own page.** A line in `BLURBS` (`src/seo/site.ts`) on what its snippets cover, written from the snippets; it becomes the page `/<id>` with its own title and description (`src/seo/site.test.ts` checks it). Then re-render the link preview image, which counts the languages: `node scripts/og-image.mjs`.
- **Don't copy JavaScript's service settings** (`completion.service`, `serviceMode`, `triggerCharacters`) into a language that doesn't use TypeScript's service.

## Theme rules

Every theme in `THEMES` (`src/themes/index.ts`) must meet these; `src/themes/themes.test.ts` checks them. A theme is one `[data-syntype-theme="<id>"]` block in `src/themes/themes.css` setting semantic roles; colour values themselves live only in `src/design/primitives.css`.

Roles use shadcn's names (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1`…`5`, each with its `-foreground` where shadcn has one), plus `--destructive-muted`, `--success`, `--overlay`, `--shadow-color`, the code colours (`--code-keyword` … `--code-punctuation`, `--code-glow`) and `--tab-indicator`. As in shadcn, `--primary` is the brand colour and `--accent` the soft highlight behind hovered and selected items. Style the app with roles only, never primitives or literal colours; translucent uses mix a role (`color-mix(in srgb, var(--overlay) 45%, transparent)`).

- **T1 · Complete.** A unique id, a picker section (`THEME_SECTIONS`), and one block setting every role (the `ROLES` list in the test), `--code-glow` and `color-scheme`. Every role is registered with `@property` so theme changes cross-fade. Syntype Dark's block and the System dark-mode block stay identical.
- **T2 · Swatches.** A theme's `swatches` name themes that exist.
- **T3 · Readable.** Contrast against the backgrounds of at least 4.5:1 for text (`--foreground`, `--muted-foreground`, and each `-foreground` on its fill), 4:1 for code colours and for mistakes on their tint (`--destructive` on `--destructive-muted`), 2.5:1 for comments, and 3:1 for `--primary`, `--destructive`, `--success` and the chart colours. Chart colours stay at least 12 apart (CIEDE2000). When a borrowed palette falls short, use another colour from the same theme (One Dark Pro's status bar text for `--muted-foreground`) rather than inventing one. Failures known before the contrast round are listed in `KNOWN_FAILURES` in the test; the list may only shrink.
- **T4 · Colour vision.** A theme made for a colour vision deficiency (`vision` in `THEMES`) keeps plain text, comments, mistakes and the five code colours at least 12 apart (CIEDE2000) from each other, both as its audience sees them (Machado et al. 2009 simulation, full severity, in `src/test/colour.ts`) and with normal vision, and its chart colours 12 apart as its audience sees them; mistakes and success at least 30 apart; and its text and signal colours readable as its audience sees them. Pick colours from the base palette's own scales; don't trust a palette's colour-blind label without running the check (GitHub's own syntax colours fail it).
- **T5 · Own palette.** Every value in a theme's block is `var()` of a primitive from that theme's own family (`--syntype-…`, `--onedark-…`, `--primer-light-…`, `--primer-dark-…`, `--vscode-…`), never a literal colour. High Contrast's two `--vscode-hc-exception-…` tints are the only exceptions, until its outline replaces them.

A theme borrowed from an editor takes its colours from that theme's source files, not memory: add them to `primitives.css` with their source key, and name the file in a comment above the theme's block. Borrowed primitives are checked against snapshots in `src/design/sources/` (regenerate with `node scripts/design/sources.mjs`, then review the diff); Syntype's own are named `<family>-<step>` by OKLCH lightness. `src/design/primitives.test.ts` checks both. Old token names (`--bg`, `--accent-soft`, `--tok-kw`, `--f-ui` …) are retired, and a test fails if one comes back.

## SEO

The site is https://syntype.vercel.my (`SITE_URL` in `src/seo/site.ts`). `npm run build` writes a page per language (`dist/python.html`, served at `/python`) plus `sitemap.xml` and `robots.txt` (`scripts/build-pages.mjs`), each page with its own title, description, canonical URL, link preview tags, structured data and an intro in the HTML itself. Titles stay within 60 characters and descriptions within 70–160 (`src/seo/site.test.ts`). The FAQ in `scripts/build-pages.mjs` describes how the app behaves: keep it true when that changes. The same goes for the privacy and fair-play pages (`src/seo/policies.ts`): when what's stored, kept, shared or checked changes, change them too.

## Leaderboard (planned)

`docs/leaderboard.md` is the agreed design for the personal board and the global leaderboard: what is stored on the device and the server, the rules, moderation, privacy and the cost limits. Follow it when building them, and update it when a decision changes.

The admin page (`/admin`, `src/admin/`) sits behind Cloudflare Access. Every `/api/admin/*` route must go through `accessEmail` (`worker/lib/access.ts`), which checks Access's signed token, and every admin change must be written to `admin_actions`.

## Performance

Typing must stay fast on slow phones. `CodeView` renders the snippet as memoised lines, so a keystroke re-renders only the caret's line, and untyped code is dimmed by mixing its colour (`--tc`, `--a` in `src/index.css`), never with `opacity` on characters: hundreds of elements with their own opacity made every keystroke repaint the whole snippet (about 47 ms a key with the CPU slowed 4×; about 6 ms now). Measure a change to the editor's rendering or CSS on the longest snippet before and after.

While typing, only the editor and the status bar render. The header and the settings row are memoised blocks (`src/blocks/`) whose handlers come through `useStableCallback`, because the controls around the editor redraw on every keystroke otherwise: cheap as plain buttons, but ten React Aria controls left unmemoised add 2.5–3.1 ms of React work per key at 4× slowdown, nearly tripling it. `npm run bench:renders` checks it and fails if either renders while typing; run it after any change to the typing screen. Tooling for screenshots, accessibility and speed is in `scripts/visual/README.md`.

## Security headers

`public/_headers` sets a Content Security Policy on every page. `scripts/build-pages.mjs` builds it, hashing the inline code it finds in the built pages, so inline scripts and handlers are covered automatically. Anything loaded from another origin (a script, stylesheet, font, frame or API) needs that origin added to the policy there, or browsers will block it.

## Working in this repo

- Commits are authored as Atif <alserembani94@gmail.com> (set in the repo's git config).
- Remote: https://github.com/alserembani94/syntype, branch `main`.
- The published page is the claude.ai artifact https://claude.ai/artifact/G6DgBP2VgTzXX7X3zabmyg. Update it from `dist-page/index.html` after `npm run build:page`.
