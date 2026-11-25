# Leaderboard and personal board: design

Status: **agreed design, not built yet.** Written before any code, to settle what is stored, the rules, the screens, moderation, privacy and cost. Change this document when a decision changes.

## Goals

- A **personal board** for everyone, signed in or not: every run you finish, your best per snippet, your trends, and replays, kept on your own device.
- A **global leaderboard** per snippet, for signed-in players, that is fair (everyone typed the same text) and hard to fake.
- Stay on Cloudflare's free plan for as long as traffic allows, and keep the game itself working even if the backend is down or out of quota.
- Keep as little personal data as possible, and let players see, hide, download and delete theirs.

Not goals for now: weekly or monthly boards, boards that rank across snippets, linking a Google and a GitHub account into one player, bans (see [Moderation](#moderation)).

## Decisions at a glance

| Topic | Decision |
|---|---|
| Boards | **One per snippet.** The leaderboard page is browsed by language, then snippet. |
| Lengths | No "any length" anywhere: removed from the game too. Every run belongs to its snippet's length. |
| Entries | **One per player per snippet.** A better run replaces the old one; the board doesn't grow. |
| Better | Higher WPM, with at least **75% accuracy** (the game's existing `MIN_ACCURACY_FOR_BEST`). Ties: higher accuracy, then whoever got there first. |
| Typing aids | Every run records auto-indent, auto-close and autocomplete. Boards show everyone together by default and can be filtered by aids. |
| Who can submit | **Signed-in players only.** Everyone can view boards. |
| Sign-in | **Google or GitHub**, basic profile only, no email. |
| Display name | Asked once at first sign-in, prefilled (GitHub username; Google first name plus digits). Required before submitting. |
| Server keeps | Every player's **best score** per snippet (and per aid combination), and **keystroke logs for each board's top 20**; the top **15** are shown. |
| Device keeps | **Every run's result**, and logs for each snippet's **best 3** plus your **last 10** runs. |
| Admin | A page behind **Cloudflare Access**, separate from player sign-in. |
| Reports | Signed-in players report a run or a player: cheating, offensive name or other, with a note. |

## How it fits on Cloudflare

The site is already a Worker serving static files (`wrangler.jsonc`). The backend joins the same Worker:

- **Worker code** handles `/api/*` only (`assets.run_worker_first`), and reads the snippet data files through the assets binding. Every other request is a static file, free and unlimited, so the game never depends on the backend. The admin page (`/admin`) is a static file too, behind Access; its data comes from `/api/admin/*`, which checks Access's token itself.
- **D1** (SQLite) stores players, best scores, top-20 logs, reports and snippet versions.
- **Turnstile** (Cloudflare's CAPTCHA, usually invisible) is checked when a run is submitted.
- **Cloudflare Access** guards the admin page.
- One deploy, as today: a push to `main` builds and deploys frontend and backend together.

The claude.ai artifact has no backend: it hides sign-in and the global board, and keeps the personal board.

## The game: changes before any backend

1. **Remove "any"** from the length choices. Saved settings of `any` become `medium`.
2. **A run record** for every finished run:
   - id, snippet (language, name, and a fingerprint of its exact text), length
   - WPM, raw WPM, accuracy, time, typing aids, finished at
   - its keystroke log
3. **Keystroke log format:** one entry per action, with the character (or action) and the milliseconds since the previous one. Compressed, real logs average 0.3 KB (short), 0.6 KB (medium) and 1.1 KB (long); uncompressed about 0.6, 1.7 and 3.8 KB.
Built in `src/lib/runlog.ts` (task 2): the reducer logs every action that changed the run, with an accepted suggestion logged as the text it inserted; `replay` rebuilds the run from a log with suggestions off; `recordRun` makes the record. `src/lib/runlog.test.ts` replays a recorded run of every snippet in every language, with typos, a pause and every typing aid on or off, and checks the run and result come out the same. The longest snippets replay in about 1.4–1.8 ms (2.4–4.6 ms on a first run), and their logs are about 7 KB of JSON before compression.

4. **A snippet fingerprint:** a hash of the snippet's code. Editing a snippet's text gives it a new fingerprint, so old and new scores are never mixed.

## Personal board (on the device)

Works for everyone, costs nothing on the server, and never leaves the device unless the player exports it.

- **Stored in IndexedDB**, not `localStorage`: that's capped at 10 MiB, which a heavy player would fill in months. Built in `src/lib/history.ts` (task 3): runs and logs in separate stores, so listing runs never loads logs; logs pruned after each run. Today's personal bests (per language, length and aids) stay in `localStorage` and keep driving the results screen; the history starts with the first run recorded.
- **Kept:**
  - every run's **result** (about 0.2 KB; under 1 MB a year at 10 runs a day)
  - **logs** for each snippet's best 3 runs (at most ~1.4 MB for today's 241 snippets) and for the last 10 runs, for replaying a run just played
- **Built (task 4):** `src/components/RunsView.tsx` and `ReplayView.tsx`, at `/runs` (`dist/runs.html`, not indexed, not in the sitemap), with the board's numbers in `src/lib/board.ts` and the replay timeline in `src/lib/replay.ts`. The header now has **Type** and **My runs** tabs, with About and the theme as icon buttons; Leaderboard and Sign in join it later.
- **Shows:**
  - the player's own matrix, language by length by snippet: best, average, number of runs, trend
  - every run on a snippet, filterable by typing aids
  - a replay of any run that has a log
  - for signed-in players, whether each run was submitted, accepted or rejected, and why
- **Durability:**
  - The personal board offers a button that asks the browser for persistent storage (`navigator.storage.persist()`). It isn't asked for automatically: Firefox shows a permission prompt for it, which shouldn't appear on someone's first finished run.
  - Safari may still delete a site's data after 7 days of browsing without a visit, which is why **export to a file** and **import** exist. They're also how history moves to another device.
  - Private windows keep nothing.
- **Clear local history:** everything, or one language.

## Sign-in and players

- **Providers:** Google and GitHub, through OAuth, asking for the basic profile only. Provider tokens are used once at sign-in to read the profile, then discarded. Nothing of the player's at Google or GitHub is kept.
- **Session:** a signed cookie (HMAC with a server secret). Checking who someone is needs no database read. Signing out clears it; deleting the account invalidates it.
- **Stored per player:**
  - an internal id
  - the provider, and its permanent user id
  - the display name, and when it was last changed
  - hidden (yes or no)
  - created and last seen dates

  No email, no avatar, no IP address.
- **Google and GitHub separately:** signing in with Google and with GitHub makes two players. Linking would need email; leave it out unless players ask.

Built in task 6: the tables (`migrations/0001_init.sql`), sign-in and sessions (`worker/lib/oauth.ts`, `api.ts`), names (`worker/lib/names.ts`, `players.ts`), and the header's **Sign in**, name step and account menu (`src/components/Account.tsx`). Sessions are signed cookies; `/api/me` reads the player row, so a session also ends when `session_version` is bumped (account deletion signs out everywhere).

### Display name

- **First sign-in:** a single step, "Your leaderboard name", prefilled and editable, then **Continue**.
  - GitHub: the username (e.g. `alserembani94`).
  - Google: first name plus a few digits (e.g. `atif-382`), never the full name by default.
- **Until the name is confirmed**, the player can play but runs aren't submitted, and a small prompt reminds them. No name appears anywhere its owner hasn't confirmed.
- **Rules:**
  - 3 to 24 characters: letters, numbers, spaces, `-` and `_`.
  - Unique, ignoring case.
  - A blocklist of offensive words, and reserved names (`admin`, `syntype`, `moderator` …).
- **Renaming:** from the profile, at most once a week. The admin can rename or hide anyone at any time.

## Submitting a run

1. **Start:** when a signed-in player starts a snippet, the Worker issues a **run token**, signed, with the snippet's fingerprint and the server's start time. (Signed-out runs need no request at all.)
2. **Finish:** the game submits the token, the keystroke log, the typing aids, the claimed result and a Turnstile token.
3. **The Worker checks**, and rejects the run if any check fails:
   - the token is genuine, unused and recent (submission within **10 minutes** of finishing, so a dropped connection can retry)
   - the log is at most a fixed size (capped, to bound CPU)
   - **replaying the log through the same engine** (`src/lib/engine.ts`, keystrokes only, no suggestion engine) produces the snippet, and the claimed result
   - the run took no less time than had passed since the token was issued
   - the typing is humanly possible: no long stretches of keys under ~15 ms apart, no machine-even rhythm, no sustained speed beyond about 250 WPM
   - accuracy is at least 75%
4. **If it's the player's best** on that snippet (overall, or for that aid combination), the best is replaced. If it enters the top 20, its log is stored, and the log pushed out of the top 20 is deleted.
5. The submitter sees their new place at once. Others see it within the board's 60-second cache.

**As built** (task 7):
- **Snippets on the server:** the build writes each snippet's exact text and auto-close pairs to `dist/data/snippets/<fingerprint>.json`, plus an `index.json` of the current ones (`src/lib/snippetfiles.ts`). The Worker reads them through its static assets, so it never loads the language definitions, and a fingerprint without a file (an edited or removed snippet, or a made-up one) can't get a token or be submitted.
- **The same code:** the typing reducer is `src/lib/typing.ts` and the log format and replay `src/lib/runcore.ts`, shared by the game and the Worker. `worker/lib/runcheck.ts` holds the checks, tested on every snippet (`runcheck.test.ts`): honest runs with and without every aid pass; forged logs, results and inhuman typing don't.
- **Routes:** `POST /api/runs/start` (named players; a token signed with the session secret, valid 2 hours) and `POST /api/runs` (`worker/lib/runs.ts`). The game asks for the token at the first key, so the server allows 5 seconds for that request in the "no longer than since the token" check.
- **Human checks:** 10 keys in a row under 15 ms apart; over 250 WPM across any 100 keys (or the whole run, from 50 keys); key-to-key variation under 8% across 40 or more keys. Pauses split the run. Accepted suggestions must be a single line of at most 80 characters, and only with autocomplete on.
- **Limits:** a body of at most 256 KB; at most 4 entries per character plus 200, plus one per second; at most 30 minutes of typing.
- **Order:** the token, then Turnstile, then the replay, so a bot without a Turnstile token costs no replay. A token is marked used only when the run is accepted, in the same transaction as the bests (`used_run_tokens`, pruned after a day), so a failed Turnstile check can be retried.
- **Places** count only players who show on boards (plus the submitter). Logs are gzipped; the top 20 counts visible players only.
- **The game** (`src/hooks/useSubmission.ts`): only for signed-in players with a name; runs under 75% aren't sent. The results screen says what happened (new best and place, best unchanged, rejected and why, or couldn't send, with Try again), and My runs shows it per run, kept with the run on the device. Turnstile (`src/lib/turnstile.ts`) loads at the first submission and stays invisible unless it needs the player.
- **Locally:** `npm run dev:api` uses Turnstile's always-pass test sitekey; `.dev.vars` needs its test secret.

## Leaderboards

- **Browsing:** Leaderboard → language → its snippets (with each one's top WPM) → one snippet's board. The snippet list comes from the code, so new snippets get a board automatically. Each score row also stores the language, so a language's boards load in one query.
- **A board row:** rank, display name, WPM, accuracy, typing-aid icons, date, and a replay button when a log is stored.
- **Shown:** the top **15**, plus the viewer's own place if they're further down ("You: #57").
- **Kept:**
  - every player's best on every snippet, so anyone can see their rank, and the next player moves up when someone leaves
  - logs for the top **20**, so the rows that move up into the top 15 still have one
- **Typing-aid filters:** with a filter on (e.g. autocomplete off), each player appears with their best run *in that combination*. The server keeps one best per player per aid combination they've actually used, up to 8. Logs are kept for the top 20 of the default, unfiltered view only.
- **Snippet changes:**
  - Editing a snippet's text starts a fresh board.
  - The old board is **archived**: read-only, with its logs and the old text kept so replays still work.
  - A removed snippet's board is archived the same way.
- **Caching:** each board is cached for 60 seconds, so heavy viewing costs few database reads.

**As built** (task 8):
- **Pages:** `/leaderboard` (`src/components/LeaderboardView.tsx`, `dist/leaderboard.html`, indexed and in the sitemap): languages and lengths, then each snippet's top score and who holds it; a snippet's board with the typing-aid filter (**any**, or **exactly** a combination), "you" highlighted or added below the top 15; replays of kept runs; and a report flag on other players' rows (signed in with a name). Older versions of changed snippets are listed under the language, with their closed boards and replays.
- **API** (`worker/lib/boards.ts`): `GET /api/boards?lang=` reads one top row per current snippet (not every score); `GET /api/boards/:fingerprint?aids=` the top 15 through `bests_board`; `GET /api/boards/:fingerprint/me` your place (never cached); `GET /api/replays/:runId` a kept run by a visible player, with the text it was typed on.
- **Cache:** boards, language overviews and replays are kept in the Cache API of each Cloudflare data centre for 60 seconds (`worker/index.ts`). The submitter sees their place at once on the results screen, and in "you" on the board.
- **Admin:** for a reported run, the queue offers **Watch replay** (`/leaderboard?replay=…&admin=1`, read through `/api/admin/replays`, so any kept run, hidden players' too) and **Remove run**: its best rows and log go, and if it was the player's overall best, their best with other typing aids takes its place.

## Data model (D1)

| Table | One row per | Holds |
|---|---|---|
| `players` | player | id, provider, provider user id, display name, name changed at, hidden, created at, last seen at |
| `bests` | player × snippet version × aid combination (plus one "any aids" row per snippet) | WPM, raw WPM, accuracy, time, aids, finished at |
| `logs` | stored top-20 run | the best it belongs to, compressed log |
| `snippet_versions` | snippet text ever played | fingerprint, language, name, length, code, first seen (a version is archived when the current snippet files no longer have it) |
| `reports` | report | reporter (or empty once anonymised), target run or player, reason, note, status, created at |
| `admin_actions` | moderation action | what was done, to whom, when |

Indexes:
- `bests` by (snippet version, aid combination, WPM), for boards
- `bests` by player (its primary key), for profiles, deletion, and finding a run: a run is always looked up through its player, never by run id alone
- `reports` by status, by target and by reporter

**Why so few indexes** (code review, task 12): in D1 every index adds a written row whenever its columns change, and rows written are the first free limit reached. So an index is added only where reads would otherwise grow with the whole table on a common path. Small or rarely read tables are scanned instead: `logs` is capped at 20 per snippet; `admin_actions` grows only with moderation; the daily clean-up reads `players` once a day, which costs far less than an index on `last_seen_at` that every daily visit would write to. The unused `bests_by_language` index and `snippet_versions.archived_at` column were dropped (migration 0005).

**Costs and limits as built** (task 12):
- Replays, run removal and the report queue find a run by its player's primary key, never by scanning `bests`. The admin's Remove run sends the player id with the run id.
- "Your place" counts only the rows at or above your WPM, through the board index.
- The edge cache key is built only from the parameters a route accepts (`worker/lib/cachekey.ts`), so extra query strings can't miss it. Answers served from that cache get `Cache-Control: public, max-age=60` set again, because the zone's Browser Cache TTL (4 hours by default) rewrites it on cached objects.
- The daily clean-up deletes every inactive account in one batch: one query against D1's 50-per-invocation limit on the free plan.
- Request bodies are capped while reading (`worker/lib/body.ts`): 256 KB for a run, 8 KB for anything else.
- Hiding from the boards is the one player write with no natural limit: it writes only on a change, at most twice a minute per player (the `HIDE_LIMITER` Rate Limiting binding). Run submissions need a Turnstile solve each, names change weekly, reports are capped at 10 a day.
- Anonymous request floods are for a WAF rate-limiting rule on `/api/*` in the Cloudflare dashboard (the free plan allows one rule, counted per IP over 10 seconds; blocked requests never reach the Worker).
- Keystrokes are kept only for visible players in a board's top 20, and a player keeps at most one log per snippet, cleaned up in the same transaction as the best, so two bests submitted at once can't leave a stray log.

## Moderation

**Automatic:** the submission checks above reject faked or impossible runs before they reach a board.

**Flagged for review** (the run stays up):
- a result far above the player's own history, such as 60 WPM suddenly becoming 180
- reported runs and players

**Reports:**
- Signed-in players only.
- Targets: a run or a player.
- Reasons: **cheating**, **offensive name** or **other**, with an optional note of up to 500 characters.
- Limits: one report per player per target, at most 10 a day.
- If the reporter deletes their account, their reports stay but become anonymous.

**The admin page** (`/admin`):
- **Access:** behind Cloudflare Access, so Cloudflare's own login (a one-time code to the owner's email, or the owner's Google account) runs before the request reaches Syntype. The owner's email lives in the Access policy, not in the app, and players are never asked for email.
- **The Worker** also verifies Access's signed header (`Cf-Access-Jwt-Assertion`) on every admin request. A Worker with static assets doesn't receive the verified identity directly, so it checks the header itself.
- **The report queue:** most-reported first. For each report:
  - watch the replay
  - remove the run
  - hide the player
  - rename the player
  - dismiss the report
- **Player search**, to rename or hide anyone without a report.
- **Every action** is recorded in `admin_actions`, with the admin's Access email.

**As built** (step 6, before submission, so the run tools come with steps 3–4):
- Reports are gathered by what they're about (a player, or one of their runs) and closed together: **resolve** (you acted) or **dismiss** (nothing wrong). Closed reports stay, under "Closed".
- **Hide** sets a flag of its own (`moderator_hidden`), apart from the player's own "hide me", so a player can't undo it. The player is told (`hiddenByModerator` in `/api/me`).
- **Rename** follows the usual name rules, at any time, and counts as a change of name: the player waits a week before changing it again.
- **Sign out everywhere** ends every session the player has.
- **Reports from players** (`POST /api/reports`) need a confirmed name; you can't report yourself; one per target, whatever its status; 10 in 24 hours. A run can only be reported while it's on a board.
- **Automatic flags** (`worker/lib/flags.ts`, migration 0004): when an accepted run becomes a player's new best, it's filed as a report from Syntype (`source = 'auto'`, reason cheating) if it's at least 90 WPM and 1.6× their average best on 3 or more other snippets, or if a player with fewer than 3 other snippets takes #1 on a board of 5 or more. The run stays up.
- **The queue shows each reported run** (snippet, WPM, accuracy, aids, date), or that it's no longer on the boards; **Watch replay** appears only when its keystrokes are kept. **Player search** can show a player's leaderboard entries, each with Watch replay and Remove run.
- Locally, `npm run dev:api` treats requests to localhost as an admin (`ADMIN_DEV_EMAIL`), since Access doesn't run there. Any other host needs a real Access token.

**What this won't catch:** a careful cheater feeding in human-like keystrokes at a believable speed. Review and reports keep that rare.

**Bans:** decided later, if cheating actually happens. A ban would keep a one-way fingerprint of the banned account's provider id after deletion, which the privacy page would have to mention.

## Player actions

| Action | Signed out | Signed in |
|---|---|---|
| Personal board, history and replays | ✓ | ✓ |
| Export and import local history | ✓ | ✓ |
| Clear local history (all, or one language) | ✓ | ✓ |
| Privacy page and fair-play rules | ✓ | ✓ |
| Change display name (once a week) | | ✓ |
| Hide me from leaderboards, and show me again | | ✓ |
| Delete one run from the server | | ✓ |
| Download my server data (a file with everything below) | | ✓ |
| Delete my account (server data; offers to clear local history too) | | ✓ |
| Sign out | | ✓ |

## Privacy

**Kept on the server:** the player row, best scores, top-20 logs, and reports the player made. Nothing else: no email, avatar, IP address, device details or provider tokens.

**Kept on the device:** settings, theme, and local history. It's never sent anywhere unless exported.

**Deleting an account:**
1. The player chooses **Delete my account** and confirms, by typing their display name or signing in again.
2. In one database transaction: their logs, bests and player row are deleted, and their reports are anonymised.
3. They're signed out. Sessions on other devices stop working on their next request.
4. Their entries leave the boards within 60 seconds (the cache), and everyone below moves up.
5. D1's automatic backups (Time Travel) keep deleted data for **7 days** on the free plan, 30 on paid. So the privacy page says "removed at once, gone from backups within 7 days".
6. The confirmation links to Google's and GitHub's settings, where the player can remove Syntype from their connected apps.

**Inactive accounts:** deleted after **2 years** without a sign-in.

**Pages to write:**
- **Privacy:** what's kept and why, on the server and on the device; how to download, hide and delete; the backup window; Google and GitHub sign-in.
- **Fair play:** typing aids are allowed (they're tracked and filterable), while macros, scripts and pasting aren't, and cheating runs are removed.

**Privacy and security as built** (task 13):
- **Download my data** includes reports about the player and moderator actions on them, leaving out other people's details: who reported, notes other players wrote, and the moderator's email. Syntype's automatic flags keep their note.
- **Sign out** ends the session on this device; **Sign out everywhere** (Account & data) increases `session_version`, which ends every session.
- **Signed tokens** all carry a kind (`session`, `signin`, `run`), and each check requires its own, so one can never pass as another.
- **Sign-in** uses PKCE with both GitHub and Google.
- **Turnstile:** a token is checked once (no idempotency key, so Cloudflare's reuse check applies), and must be for the `submit-run` action on our hostname. Cloudflare's always-pass test secret, used locally, skips those two checks, since its answers carry neither.
- **Headers** (`public/_headers`): no framing, HSTS for a year, no camera, microphone, location, payment or USB access, and a Content Security Policy. `scripts/build-pages.mjs` fills in the hashes of the built pages' inline code, so the policy always matches what shipped. A new third-party script, style, font or frame needs its origin added there.

Have the privacy page checked against the laws that apply: Malaysia's PDPA for a `.my` site, and the EU's GDPR for European players.

**As built** (task 9):
- **Account & data** (`src/components/AccountSettings.tsx`, from the account menu): change name, a "Show me on the leaderboards" switch, the player's entries with a delete for each, **Download my data** (a JSON file of the player row, bests, kept logs decoded, and reports they sent), and **Delete my account** (type the name to confirm; optionally clear this device's history; then links to GitHub's and Google's connected-apps settings).
- **Server** (`worker/lib/account.ts`): `POST /api/me/hide`, `GET /api/me/runs`, `POST /api/me/runs/:runId/delete` (as the admin's removal: the player's best with other aids takes its place), `GET /api/me/data`, `POST /api/me/delete`. Deleting an account, in one transaction: reports they sent lose their name, reports about them, their logs, bests and player row go, and renames in the moderation log lose their old and new names.
- **Inactive accounts:** a daily Cron Trigger (`triggers.crons` in `wrangler.jsonc`, `scheduled` in `worker/index.ts`) deletes accounts not seen for two years, 200 a day at most.
- **Pages:** `/privacy` and `/fair-play` (`src/seo/policies.ts`, written by `scripts/build-pages.mjs` as plain pages without the app, in the sitemap). The privacy page is published only once `PRIVACY_CONTACT` is set, since data protection law expects a way to reach the site's operator; until then only fair play is live. The privacy text is a careful draft, not legal advice: have it checked against the PDPA and GDPR.

## Cost and limits

Cloudflare's free plan:
- **Workers:** 100,000 requests a day, 10 ms of CPU per request. Static files are free and unlimited.
- **D1:** 5 million rows read and 100,000 rows written a day, 500 MB per database, 5 GB in total, Time Travel 7 days.

**CPU per submitted run**, measured by replaying realistic logs for all 241 snippets through the real engine:

| Server replay | Typical | Worst, warm | Worst, fresh Worker |
|---|---|---|---|
| Keystrokes only (the design) | 0.27 ms | 2.2 ms | ~6.6 ms |
| Also re-running the suggestion engine | 9.7 ms | 87 ms | n/a |

So the server replays keystrokes only, and the log size is capped. The longest snippets use about two-thirds of the free 10 ms.

**Traffic:** a 30-day simulation of visitors with random behaviour (25% signed in, about 6 snippets a visit, 70% finished, 1.5 leaderboard views a visit):

| Daily visitors | Requests | Rows read | Rows written |
|---|---|---|---|
| 1,000 | 4,200 | 101,000 | 9,900 |
| 5,000 | 20,100 | 468,000 | 47,000 |
| 10,000 | 40,800 | 895,000 | 97,000 |

**When each free limit is reached:**
- **Rows written** come first, at about **10,000 daily visitors**: about 5,200 if half the visitors sign in, about 26,000 if only 10% do.
- Requests at about 25,000.
- Rows read at about 61,000.

**Storage:**
- **Logs:** 241 snippets × 20 logs, at about 11 KB per snippet for 15 logs, is about **3.6 MB**, 0.7% of the 500 MB database. Each new snippet adds roughly 8–25 KB for 20 logs.
- **Best scores** grow with players. 10,000 players with bests on 50 snippets each is about 100 MB.

**Beyond free:**
- The **$5 a month** Workers Paid plan covers up to about **80,000 daily visitors** (10 million requests, 50 million rows written, 25 billion rows read and 5 GB a month included), then $0.30 per extra million requests.
- When a free limit runs out, only the leaderboard stops, until midnight UTC: the API returns errors. The game keeps working, because it's static files.

**Two traps this design avoids:**
- **Building boards from every stored run, with no cache.** At 1,000 daily visitors, that reads about 3.3 million rows a day after 30 days, and keeps growing.
- **Storing every log on the server.** It grows without bound, and it's personal typing data.

## Setup for the owner

1. Create a D1 database (dashboard, or `wrangler d1 create`), and give the Workers Builds API token **D1 edit** permission. The token Cloudflare creates by default covers Workers scripts, KV and R2, but not D1.
2. Create a **GitHub OAuth app** and a **Google OAuth client** (basic profile scopes), with callback URLs on `https://syntype.vercel.my`.
3. Create a **Turnstile** widget for the domain.
4. Add the secrets to the Worker: OAuth client secrets, a session secret and the Turnstile secret. Never put them in the repo.
5. Set up **Cloudflare Access** for `/admin*` with the owner's email, and note the Access team domain and application audience, for the header check.

## Build order

1. **Game changes and the personal board:** remove "any", add run records and logs in IndexedDB, the personal board with replays, and export, import and clear. Useful on its own, with no backend.
2. **Backend foundation:** the Worker API, the D1 schema and migrations, sign-in with GitHub and Google, sessions, and the display name step.
3. **Submission:** run tokens, server replay and checks, Turnstile, bests, and the top-20 logs.
4. **Global leaderboard pages:** language → snippet → board, filters, "your place", replays.
5. **Player controls and pages:** profile, rename, hide, delete a run, download, delete account, privacy and fair-play pages.
6. **Moderation:** reports, the admin page behind Access, the action log.
7. **Measure:** check CPU and usage in Cloudflare's dashboard against the simulation above.

## Open questions

- **Server history:** keep every submitted run on the server, or only bests? The design keeps **bests only**, since full history lives on the device. Keeping every run would allow a server-side history, at more storage and personal data.
- **Bans:** whether to block removed cheaters from signing up again. Decide if it becomes a problem.
- **Weekly boards:** possible later. They'd roughly double the writes per run.

## Sources

Cloudflare docs, read from their source (`cloudflare/cloudflare-docs`, branch `production`):
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Static assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Worker script routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Builds configuration (API token)](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Cloudflare Access with Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Turnstile](https://developers.cloudflare.com/turnstile/)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Browser storage: [Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) (MDN, read from its source).

The measurements and simulations were run on this repository's engine and snippets, in scratch scripts outside the project.
