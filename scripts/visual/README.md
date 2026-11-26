# Visual, accessibility and speed checks

Tooling for the design system work (and anything after it): every change to how
Syntype looks is compared against a baseline instead of judged by eye.

| Command | Does |
| --- | --- |
| `npm run check:visual` | Screenshots every state × theme × viewport into `.visual/<label>/`. `-- --compare <tag>` also captures that tag (in a git worktree, with its own scripts) and writes a pixel-diff report to `.visual/compare-<tag>/`. |
| `npm run check:a11y` | axe-core on the same pages. Fails on WCAG 2.0–2.2 A and AA rules; best practice is reported only. `-- --record` writes the report without failing. |
| `npm run bench:keys` | The keystroke benchmark (250 keys of the longest snippet at 1×, 4× and 6× CPU slowdown), locally or against a URL: `-- https://syntype.vercel.my`. |
| `npm run bench:renders` | Which parts of the typing screen render while typing, from React's profiling build (`<RenderMark>` regions, `src/lib/renderMark.tsx`). Fails if the header or settings row renders at all. Builds the profiling version into `dist/` and restores the normal build afterwards. |
| `npm run check:controls` | The typing screen's controls with a real keyboard and pointer: the settings row's toolbar keys, letters typed on a control going to the editor, Tab leaving controls, focus kept after a keyboard change, and the results keys (Enter, R, V). |
| `npm run bench:restyle` | What one keystroke costs, counted from a Chrome trace: elements restyled, style time, event handling and main-thread time per key. Steadier than `bench:keys` for comparing two builds. |
| `npm run check:csp` | Opens every kind of page (home, a language, My runs, leaderboard, policies, admin) on the local site with the real Content Security Policy and fails on any violation. |
| `npm run report:size` | Gzipped sizes from `dist/`: first load, lazy chunks, the TypeScript worker, admin, the artifact page. |
| `npm run visual:fixtures` | Regenerates the test data in `fixtures/` (rerun after editing a snippet it uses). |

Subsets: `--states a,b --themes a,b --viewports phone,desktop`. `--no-build` reuses `dist/`.

## How it stays repeatable

- **A local site with made-up data.** Each run builds the app, starts `wrangler dev` on port 8787 with a fresh local database (`.visual/state`), applies the migrations and `fixtures/seed.sql`. My runs states import `fixtures/history.json` through the app's own Import. Nothing comes from real players.
- **Throwaway secrets.** The server gets test values with `--var` (`config.ts`); `.dev.vars` is never read. Signed-in states carry a cookie signed with the test secret.
- **A fixed moment.** Playwright's clock starts at `FIXED_NOW`. Typing states pause it and replay a recorded run from the fixtures key by key, advancing the clock by each recorded gap, so results are identical every run.
- **No motion.** Reduced motion, animations frozen at capture, the text caret hidden and the smooth caret switched off (it glides into place frame by frame and can rest a sub-pixel apart). Every font face is loaded first, and a capture waits until no element has moved for 300 ms.
- **The same choices.** `Math.random` is seeded, so a language opens on the same snippet; pickers are opened from the keyboard, so the pointer doesn't hover a row; replays are paused at 40%.
- **Production build.** Vite (which runs these scripts) sets `NODE_ENV=development`; the build gets `production` back, or React's development build would be measured.

## Comparing

Images are compared with pixelmatch at a colour threshold of 0.015 (anti-aliased edges excluded), and an image counts as changed when more than 25 pixels differ. That catches a grey border moved seven steps (`compare.ts` has the numbers). Chromium is launched with rendering flags that keep runs identical (one colour profile, no font hinting, software raster).

About one page opening in ten still draws its text a shade differently: a few hundred scattered pixels nobody can see. In `--compare` mode, states with a changed image are captured again on both sides, up to twice, and an image counts only if it changed every time. A real change always repeats.

## Files

- `states.ts`: the 25 states and how each is opened. Add a state here when a screen is added.
- `walk.ts`: opens each state once per viewport and switches themes in place (the theme picker is reopened per theme).
- `make-fixtures.ts`: plays every fixture run through the real game (`src/test/harness.ts`).
- `run.mjs`: runs a script through Vite, which understands the languages' `?raw` imports.

The baseline before the design system revamp is the tag `ds-baseline`.
