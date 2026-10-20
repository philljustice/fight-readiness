# Fight Readiness Tracker (PWA)

A phone app for MMA fighters. It's plain HTML/CSS/JS with no build step. It installs to the home screen and works offline. Each fighter's data stays in **their own phone's browser storage**. Nothing is uploaded.

## Get a link for the team (free)
**Netlify (easiest):** go to https://app.netlify.com/drop and drag this whole folder onto the page. You get an `https://<name>.netlify.app` link right away. Make a free account to keep it and rename the site.

**GitHub Pages:** create a public repo, upload every file in this folder (keep `icons/`), then go to Settings → Pages → Source: *Deploy from a branch* → `main` / root. The link is `https://<user>.github.io/<repo>/`.

Both use HTTPS, which install and offline mode need. Send the link to the team.

## Install on a phone
- **iPhone:** open the link in Safari → Share → *Add to Home Screen*.
- **Android:** open it in Chrome → ⋮ → *Install app* / *Add to Home screen*.

## Updating the app
Edit the files, bump `CACHE` in `sw.js` (e.g. `fr-v8`), and redeploy. Phones pick up the new version after the app is opened once or twice.

## Fighter profile
On first open the app shows a sign-up screen. Only the fighter name is required. The optional fields are nickname, date of birth, discipline, gym, head coach, weight class, starting and target weight, fight date, an emergency contact, and injury/allergy notes. You can edit the profile anytime in Setup. The starting weight is saved as the first weigh-in. The Dashboard shows the fight countdown and current → target weight with lbs to go. The Coach Report header shows fighter, gym, coach, weight class, current/target weight and days to fight. The profile stays on the phone and is included in JSON backups.

## First week
The sign-up day is Day 1. After sign-up the app goes straight to today's log, and a "Day 1, let's finish today's log" banner lists what's still missing (nutrition, training, sleep, screen time, family/friends) until today's log is complete.
The app starts empty. The start date is saved the first time Setup is completed. For the first 7 days the Dashboard and Coach Report show "Trends unlock in X days" in place of the score, weight trend and consistency bonus. Today's entry and the number of days logged still show. After that, normal scoring uses the last 3 weeks, counting only days since the start date. Restoring a backup brings its start date with it.

## Reminders (no push server needed)
Setup → Reminders: pick a morning time (default 7:00) and an evening time (default 21:00), then tap **Add reminders to my calendar**. This makes a `.ics` file with 4 repeating events that each sound an alarm at the start time:
- a daily morning log (sleep hours + nutrition plan)
- a Mon/Thu weigh-in before eating
- a daily evening log (training, screen hours, family/friends, notes)
- a Sunday 6 PM reminder: "Send weekly Fight Readiness report to Phill" (users who added reminders before this must tap the button again)

Each event links back to the app.
- **iPhone (Safari):** the file opens the "Add to Calendar" screen. Tap *Add All*.
- **Android (Chrome):** the file downloads. Tap it to open it in Google Calendar or your phone's calendar app. If Google Calendar won't open it, go to calendar.google.com → Settings → Import.

If you change the times, add the file again and delete the old events.

Inside the app, a banner shows when today's morning or evening items aren't logged after their times. You can also allow notifications, but they only appear while the app is open, so they don't replace the calendar reminders.

## Data & backup
Setup → *Export backup (JSON)* saves a file. *Restore* on any phone loads it back. You can also import a FightLog CSV (Date, Nutrition, Training, Sleep_Hours, Screen_Hours, Family_Friends, Weight, Notes). Deleting browser data, or iOS clearing storage for an app that hasn't been opened in weeks, will erase entries. **Export weekly.**

## Files
`index.html`, `styles.css`, `app.js` (UI), `scoring.js` (scoring), `reminders.js` (calendar file + reminder checks), `profile.js` (profile validation, countdown), `manifest.webmanifest`, `sw.js`, `icons/`, `test.js`, `test-reminders.js`, `test-profile.js` (`node test.js && node test-reminders.js && node test-profile.js`).


## Streaks, wellness, load and weight-cut safety (optional, not in the score)
These live in `insights.js` (tested in `test-insights.js`). **None of them change the Fight Readiness Score.**
- **Streak 🔥:** days in a row with a full log (nutrition, training, sleep, screen, family all filled in). If today isn't logged yet, the streak still counts up to yesterday. The Dashboard also shows a 28-day grid (full / partial / none).
- **Quick log:** one-tap sleep chips (6–9h) and screen chips (0–4h) next to the +/− steppers.
- **Wellness check-in:** optional 1–5 ratings (5 = best) for Energy, Soreness, Mood and Stress, based on the McLean (2010) questionnaire that TrainHeroic and other team platforms use. Shows a 7-day average against the 4-week average, a "wellness dropping" hint when it's ≥0.5 below normal, and 🚩 flags for any 1–2 rating in the last 3 days.
- **Session load:** optional RPE (1–10) × minutes, which is Foster's session-RPE method. Shows this week's total and a 4-week bar chart. The acute:chronic ratio (7-day average ÷ 28-day average) appears only after 28 days of RPE data. >1.5 is flagged as a spike, <0.8 as light.
- **Weight-cut safety:** loss of >1%/week of bodyweight (7-day avg vs prior 7) is a caution and >1.5%/week is a warning. If a target weight and fight date are set, the app also shows the weekly pace needed and warns when it's above 1%/week. This follows the ISSN combat-sports position stand (gradual ~0.5–1 kg/week).
- **History:** the Log screen lists recent days with a ✓ column for complete days and a "Show all" button. Tap a date to edit that day.
- **CSV export:** Setup or Report → *Export log as CSV* produces all fields plus Session_Load and Complete, ready for Excel or Google Sheets. CSV import accepts the new columns too.

## Testing phase: weekly report to Phill
Config lives in `weekly.js` → `CONFIG`:
- `ADMIN_EMAIL: 'philljustice@gmail.com'` is the weekly report recipient.
- `SHOW_COACH_CONTACT: false` hides the coach email/phone field on sign-up and profile. Existing saved values are kept untouched. The value is never shown on the Coach Report or in the share text. Set it to `true` to bring the field back.

The report week runs Monday–Sunday. On Sunday, and on every open after that until it's sent, the Score screen shows **Send weekly report to Phill**. Tapping it uses the Web Share API with the CSV of all logs attached, plus a text summary: name, score, streak, weight trend, flags (weight-cut warnings, low wellness, notes). The fighter picks Mail. If file sharing isn't supported, it opens a `mailto:` to the admin with subject `Fight Readiness weekly – <fighter> – <Mon> to <Sun>` and the summary plus CSV rows in the body. The body is kept under about 1800 characters by cutting down to the last 14 days (or fewer). The week is marked sent in `weeklySent` (local only). There are manual **Send report to Phill** buttons in Setup and Report. Tested in `test-weekly.js`.
