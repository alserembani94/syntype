# Contrast testing

How Syntype checks that every theme is readable, and what to run when a theme
is added or changed. The first full round (November 2026) is the baseline;
its findings and the colour vision study are in the contrast round's report.

## What WCAG asks

| Criterion | Applies to | AA | AAA (information only) |
| --- | --- | --- | --- |
| 1.4.3 Contrast (minimum) | text, including code | 4.5:1, or 3:1 for large text (24px, or 18.66px bold) | 1.4.6: 7:1 / 4.5:1 |
| 1.4.11 Non-text contrast | input borders, focus rings, selected and checked states, chart marks, the caret | 3:1 against what's next to it | — |
| 1.4.1 Use of colour | anything that means something | never colour alone | — |

Exempt by WCAG: disabled controls, pure decoration, logos, and text no one
can see. `aria-hidden` doesn't make text exempt: sighted players still read
it, so the gutter's line numbers count. An exemption carries its reason in
`pairs.ts` (`exempt`).

Ratios are WCAG's relative luminance formula. A translucent colour is
measured as drawn: composited over its real background first (Tailwind's
`bg-x/50` and the editor's `color-mix(in srgb, …)` both equal sRGB alpha
compositing).

## Two measurements, because neither is enough alone

1. **Role pairs** (`src/themes/pairs.ts`, run by
   `scripts/design/contrast-roles.ts`). Every pair of roles the
   app draws, resolved through `themes.css` and `primitives.css` for every
   theme, with its WCAG threshold and where it appears. This covers what a
   page test can't: the editor's code (axe skips single-character spans as
   `shortTextContent`, so it never measures code), non-text contrast (axe
   only checks text), and states that are hard to reach in a browser
   (pressed, dimmed, mid-run).
2. **Pages** (`scripts/visual/contrast.ts`). axe's `color-contrast` rule on
   every state × theme × viewport the visual tooling walks, keeping the data
   for passes as well as failures: what the browser actually composited,
   including anything a role pair forgot. Elements axe couldn't measure are
   counted with axe's reason.

`npm run report:contrast` runs both, plus the colour vision study, and
writes `.visual/contrast/roles.json`, `pages.json` and `cvd.json`, then the
report page `.visual/contrast/report/index.html`
(`scripts/design/contrast-report.ts`, whose `NOTES` hold the reviewer's
comments for the round). The page measurement walks every state, theme and
viewport, about 25 minutes; narrow it with `--themes` while working on one
theme. Take the report's screenshots first:
`npm run check:visual -- --no-build --label contrast-shots --states typing-mid-run,typing-results --viewports desktop`.

For colour vision themes, `scripts/design/cvd-study.ts` adds the simulated
view (below).

## Which themes meet WCAG AA

Themes come in two tiers. Those flagged `wcag: 'AA'` in `THEMES` (System,
Syntype Light and Dark, Dark High Contrast and the three colour vision
themes) are held to WCAG 2.2 AA in every pair by rule T6 in
`src/themes/themes.test.ts`, using the pair list in `src/themes/pairs.ts`. The
others (One Dark Pro, GitHub Light, Green Phosphor) stay faithful to their
sources: they meet the floor in T3, and the report shows their WCAG results
for information.

Failures known when the flag went on are listed in `KNOWN_AA_FAILURES`, one
line per theme and pair (`"light: Comment"`, with `(as seen)` for a colour
vision theme's simulated view). A new failure fails the test, and so does a
listed pair that now passes, until it's taken off. The list may only shrink.

## Adding or changing a theme

1. Add its block (`themes.css`) and primitives as the theme rules say.
2. Run `npm run report:contrast`. Every role pair must reach its WCAG
   threshold; the script prints failures per theme. `themes.test.ts` (T3)
   checks the subset it covers on every `npm test`.
3. Read the page results for the new theme: any `fail` is a real failure;
   look at `reviews` for anything axe couldn't measure, and check those by
   eye in the screenshots.
4. When a role pair is new (a new component draws a new combination), add it
   to `src/themes/pairs.ts` with where it appears, so every flagged theme is
   held to it.
5. To flag a theme as meeting AA, set `wcag: 'AA'`; it must pass T6 with no
   entries in the known list.
6. For a colour vision theme, also run the study and meet T4.

### When a borrowed palette falls short

Take a darker or lighter step of the same hue from the same palette (Primer's
`display-*-scale-N`, Syntype's `<family>-<step>`), or a colour the palette
already uses for that purpose elsewhere (One Dark Pro's status bar text),
rather than inventing one. Record it in a comment next to the theme's block.

## Colour vision

The three deficiencies the themes target, and what each changes:

| | Missing cone | Confuses | Keeps | Prevalence |
| --- | --- | --- | --- | --- |
| Protanopia | long (red) | red with green, brown and olive; reds look dark | blue against yellow | about 1% of men |
| Deuteranopia | medium (green) | red with green, at full brightness | blue against yellow | about 1% of men (deuteranomaly, the milder form, about 5%) |
| Tritanopia | short (blue) | blue with green, yellow with pink and light grey | red against cyan | about 1 in 10,000, men and women alike |

The simulation is Machado, Oliveira & Fernandes (2009) at full severity
(`src/test/colour.ts`); its tritan model is an approximation. Distances are
CIEDE2000 (ΔE): about 2 is barely noticeable side by side, 12 is the floor
for colours that must be told apart at a glance in running text.

Principles from palettes designed for it (Okabe & Ito; Paul Tol):

- Separate colours by lightness as well as hue; lightness survives every
  deficiency.
- For protan and deutan, build on the blue–orange/yellow axis, which they
  keep; never rely on red against green.
- For tritan, build on the red–cyan axis; never rely on blue against green
  or yellow against pink.
- Pair every colour meaning with a second cue (underline for mistakes, a
  word or icon for results).

`scripts/design/cvd-study.ts` scores each vision theme as its audience sees
it, scores the Okabe–Ito and Tol palettes the same way for reference, and
searches Primer's dark display scales (the vision themes' palette, T5) for
the code colours that stay furthest apart as seen while reading at 4.5:1 on
the editor both as seen and with normal vision.
