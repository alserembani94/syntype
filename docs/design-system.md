# Syntype's design system

How Syntype's UI is built, one entry per component and composite: when to use it, when not, its default, a good and a bad example from our code, and its states. The rules themselves (D1–D7, A1–A9, T1–T5) live in CLAUDE.md, and the gallery (`/admin/gallery`) shows every entry here in every state and theme. Only what's built is here; anything undecided says **ask Atif**.

## Layers

| Layer | Where | What goes in it |
| --- | --- | --- |
| Primitives | `src/design/primitives.css` | Raw values: one palette per theme family (from the theme's source files), and the scales for type, radius, shadow, motion and spacing. A new size starts here (D1). |
| Roles | `src/themes/themes.css` | One block per theme giving every role (`--primary`, `--muted-foreground`, `--code-keyword` …) a primitive from that theme's own palette (T5). |
| Utilities | `src/styles/tailwind-theme.css` | Tailwind exposes each role as utilities (`bg-primary`, `text-muted-foreground`) and `dark:` as the dark themes. No other colours exist (D2). |
| Components | `src/components/ui/` | shadcn's, Nova style on React Aria, installed with `npm run ui:add` and kept as installed apart from marked `Local edit:` comments. |
| Composites | `src/components/composites/` | Ours, built from components: the picker, the toast, chip rows and others below. |
| Blocks | `src/blocks/`, `src/components/ViewParts.tsx` | Pieces of real screens: the header, the settings row, a view's title row, a stat card. |
| The editor | `src/styles/editor.css` | The one hand-written stylesheet: the code, caret, suggestion box and charts, kept as plain CSS on the roles because every keystroke goes through it. |

Not decided yet, so **ask Atif** first: a warning colour (there's no `--warning` role), forced-colours (Windows High Contrast) styling, and a sheet for pickers on phones (they're top-anchored dialogs today).

## Components

Each entry: **Use** · **Not for** · **Default** · good (✓) and bad (✗) from our code · **States** the gallery shows.

### Actions

**Button** (`ui/button.tsx`). Use: anything that does something on press. Not for: going to a URL (`LinkButton`), on/off state (`Toggle`). Default: `variant="default"` (filled primary) for a view's main action, `outline` for the rest, `ghost` for icon buttons in a row, `destructive` for removing or hiding, `link` inside a sentence or a table row. Size `sm` in dense places (admin, storage row), `icon-sm`/`icon-lg` for icons with an `aria-label` and a `Tip`.
✓ `Type this snippet` in `RunsView.tsx` (`<Button onPress={onType}>`). ✓ Results' Next: `variant="ghost" size="icon-lg"` with `Tip` and `aria-label`.
✗ A `<button className="btn">` with its own CSS (the old legacy buttons). ✗ An icon button without `aria-label`.
States: default, hover, focus-visible, pressed, disabled (`isDisabled`), each variant.

**LinkButton** (`ui/button.tsx`). Use: a link that looks like a button (Admin's Back to Syntype, Watch replay). Not for: in-app navigation that isn't a URL change (use `Button` with `onPress`).

**Toggle** (`ui/toggle.tsx`). Use: one on/off action with state, like the results' Review. Not for: a setting with a label (`LabelledSwitch`), a group of chips (`Toggles`). Default: style the selected state with the app's highlight (`aria-pressed:bg-accent aria-pressed:text-primary`), as `Results.tsx` does.

**ToggleGroup** (`ui/toggle-group.tsx`). Use it through `Choice` and `Toggles` below, which add our selected style and the shared key handling.

### Forms

**Input** with **Field**, **FieldLabel**, **FieldDescription** (`ui/input.tsx`, `ui/field.tsx`). Use: any text entry, always inside a `Field` with a visible label; hints and errors in `FieldDescription`, linked with `aria-describedby`. Not for: search over a list (`Picker`). Its edge is `--input-border`, which every theme holds to 3:1 against the page (WCAG 1.4.11); `--input` is only its fill. Checkboxes, radios and a switch's off track use the same edge.
✓ The name step in `AccountDialogs.tsx`: `Field` → `FieldLabel htmlFor` → `Input aria-invalid aria-describedby` → `FieldDescription`.
✗ A placeholder as the only label. ✗ `autoFocus` on a field that appears when a tab opens: it pulls focus off the tabs (fixed in Admin's player search).
States: default, focus, invalid, disabled.

**Textarea** (`ui/textarea.tsx`). The report note. Same rules as Input.

**Checkbox** and **Switch** (`ui/checkbox.tsx`, `ui/switch.tsx`). Use them through `LabelledCheckbox` and `LabelledSwitch`, so the visible text names and toggles the control. Checkbox for a choice in a form (Show me on the leaderboards); Switch for a setting that applies at once (Smooth caret).

**RadioGroup** (`ui/radio-group.tsx`). Use: one of a few options with explanations (the report's reasons). Not for: a short chip row (`Choice`).

**Slider** (`ui/slider.tsx`). Use: a position or amount (the replay's position). Keyboard: ← → step, Page Up/Down a tenth, Home/End.

### Overlays

**Dialog** (`ui/dialog.tsx`). Use: a task that needs the person's attention (sign in, your name, Account & data). Default: a `DialogTitle`, close button, `DialogFooter` for the actions; account dialogs go through `AccountDialog` (`AccountDialogs.tsx`), which pins them to the top on phones. The backdrop dims 45% (a local edit). Not for: a yes/no about something destructive (`AlertDialog`), a list of actions (`DropdownMenu`), a message (toast).
✗ A hand-made modal div with its own focus trap (four existed before step 11).
States: open, with its focus inside; closing returns focus.

**AlertDialog** (`ui/alert-dialog.tsx`). Use: confirming something destructive or hard to undo (Clear runs, Remove run, Sign out everywhere). Default: focus on Cancel (`autoFocus`), the action `variant="destructive"`. Admin's `Confirmed` helper wraps a button and its dialog.
✗ `window.confirm()`: unthemed, and different in every browser.

**DropdownMenu** (`ui/dropdown-menu.tsx`). Use: a list of actions under a button (the account menu). Opened from the keyboard, focus starts on the first item.

**Tooltip** (`ui/tooltip.tsx`). Use it through `Tip`.

**Popover**, **Sheet**, **Collapsible**: installed and in the gallery, not used by the app yet. Ask Atif before introducing one on a screen.

### Display

**Card** (`ui/card.tsx`). Use: a group of content on the page (summary stats, a reported player, a table's frame with `className="py-0"`). Not for: a dialog's body.

**Badge** (`ui/badge.tsx`). Use: a short label on a value (“best”, “you”, a report reason, a typing aid). Default: `outline`; `destructive` for problems; through `Mark` in tables.

**Breadcrumb** (`ui/breadcrumb.tsx`). Use it through `Crumbs`.

**Empty** (`ui/empty.tsx`). Use it through `Note`: nothing to show, or a failure.

**Kbd** (`ui/kbd.tsx`). Use: a key in text (the hints under the editor, the results' hint line). Through `Shortcut` inside tooltips.

**Skeleton** (`ui/skeleton.tsx`). Use it through `TableSkeleton` while a table loads. Local edit: `bg-foreground/10`, visible on dark cards.

**Spinner**, **Separator**, **Alert**, **Tabs**: Tabs for sections of one page (admin); Alert for a problem inside a form (the report dialog). Spinner and Separator are in the gallery, not used on screens yet.

**Table** (`ui/table.tsx`) is React Aria's interactive grid on this base: don't use it for data. Use `DataTable`.

## Composites

**Choice** and **Toggles** (`composites/choices.tsx`). Use: a row of chips: one of several (`Choice`: length, filters, speed), or any number on/off (`Toggles`: typing aids). One Tab stop, ← → inside; options take an optional `tip`. Default: `Choice` filled, `outline` for filters beside it.
✓ `ConfigBar.tsx`, `RunsView.tsx`'s typing-aid filter.
✗ A row of separate buttons with `aria-pressed` (each a Tab stop).

**Tip** and **Shortcut** (`composites/tip.tsx`). Use: explaining a control, with its shortcut as keys (`shortcut="Ctrl+Shift+L"`, `"⌘⇧L"`, `"Ctrl+K, then T"`, `"Enter"`). Replaces `title` everywhere (A4). The trigger must be focusable: wrap a `Button`, or text through `Explained` (`RunsView.tsx`) or `Explain` (`Results.tsx`).

**Picker** (`composites/picker.tsx`). Use: choosing from a long, sectioned list with search (languages, themes). Options: `matches` for our own search rules, `onActive` for live preview, `footer` for extra controls. One Esc closes it; Enter chooses even when typed straight after the name. Load it on demand (`lazy()`), as `App.tsx` does. ✓ `ThemePicker.tsx` badges themes flagged `wcag: 'AA'` with "WCAG AA" (an outline `Badge`, hidden from screen readers, with "meets WCAG AA contrast" in visually hidden text) and lists them for "wcag", "accessible" or "aa".

**Toaster** and **useToast** (`composites/toast.tsx`, `use-toast.ts`). Use: a message after something happened (report sent, export done). `toast.show(text)` hides after 6 s; `{ tone: 'error' }` stays until dismissed and is announced as an alert. One `Toaster` per page root.
✗ A message written into the page next to the button.

**ReportDialog** (`composites/report-dialog.tsx`). The report flow; its trigger is the flag button.

**AccountMenu** (`composites/account-menu.tsx`). The account button and its menu. The button's content is its accessible name: end it with a screen-reader-only “, account”.

**LabelledSwitch** and **LabelledCheckbox** (`composites/labelled.tsx`). See Checkbox and Switch.

**Crumbs** (`composites/crumbs.tsx`). Use: where a view sits (`My runs › Python › short › clamp.py`); the parts you can go back to take `onPress`.

**DataTable** (`composites/data-table.tsx`). Use: any table of data. A real `<table>`; `numeric` right-aligns figures in tabular numbers; `onOpen` on a row opens it on a click anywhere, while the row's own link or button is the keyboard's way in. Wrap it in `Card className="py-0"`.
✓ The leaderboards and My runs. ✗ A row that's itself a Tab stop.

## View parts (`ViewParts.tsx`)

Shared by My runs and the leaderboards: `ViewTitle` and `ViewHead` (title or crumbs, with the view's main action on the right), `LanguageButton` (opens the picker, as in the settings row), `Stat` (a summary number in a card), `Mark` (a badge beside a value), `Muted`, `Note` (empty or failed, as `Empty`) and `TableSkeleton`.

## Pages without the app

The privacy and fair-play pages and each page's About section are written by `scripts/build-pages.mjs` with utility classes in the HTML; `app.css` scans that script. About is hidden once the app runs (`in-[.app-ready]:not-[.open]:hidden`) and opens as a dialog (`AboutDialog` moves the same element into a modal and adds `.open`).
