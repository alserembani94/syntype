# Syntype

A typing speed test for code (Vite + React + TypeScript). See README.md for how it plays and how it's built.

## Commands

- `npm test`: all tests, including the language conformance suite. Run before every commit.
- `npm run lint`, `npx tsc -b`: must be clean.
- `npm run build`: regular build (the TypeScript worker is a separate file, and the leaderboard, My runs, About and Account & data views are loaded on demand).
- `npm run build:page`: one self-contained page in `dist-page/index.html`, used for the published artifact (its own build, with every view in one script and the worker gzipped inside the page).
- `npm run build:gallery`: the design system gallery as one page in `dist-gallery/index.html`, for its review artifact.

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

Roles use shadcn's names (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1`…`5`, each with its `-foreground` where shadcn has one), plus `--input-border` (the edge of text fields, checkboxes, radios and a switch's off track; `--input` stays for their fills), `--destructive-muted`, `--success`, `--overlay`, `--shadow-color`, the code colours (`--code-keyword` … `--code-punctuation`, `--code-glow`) and `--tab-indicator`. As in shadcn, `--primary` is the brand colour and `--accent` the soft highlight behind hovered and selected items. Style the app with roles only, never primitives or literal colours; translucent uses mix a role (`color-mix(in srgb, var(--overlay) 45%, transparent)`).

- **T1 · Complete.** A unique id, a picker section (`THEME_SECTIONS`), and one block setting every role (the `ROLES` list in the test), `--code-glow` and `color-scheme`. Every role is registered with `@property` so theme changes cross-fade. Syntype Dark's block and the System dark-mode block stay identical.
- **T2 · Swatches.** A theme's `swatches` name themes that exist.
- **T3 · Readable.** The floor for every theme, below WCAG where a borrowed palette needs it (T6 is WCAG itself, for flagged themes). Contrast against the backgrounds of at least 4.5:1 for text (`--foreground`, `--muted-foreground`, and each `-foreground` on its fill), 4:1 for code colours and for mistakes on their tint (`--destructive` on `--destructive-muted`), 2.5:1 for comments, and 3:1 for `--primary`, `--destructive`, `--success`, the chart colours and `--input-border` (on the page, cards, dialogs and muted panels). Chart colours stay at least 12 apart (CIEDE2000). When a borrowed palette falls short, use another colour from the same theme (One Dark Pro's status bar text for `--muted-foreground`) rather than inventing one. Failures known before the contrast round are listed in `KNOWN_FAILURES` in the test; the list may only shrink.
- **T4 · Colour vision.** A theme made for a colour vision deficiency (`vision` in `THEMES`) keeps plain text, comments, mistakes and the five code colours at least 12 apart (CIEDE2000) from each other, both as its audience sees them (Machado et al. 2009 simulation, full severity, in `src/test/colour.ts`) and with normal vision, and its chart colours 12 apart as its audience sees them; mistakes and success at least 30 apart, and success 12 apart from the five code colours; and its text and signal colours readable as its audience sees them. Pick colours from the base palette's own scales; don't trust a palette's colour-blind label without running the check (GitHub's own syntax colours fail it).
- **T5 · Own palette.** Every value in a theme's block is `var()` of a primitive from that theme's own family (`--syntype-…`, `--onedark-…`, `--primer-light-…`, `--primer-dark-…`, `--vscode-…`), never a literal colour. High Contrast's two `--vscode-hc-exception-…` tints are the only exceptions, until its outline replaces them.
- **T6 · Meets WCAG AA.** A theme flagged `wcag: 'AA'` in `THEMES` meets WCAG 2.2 AA in every colour pair the app draws: 4.5:1 for text (code, comments, dimmed untyped code and line numbers included), 3:1 for large text and non-text (input borders, focus rings, states, charts). The pairs, with where each is drawn, are in `src/themes/pairs.ts`; the editor's dimming is read from `editor.css`, so they follow it. A colour vision theme passes both with normal vision and as its audience sees it. System is flagged only if Syntype Light and Dark both are. Failures known when the flag went on are in `KNOWN_AA_FAILURES`; the list may only shrink. One Dark Pro is the one theme left outside AA: it stays faithful to its source's comment and error colours (`docs/contrast-testing.md` lists its gaps). A new theme starts flagged and clean, as Light High Contrast did. When a component draws a new colour combination, add it to `pairs.ts`.

WCAG contrast is checked beyond T3 by `npm run report:contrast`; `docs/contrast-testing.md` is the process to follow for a new or changed theme.

A theme borrowed from an editor takes its colours from that theme's source files, not memory: add them to `primitives.css` with their source key, and name the file in a comment above the theme's block. Borrowed primitives are checked against snapshots in `src/design/sources/` (regenerate with `node scripts/design/sources.mjs`, then review the diff); Syntype's own are named `<family>-<step>` by OKLCH lightness. `src/design/primitives.test.ts` checks both. Old token names (`--bg`, `--accent-soft`, `--tok-kw`, `--f-ui` …) are retired, and a test fails if one comes back.

## Design system

`docs/design-system.md` describes each layer, component and composite: when to use it, when not, and examples from our code. The gallery (`/admin/gallery`; `npm run build:gallery` for its artifact) shows each one in every state and theme. Read both before building UI, and run the `review-screen` skill after changing a screen.

Styles go through Tailwind CSS 4 (`src/styles/system.css`, imported by `app.css` and `admin.css`). Layers, lowest first: theme (primitives and theme blocks), base (Tailwind's reset, then `base.css`), components (`editor.css`), utilities. Everything is styled with utilities except the editor, which keeps hand-written CSS on the roles because every keystroke goes through it (see Performance). There is no legacy layer; a test keeps it gone.

- **D1 · Scale.** Sizes, spacing, radii, shadows and durations come from the primitives' scales (`text-sm`, `rounded-lg`, `shadow-md`); a size the scale lacks becomes a step in `primitives.css` first (`text-2xs`, `text-display-sm`), because one-off values are how 18 font sizes happened. Arbitrary values are for layout geometry only (grid templates, `calc()` positions). The exceptions are shadcn's own components as installed and the editor's VS Code–like 13px and 10px in `editor.css`. Tailwind's own palette and type scale are off, and `src/styles/tailwind.test.ts` fails on a one-off font size in our code.
- **D2 · Roles only.** Colours are the theme roles (`bg-primary`, `text-muted-foreground`, `var(--border)` in `editor.css`), never primitives, palette classes (`bg-slate-500` doesn't exist) or literals; translucent uses mix a role (`bg-overlay/45`, `color-mix(in srgb, var(--overlay) 45%, transparent)`). Themes swap roles, so anything else breaks in some theme. `tailwind.test.ts`, `ui.test.ts` and `ui:add`'s palette guard check it.
- **D3 · Reuse first.** Use a shadcn component or one of our composites; add a variant or a composite before a one-off, and a new stylesheet only with a reason as strong as the editor's. One look per thing is what keeps the app consistent. `tailwind.test.ts` fails on any other stylesheet.
- **D4 · Every state.** Anything interactive styles hover, focus-visible, selected or pressed, and disabled, and appears in the gallery in each (`src/gallery/coverage.test.ts` requires a section per component and composite).
- **D5 · One of each.** Modals are `Dialog`, `AlertDialog` or `Sheet`; menus `DropdownMenu`; messages the toast (`useToast`); data tables the native `DataTable` composite (shadcn's Table on the Aria base is React Aria's interactive grid, wrong for data that's read); chip rows `Choice` and `Toggles`. Each brings its focus handling and announcements with it.
- **D6 · Motion.** Durations from the scale; reduced motion respected (tw-animate's animations and `editor.css` do); no CSS transition on anything a keystroke changes (see Performance).
- **D7 · Contrast on what's drawn.** T6 covers every pair components draw in AA themes (`src/themes/pairs.ts`; add a pair when a component draws a new combination); the gallery's axe test records the contrast failures left (One Dark Pro's) in a snapshot, and every known list may only shrink.

Accessibility, to WCAG 2.2 AA:

- **A1 · Keyboard.** Everything works by keyboard alone, in a sensible order, with no trap outside a modal. `ownsKey` (`src/lib/keyTarget.ts`) decides which keys a focused control keeps from the typing handler. `npm run check:controls` drives every screen with a real keyboard.
- **A2 · Focus.** One focus ring (shadcn's `focus-visible` ring) on everything focusable, never hidden or clipped.
- **A3 · Targets.** At least 24 × 24 px; shadcn's `icon-xs` is the floor.
- **A4 · Not only colour or `title`.** Meaning never rides on colour alone (links in text keep their underline, `base.css`) or on `title`, which keyboard and touch users never see: use `Tip`.
- **A5 · Overlays.** From React Aria (D5): focus contained and returned, the page behind hidden from assistive tech.
- **A6 · Announcements.** Results and toasts are announced politely, errors as alerts (the toast's error tone, `role="alert"`).
- **A7 · Motion.** Reduced motion respected (D6). Forced-colours mode isn't styled yet: ask Atif before relying on it.
- **A8 · Reflow.** Works at 320 px wide and at 200% zoom; wide tables scroll inside their own box (`DataTable`).
- **A9 · Checked.** `npm run check:a11y` runs axe on every page in every theme and fails on WCAG A and AA rules. An exemption needs a stated reason (`EXEMPTIONS` there, `src/test/axe.ts` in tests); the only contrast exemption is One Dark Pro's, which stays faithful to its source.

Working with components:

- Components come from shadcn (Nova style on React Aria; `components.json`) into `src/components/ui`, and only through `npm run ui:add <name>` (`scripts/ui-add.ts`): it keeps the CLI from changing our stylesheets, rewrites the reviewed non-role colours (`REWRITES` in `scripts/design/palette.ts`, each with a reason) and fails on any other colour Tailwind can't draw. `render.test.tsx` renders each one.
- `ui:add` won't replace an installed component without `--overwrite`. When a shadcn file needs a change, edit it in place and mark it with a `Local edit:` comment, so an update can't silently drop it.
- Tailwind scans files, not imports: the site's CSS includes a component's classes only when `src/styles/app.css` lists it (a test keeps that list equal to what the site imports, `import()` included); admin's CSS includes them all. Pages written by `scripts/build-pages.mjs` (policy pages, the About section) use utility classes too, and `app.css` scans that script.
- Our composites live in `src/components/composites`, the parts My runs and the leaderboards share in `src/components/ViewParts.tsx`.
- Behaviour that needs a real browser (focus, keyboard, overlays, announcements, axe) is tested in `*.browser.test.tsx`, which `npm test` runs in Chromium through Vitest's browser mode (`src/test/mount.tsx`, `src/test/axe.ts`).
- The shadcn agent skill (`.claude/skills/shadcn`) is installed, edited to use the pinned CLI; its theming and preset advice doesn't apply here.

## SEO

The site is https://syntype.vercel.my (`SITE_URL` in `src/seo/site.ts`). `npm run build` writes a page per language (`dist/python.html`, served at `/python`) plus `sitemap.xml` and `robots.txt` (`scripts/build-pages.mjs`), each page with its own title, description, canonical URL, link preview tags, structured data and an intro in the HTML itself. Titles stay within 60 characters and descriptions within 70–160 (`src/seo/site.test.ts`). The FAQ in `scripts/build-pages.mjs` describes how the app behaves: keep it true when that changes. The same goes for the privacy and fair-play pages (`src/seo/policies.ts`): when what's stored, kept, shared or checked changes, change them too.

## Leaderboard (planned)

`docs/leaderboard.md` is the agreed design for the personal board and the global leaderboard: what is stored on the device and the server, the rules, moderation, privacy and the cost limits. Follow it when building them, and update it when a decision changes.

The admin page (`/admin`, `src/admin/`) sits behind Cloudflare Access. Every `/api/admin/*` route must go through `accessEmail` (`worker/lib/access.ts`), which checks Access's signed token, and every admin change must be written to `admin_actions`.

## Performance

Typing must stay fast on slow phones. `CodeView` renders the snippet as memoised lines, so a keystroke re-renders only the caret's line, and each character's state is drawn by mixing its token colour with the secondary text colour (`--tc`, `--a` in `src/styles/editor.css`; untyped code is plain grey), never with `opacity` on characters: hundreds of elements with their own opacity made every keystroke repaint the whole snippet (about 47 ms a key with the CPU slowed 4×; about 6 ms now). Measure a change to the editor's rendering or CSS on the longest snippet before and after.

While typing, only the editor and the status bar render. The header and the settings row are memoised blocks (`src/blocks/`) whose handlers come through `useStableCallback`, because the controls around the editor redraw on every keystroke otherwise: cheap as plain buttons, but ten React Aria controls left unmemoised add 2.5–3.1 ms of React work per key at 4× slowdown, nearly tripling it. `npm run bench:renders` checks it and fails if either renders while typing; run it after any change to the typing screen. Overlays stay out of the first load: the pickers, the account dialogs and menu, About and the views behind the header load on demand (`lazy()`), and the pickers are fetched once the page is idle so a shortcut opens them at once; check `npm run report:size` when adding one. Don't put CSS transitions on anything a keystroke changes (the code's characters, the caret aside): React Aria listens for transition events on the whole page, so each one costs script time per key (a 60 ms colour fade on typed characters made typing about 1.5 ms slower per key at 4×). `npm run bench:restyle` counts what one keystroke costs (elements restyled, style time, event handling, main-thread time) exactly enough to compare two builds when `bench:keys` is too noisy. Tooling for screenshots, accessibility and speed is in `scripts/visual/README.md`.

## Security headers

`public/_headers` sets a Content Security Policy on every page. `scripts/build-pages.mjs` builds it, hashing the inline code it finds in the built pages, so inline scripts and handlers are covered automatically. Anything loaded from another origin (a script, stylesheet, font, frame or API) needs that origin added to the policy there, or browsers will block it. `npm run check:csp` opens every kind of page with the real policy and fails on any violation; run it after changing how scripts or styles are built or loaded.

## Working in this repo

- Commits are authored as Atif <alserembani94@gmail.com> (set in the repo's git config).
- Remote: https://github.com/alserembani94/syntype, branch `main`.
- The published page is the claude.ai artifact https://claude.ai/artifact/G6DgBP2VgTzXX7X3zabmyg. Update it from `dist-page/index.html` after `npm run build:page`.
