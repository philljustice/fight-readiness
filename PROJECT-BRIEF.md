# CornerReady — project brief

Updated 25 Nov 2026 (America/New_York), after M1 shipped. Live app: fr-v61 (merge `31094ec`, PR #4). Restore point: `savepoint-before-m1-2026-11-25` (fr-v60, `5950adf`).

## 1. What it is

A fighter PWA for camp, recovery and maintenance. Phase 4 adds a coach web dashboard and a shared backend. Owner: Phill. Pilot fighters: Pablo and Diego. Today, data stays on the fighter's phone. The only server is the push worker, which stores subscription and per-day completion flags — never log contents.

## 2. Where things live

- **App:** `/workspace/fight-readiness-app` → `philljustice/fight-readiness` on GitHub Pages, https://philljustice.github.io/fight-readiness/.
- **Push worker:** local `/workspace/fight-readiness-push` at `ff2c9f3` (no remote). A secrets-free copy is in `push-worker/` in this repo. Live: https://fight-readiness-push.philljustice.workers.dev. Cloudflare Worker, KV `SUBS`, cron `*/15`, bindings `ALLOWED_ORIGIN` and `VAPID_*` (private key is a Wrangler secret, not in git). Deploy: `cd push-worker && wrangler deploy` (keep those bindings and the cron). Health: `GET /` must return `ok` and the current `phasePolicy` (fr-v60: `v4-cornerready-maint-weighin-outline`). A dedicated GitHub remote for the worker can wait until Phill agrees.
- **Website:** working copy `/workspace/fr-landing/cr-root` on Hostinger (user `u111513665`). Upload: `FR_UPLOAD_DOMAIN=cornerready.com python3 /workspace/fr-landing/scripts/tus_upload.py`. Sign-up DB config stays under fightreadyapp.com (`/home/u111513665/domains/fightreadyapp.com/private/fr-landing-config.php`) — do not delete that site. `fightreadyapp.com`, `cornerready.ca` and `cornerready.app` 301 to `cornerready.com`.
- **Mailbox:** getready@cornerready.com (forwards to Phill's Gmail).

## 3. File map

Open only the file that owns the work. `app.js` is the 160 KB core — targeted edits only; put new features in new small files.

- `app.js` — core UI (tabs, log, setup, score, localStorage).
- `scoring.js` — score, weights, bands, par, consistency bonus.
- `recovery.js` / `recovery-ui.js` — lifecycle, holds and clearance, migration, push metadata, and those screens.
- `insights.js` — streaks, wellness, load, CSV, weekly review, log sections (not the score).
- `weightplan.js` — weight plan and fight-week steps.
- `profile.js` — profile validation, countdown, schedule.
- `reminders.js` / `build-ics.js` — ICS helpers; builds `cal/` for Pages.
- `push.js` — Web Push client (completion flags only, never log data).
- `coachreport.js` / `report.js` — weekly coach report HTML and share image.
- `fightday.js` — fight-day score card, check-in, fanfare, fight checklist (from 7 days out), scheduled training on the log.
- `fightweek.js` — day-by-day fight-week plan (uses `weightplan.js`).
- `photo.js` — fighter photo (resized data URL in `S.photo`), shown in Setup, fight day and coach report.
- `setuphub.js` — Setup as area boxes; tapping a box shows that area's cards.
- `maint.js` — Maintenance 14-day baseline for fresh starts and yes/no training toggle.
- `cheat.js` / `early.js` / `weekly.js` — cheat-day rules; day-one score; testing-phase weekly report config (recipient: Phill).
- `tutorial.js` / `splash.js` / `splash.css` — tour and cold-open splash.
- `sw.js` — service worker; `CACHE` must match `APP_VERSION`.
- `styles.css`, `index.html`, `manifest.webmanifest`, `icons/`, `brand/`, `fonts/`, `cal/` — chrome and assets.
- `test-*.js` — Node unit tests (`npm test`).
- `push-worker/` — Cloudflare push worker source and tests.

## 4. How to check

App: `npm ci && npm test`. Smoke: `node /workspace/fr-tools/smoke.js <url> <outdir>` (outside the repo; needs puppeteer-core from `/workspace/fight-readiness-push/node_modules` and `/usr/bin/google-chrome`; scenarios camp, fight day, recovery, maintenance; prints `SMOKE OK`). Extend it rather than writing new scripts. `test-m1.js` covers the M1 items. Do not add new per-release screenshot scripts. Worker: `cd push-worker && npm test` (ephemeral test keys only; never send real pushes or change live subscriptions). Backend must-pass tests will be added with M2–M6.

## 5. How to deploy and roll back

**App** (Pages serves `main`): bump `APP_VERSION` in `app.js` and `CACHE` in `sw.js` to the same marker (next: `fr-v62`). Before a live deploy, annotate tag `savepoint-before-<name>-YYYY-MM-DD` on the current production SHA and write a one-line restore note. Do not force-move tags or make new tarball archives unless Phill asks. Commit on a branch, `gh pr create --base main`, merge after checks. One live deploy per milestone. Roll back by reverting that merge PR (preferred). Resetting `main` and force-pushing needs Phill's explicit OK. If phones must refetch, bump `CACHE` higher. M1 savepoint: `savepoint-before-m1-2026-11-25` (fr-v60, `5950adf`); restore by reverting PR #4. Pre-CornerReady savepoint: `savepoint-before-cornerready-2026-11-18` (fr-v59, `50e888c`).

**Worker:** `cd push-worker && wrangler deploy` (or from `/workspace/fight-readiness-push`). Do not overwrite or print secrets. Confirm `GET https://fight-readiness-push.philljustice.workers.dev/` shows the expected `phasePolicy`. Roll back by deploying the previous source (fr-v60 is `ff2c9f3`; previous live was `6fcf973`). An app rollback does not roll back the worker, and vice versa.

**Site:** upload from `cr-root` with `tus_upload.py`. Never delete fightreadyapp.com. If usage is running low, stop at a clean commit and say so.

## 6. Rules that don't change

- **Data and privacy.** Data stays on the phone until a phase-4 sync the fighter signs up for. Push sends flags only, never log contents. Fighters choose what a coach can see. No automatic coach messages without permission. Privacy policy before health data is stored on a server; outside security review before it goes live. Use a proven sign-in service; do not write password handling.
- **Injury holds.** Persistent. Only Clinician or Commission clearance (with a date) clears a hold — never elapsed time or coach-only action. New bouts never bypass holds. Unanswered care questions never mean injury-free. Restrictions suppress physical nudges.
- **Score (do not reopen).** Weights: Nutrition 25, Training 25, Sleep 15, Wellness 15, Screen 10, Family 10 (must sum to 100). Bands: 90+ Elite (gold); 75–89 Fight Ready (green) — keep that name; 60–74 Solid (blue); below 60 Off Pace (red). Par is 75. Hydration does not change the score. Maintenance uses a rolling process score; a rest day is neutral on Today's score. No score reward for weight loss, symptom improvement or extra sessions.
- **Weigh-ins.** Camp stays Mon/Thu. Maintenance follows the outline setting.
- **Brand and copy.** Name is CornerReady. Colours are exactly `#DEDEDE` and `#E1A42B`. Marketing uses "events" for competitions; in-app copy uses "fight". No "free for fighters" wording; no study counts; no invented claims or stats.
- **Standing limits.** Do not delete fightreadyapp.com. Do not touch justiceconstruction.ca. No purchases without Phill's OK of the exact total. No image or logo rounds unless Phill asks. Home-screen icons do not refresh until the app is removed and re-added (back up first on iPhone).

Builders: read this brief and the milestone spec, then open only the files they name. One fresh builder per milestone; at most two fix rounds. Message Phill at start, when blocked, and when ready for review. Mid-milestone ideas go on the next-milestone list.

## 7. Decisions log

Settled — do not reopen:

- 2026-11-18: Rebrand to CornerReady; colours `#DEDEDE` / `#E1A42B`; keep "Fight Ready" as the 75–89 score level name.
- 2026-11-18: Camp weigh-ins stay Mon/Thu; Maintenance weigh-ins follow the outline.
- 2026-11-18/19: Intro and sign-up live at the cornerready.com root; other domains redirect there; sign-up database stays under fightreadyapp.com; that domain is retired at renewal (21 Oct 2027), not deleted now.
- 2026-11: Auto-renew is off for the old getready@fightreadyapp.com mailbox (trial ends 17 Nov 2027).
- 2026-11-24: Backend hosting is Cloudflare; the website and mailbox stay on Hostinger.
- 2026-11-24: M1 (phase 3 releases 3 and 4, plus Phill's added fight-day, Setup, log-list and Maintenance items) is approved to start 25 Nov 2026 after 5:30 PM (America/New_York). Do not start the build before then.
- 2026-11-25: M1 shipped as fr-v61. Fight-day check-in answers do not create care holds automatically (an auto hold would turn fight day into a recovery day); a yes asks for details and tells the fighter to tell the coach and event doctor. Won/lost question also offers Draw / no contest (confirm with Phill). Fight day counts as complete with wellness, hydration and the check-in; fight days are left out of nutrition/training/streak/momentum maths.

Still open (see the milestone review list): sign-in provider; paid tiers and pricing (billing deferred until the pilot shows gyms will pay).

## 8. Current milestone

M1 is live (fr-v61, 25 Nov 2026). Waiting on Phill's phone review and answers to the open questions (Draw / no contest option; fresh Maintenance users under 14 days see the score relock until the baseline is built; fight-day check-in is not in the camp-mode coach report HTML, only in "More detail" and the recovery text). For-M2 list and review list: `/workspace/corner-phase4/milestones-for-review.md`. Plan: `/workspace/corner-phase4/plan.md`.

After M1: M2 server + sign-in on a test site (Cloudflare backend; website and mailbox stay on Hostinger); M3 fighter sync + pilot; M4 read-only coach dashboard; M5 coach-assigned schedules; M6 alerts, auto reports, tiers and security review.

## 9. Secrets (names only — never print or commit values)

`HOSTINGER_API_TOKEN`; `VAPID_PRIVATE_KEY` (Wrangler secret); Hostinger sign-up database and admin credentials in the private server config; vault refs for mailbox and hPanel logins. Never commit `.dev.vars`, `.secrets/`, `.wrangler/`, or vault exports.
