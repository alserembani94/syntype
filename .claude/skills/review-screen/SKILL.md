---
name: review-screen
description: Reviews a change to Syntype's UI against the design system rules (D1–D7, A1–A9 in CLAUDE.md), then asks before fixing. Use after changing a screen, component, composite, style or theme, or when asked to review a screen or its design-system compliance.
---

# Review a screen

Check a UI change against the design system and report what breaks which rule. This is a **review**: it ends with a report and a question, and changes no code until Atif answers.

The rules are CLAUDE.md's **Design system** (D1–D7, A1–A9) and **Theme rules** (T1–T5); `docs/design-system.md` says which component fits which job. Every finding cites one rule.

## 1. Scope

Find what changed: `git diff --name-only <base>` (default base: `origin/main`; for uncommitted work, `git status --short`). Map each file to the screens it can change, using the state ids in `scripts/visual/states.ts`:

| Changed | Screens (state ids) |
| --- | --- |
| `src/App.tsx`, `src/blocks/`, `CodeView`, `SuggestBox`, `ConfigBar`, `Results`, `Review`, `SpeedChart`, `src/styles/editor.css` | `typing-ready`, `typing-mid-run`, `typing-results`, `typing-review`; **typing screen**: also step 4 |
| `RunsView`, `ReplayView`, `AidTags` | `runs-overview`, `runs-snippet`, `runs-replay` |
| `LeaderboardView` | `board-overview`, `board-snippet`, `board-report`, `board-replay` |
| `Account*`, `AboutDialog`, `LanguagePicker`, `ThemePicker` | the Overlays states (`picker-*`, `about`, `sign-in`, `account-*`, `name-step`, `delete-account`, `toast`) |
| `src/admin/` | `admin-reports`, `admin-players`, `admin-activity` |
| `scripts/build-pages.mjs`, `src/seo/` | `privacy`, `fair-play`, `about` |
| `ViewParts.tsx`, `src/components/ui/`, `composites/` | `gallery`, `gallery-focus`, plus every screen that imports the file |
| `src/styles/` (other), `src/themes/`, `src/design/` | every state |

Scope is done when every changed file is mapped to its screens, or noted as not UI.

## 2. Read the change

Go through the diff line by line against the rules. Look for:

- **D1:** one-off sizes (`text-[13px]`, `p-[7px]`, a px font size in CSS) where a scale step fits.
- **D2:** colour literals (`#…`, `rgb(`, `hsl(`, named colours), primitives (`--syntype-…`, `--onedark-…`, `--primer-…`, `--vscode-…`) outside `src/design/` and `src/themes/`, palette classes.
- **D3:** a new stylesheet or class rules; hand-built versions of something the system has (a `<button>` with its own styles, a modal div, a list of cards that's really a table).
- **D4:** an interactive element missing hover, focus-visible, selected or disabled styling; a new component or composite without a gallery section.
- **D5:** `window.confirm`, a message written into the page instead of the toast, shadcn's `Table` for data, a menu that isn't `DropdownMenu`.
- **D6:** a transition or animation on something a keystroke changes, or one that ignores reduced motion.
- **A1–A9:** `title=` carrying information (use `Tip`); `autoFocus` that steals focus from where the person is (a field inside a tab panel); an `aria-label` that doesn't start with the visible text; icon buttons without a name; targets under 24 px; a scrolling region nothing inside can focus.
- **Docs:** a new component, variant or pattern missing from `docs/design-system.md`, or a rule change missing from CLAUDE.md.

Read is done when every changed line in a UI file has been read against every rule.

## 3. Run the checks

Run each, on the screens from step 1 (`--states a,b`; add `--themes light,dark,one-dark-pro` to keep it quick):

1. `npm test` (includes the design tests: no one-off font sizes, no stray stylesheets, the palette, gallery coverage, the gallery's axe).
2. `npm run check:controls` (every screen by real keyboard and pointer).
3. `npm run check:a11y -- --states <ids>` (axe; WCAG A/AA fail, contrast failures already listed as known don't).
4. `npm run check:visual -- --compare <base> --states <ids>`, then look at every changed image: is the content the same, and is each visual change one the diff meant?
5. **Typing screen touched:** `npm run bench:renders` (header and settings must render 0 times while typing) and `npm run bench:restyle -- --label after`, compared with the same on `<base>` (elements restyled per key must not rise).

Checks are done when each has run on every mapped screen and its output is read.

## 4. Report, then ask

Write the report as a list, most serious first. Each finding:

- **Rule** (D1–D7, A1–A9, T1–T5) and **where** (`file:line`, or the state and theme for a screenshot or axe finding).
- **What** happens, and **why** it matters for the rule.
- **Fix** you'd propose, in one line.

Then the checks: which ran, on which screens, and what each said, including the clean ones. End with a question: which findings to fix now. Fix nothing before the answer.
