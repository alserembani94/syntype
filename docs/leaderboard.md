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

- **Worker code** handles `/api/*` and `/admin*` only (`assets.run_worker_first` for those paths). Every other request is a static file, free and unlimited, so the game never depends on the backend.
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
4. **A snippet fingerprint:** a hash of the snippet's code. Editing a snippet's text gives it a new fingerprint, so old and new scores are never mixed.

## Personal board (on the device)

Works for everyone, costs nothing on the server, and never leaves the device unless the player exports it.

- **Stored in IndexedDB**, not `localStorage`: that's capped at 10 MiB, which a heavy player would fill in months. Today's local personal bests move over.
- **Kept:**
  - every run's **result** (about 0.2 KB; under 1 MB a year at 10 runs a day)
  - **logs** for each snippet's best 3 runs (at most ~1.4 MB for today's 241 snippets) and for the last 10 runs, for replaying a run just played
- **Shows:**
  - the player's own matrix, language by length by snippet: best, average, number of runs, trend
  - every run on a snippet, filterable by typing aids
  - a replay of any run that has a log
  - for signed-in players, whether each run was submitted, accepted or rejected, and why
- **Durability:**
  - The app asks the browser for persistent storage (`navigator.storage.persist()`).
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

## Data model (D1)

| Table | One row per | Holds |
|---|---|---|
| `players` | player | id, provider, provider user id, display name, name changed at, hidden, created at, last seen at |
| `bests` | player × snippet version × aid combination (plus one "any aids" row per snippet) | WPM, raw WPM, accuracy, time, aids, finished at |
| `logs` | stored top-20 run | the best it belongs to, compressed log |
| `snippet_versions` | snippet text ever played | fingerprint, language, name, length, code, archived at |
| `reports` | report | reporter (or empty once anonymised), target run or player, reason, note, status, created at |
| `admin_actions` | moderation action | what was done, to whom, when |

Indexes:
- `bests` by (snippet version, aid combination, WPM), for boards
- `bests` by player, for profiles and deletion
- `reports` by status

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
- **Every action** is recorded in `admin_actions`.

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

Have the privacy page checked against the laws that apply: Malaysia's PDPA for a `.my` site, and the EU's GDPR for European players.

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
