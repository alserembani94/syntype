/**
 * The privacy and fair-play pages (docs/leaderboard.md, "Privacy"):
 * /privacy and /fair-play, written by scripts/build-pages.mjs as plain pages
 * that read without any script. Keep them true to what the code does: when
 * something stored, kept or checked changes, change it here.
 *
 * Text is plain, with [words](address) for a link. The privacy page is only
 * published once PRIVACY_CONTACT is set: data protection law expects a way to
 * reach whoever runs the site.
 */
import { SITE_URL } from './site'

import { OPERATOR, PRIVACY_CONTACT } from './policyLinks'

export { PRIVACY_CONTACT, POLICY_LINKS } from './policyLinks'
/** When the privacy page last changed. */
const PRIVACY_UPDATED = '2026-11-25'

interface PolicySection {
  heading: string
  /** Paragraphs; a line starting "- " is a list item. */
  body: string[]
}

export interface PolicyPage {
  path: string
  file: string
  url: string
  title: string
  description: string
  heading: string
  intro: string
  sections: PolicySection[]
  label: string
}

const contact = PRIVACY_CONTACT ?? 'the address on this page'

export const privacyPage: PolicyPage = {
  path: '/privacy',
  file: 'privacy.html',
  url: `${SITE_URL}/privacy`,
  label: 'Privacy',
  title: 'Privacy | Syntype',
  description: 'What Syntype keeps about you, on your device and on its server, why, for how long, and how to see, download, hide or delete it.',
  heading: 'Privacy',
  intro: `Syntype keeps as little about you as it can. You can play without an account, and then nothing about you is kept anywhere but your own browser. This page says what is kept when you do sign in, why, and how to remove it. Last updated ${PRIVACY_UPDATED}.`,
  sections: [
    {
      heading: 'Who runs Syntype',
      body: [`Syntype is made and run by ${OPERATOR}, who decides how the data below is used. For anything about your data, write to ${contact}.`],
    },
    {
      heading: 'Without an account',
      body: [
        'Your settings, theme, personal bests and run history (with the keystrokes of your best and most recent runs, for replays) are stored in your browser, on your device. They are never sent to Syntype. You can export, import or clear them in My runs, and clearing your browser’s site data removes them.',
      ],
    },
    {
      heading: 'When you sign in',
      body: [
        'Signing in is optional, and only for the leaderboards. You sign in with GitHub or Google, which send Syntype your public profile. Syntype keeps your account’s permanent ID from it and a name to suggest (your GitHub username, or your Google first name with three digits), and nothing else: not your full name or photo. It never asks for your email address. The sign-in tokens are used once and thrown away.',
        'On its server, Syntype keeps:',
        '- your player record: an internal ID, whether you use GitHub or Google and that account’s ID, your leaderboard name and the suggested one, when you last changed your name, whether you are hidden, and when you joined and were last seen',
        '- your best run on each snippet you submit (overall and for each combination of typing aids): WPM, raw WPM, accuracy, time, typing aids and when you finished',
        '- the keystrokes of runs in the top 20 of a board: which keys you pressed in the snippet, and when, so the run can be replayed and checked',
        '- reports you send, and reports about you (including Syntype’s own automatic flags of unusually fast runs), with any note',
      ],
    },
    {
      heading: 'What is public',
      body: [
        'On the leaderboards, anyone can see your leaderboard name, your best runs (WPM, accuracy, typing aids, date) and replays of runs in a board’s top 20. Each entry also carries a random player ID that means nothing outside Syntype. Nothing else about you is shown. You can hide yourself from every board at any time. Boards are cached for up to a minute, so a change (hiding, deleting a run, deleting your account) can take that long to show everywhere.',
      ],
    },
    {
      heading: 'Why',
      body: [
        'To run the leaderboards you asked to take part in, and to keep them fair: each run is checked by replaying its keystrokes, and players can report runs that look faked. In the terms of data protection law, the leaderboard is a service you asked for, and fair play and security are legitimate interests. Your data is never sold, used for advertising, or shared beyond the services below.',
      ],
    },
    {
      heading: 'Cookies',
      body: [
        'Syntype sets two cookies, both needed for signing in, and none for tracking or advertising:',
        '- syntype_session: keeps you signed in, for up to 30 days',
        '- syntype_signin: links GitHub’s or Google’s answer to the sign-in you started, for 10 minutes',
        'Visits are counted with Cloudflare Web Analytics, which sets no cookies and doesn’t follow you across sites (see below). There is no other analytics or tracking.',
      ],
    },
    {
      heading: 'Services Syntype uses',
      body: [
        '- [Cloudflare](https://www.cloudflare.com/privacypolicy/) hosts the site and its database. Like any host, it handles your IP address to deliver the pages, and keeps short-lived request logs. When you submit a run, Cloudflare Turnstile checks that your browser is used by a person; your IP address is passed to that check.',
        '- Cloudflare Web Analytics counts page visits and measures how fast pages load, to show how the site is used and how well it performs. It uses no cookies, doesn’t follow you across sites, and reports to Syntype’s own address.',
        '- [GitHub](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement) and [Google](https://policies.google.com/privacy) handle signing in.',
        '- [Google Fonts](https://developers.google.com/fonts/faq/privacy) serves the typefaces, so Google sees your IP address when they load.',
        'These services may process data outside your country, under their own safeguards.',
      ],
    },
    {
      heading: 'How long',
      body: [
        '- Your account and runs: until you delete them. Accounts nobody has signed in to for 2 years are deleted automatically.',
        '- Keystrokes: only while the run is in its board’s top 20.',
        '- After deletion, the database’s automatic backups keep the data for at most 30 more days (7 on the plan Syntype uses now), then it is gone.',
        '- Reports you sent stay after you delete your account, without your name, so moderation keeps its record. The moderator’s log of actions keeps no names of deleted accounts.',
      ],
    },
    {
      heading: 'Your choices',
      body: [
        'Signed in, open your name at the top right, then Account & data, to:',
        '- download everything Syntype keeps about you, as a file: your account, scores, kept keystrokes, the reports you sent, reports about you and moderator actions on your account. To protect other people, it leaves out who reported you, notes other players wrote, and the moderator’s email',
        '- hide yourself from the leaderboards, or show yourself again',
        '- delete any of your runs from the leaderboards',
        '- change your leaderboard name (once a week)',
        '- sign out on every device at once',
        '- delete your account, which removes your name, scores and replays at once',
        `You also have the right to ask what is kept about you, to have it corrected or deleted, and to object to how it is used: write to ${contact}. If you are unhappy with the answer, you can complain to Malaysia’s Personal Data Protection Commissioner, or, in the EU or UK, to your data protection authority.`,
      ],
    },
    {
      heading: 'Children',
      body: ['Anyone can play without an account. If you are under 13, please play without signing in.'],
    },
    {
      heading: 'Changes',
      body: ['When this page changes, the date at the top changes too. Big changes will be announced on the site.'],
    },
  ],
}

export const fairPlayPage: PolicyPage = {
  path: '/fair-play',
  file: 'fair-play.html',
  url: `${SITE_URL}/fair-play`,
  label: 'Fair play',
  title: 'Fair Play Rules for the Leaderboards | Syntype',
  description: 'What is allowed on Syntype’s leaderboards and what is not: typing aids are fine, macros, scripts and pasting are not. How runs are checked and reported.',
  heading: 'Fair play',
  intro: 'Every leaderboard is a list of people typing the same code with their own hands. These are the rules that keep it that way.',
  sections: [
    {
      heading: 'Allowed',
      body: [
        '- Auto-indent, auto-close and autocomplete. They are part of typing code in an editor. Each run records which ones were on, every board can be filtered by them, and characters accepted from a suggestion never count toward your WPM.',
        '- Any keyboard, layout or typing style.',
        '- Practising a snippet as often as you like. Only your best run counts.',
      ],
    },
    {
      heading: 'Not allowed',
      body: [
        '- Macros, scripts, auto-typers or anything else that types for you',
        '- Pasting, or any tool that changes the keystrokes or result a run sends',
        '- Submitting runs typed by someone else, or using someone else’s account',
        '- Leaderboard names that insult or impersonate people',
      ],
    },
    {
      heading: 'How runs are checked',
      body: [
        'Every submitted run carries its keystrokes. The server types them again through the game’s own code, against the snippet’s exact text, and accepts the run only if they finish the snippet and give the same result. Runs are also turned away when their keystrokes span more time than had passed since the run began, when keys come faster than fingers can press them, when the speed stays above about 250 WPM, or when the rhythm is too even to be a person’s. Runs under 75% accuracy don’t count.',
        'A new best far above your usual speed, or a new player going straight to #1, is also sent to the moderator to look at. The run stays on the board while they do.',
      ],
    },
    {
      heading: 'Reports',
      body: [
        'Signed in, you can report a run or a name with the flag on its row. A moderator looks at every report, can watch the run’s replay, and can remove runs, rename players or hide them from the leaderboards. Reports are private: nobody is told who sent one.',
      ],
    },
    ...(PRIVACY_CONTACT
      ? [{ heading: 'If your run was removed', body: [`Runs and players are removed only when they break these rules. If you think a decision was wrong, write to ${PRIVACY_CONTACT}.`] }]
      : []),
  ],
}

/** The policy pages published now: fair play always, privacy once it has a contact. */
export const policyPages = (): PolicyPage[] => (PRIVACY_CONTACT ? [privacyPage, fairPlayPage] : [fairPlayPage])
