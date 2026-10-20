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
On first open the app shows a sign-up screen. Only the fighter name is required. The optional fields are nickname, date of birth, discipline, gym, head coach and their contact, weight class, starting and target weight, fight date, an emergency contact, and injury/allergy notes. You can edit the profile anytime in Setup. The starting weight is saved as the first weigh-in. The Dashboard shows the fight countdown and current → target weight with lbs to go. The Coach Report header shows fighter, gym, coach, weight class, current/target weight and days to fight. The profile stays on the phone and is included in JSON backups.

## First week
The sign-up day is Day 1. After sign-up the app goes straight to today's log, and a "Day 1, let's finish today's log" banner lists what's still missing (nutrition, training, sleep, screen time, family/friends) until today's log is complete.
The app starts empty. The start date is saved the first time Setup is completed. For the first 7 days the Dashboard and Coach Report show "Trends unlock in X days" in place of the score, weight trend and consistency bonus. Today's entry and the number of days logged still show. After that, normal scoring uses the last 3 weeks, counting only days since the start date. Restoring a backup brings its start date with it.

## Reminders (no push server needed)
Setup → Reminders: pick a morning time (default 7:00) and an evening time (default 21:00), then tap **Add reminders to my calendar**. This makes a `.ics` file with 3 repeating events that each sound an alarm at the start time:
- a daily morning log (sleep hours + nutrition plan)
- a Mon/Thu weigh-in before eating
- a daily evening log (training, screen hours, family/friends, notes)

Each event links back to the app.
- **iPhone (Safari):** the file opens the "Add to Calendar" screen. Tap *Add All*.
- **Android (Chrome):** the file downloads. Tap it to open it in Google Calendar or your phone's calendar app. If Google Calendar won't open it, go to calendar.google.com → Settings → Import.

If you change the times, add the file again and delete the old events.

Inside the app, a banner shows when today's morning or evening items aren't logged after their times. You can also allow notifications, but they only appear while the app is open, so they don't replace the calendar reminders.

## Data & backup
Setup → *Export backup (JSON)* saves a file. *Restore* on any phone loads it back. You can also import a FightLog CSV (Date, Nutrition, Training, Sleep_Hours, Screen_Hours, Family_Friends, Weight, Notes). Deleting browser data, or iOS clearing storage for an app that hasn't been opened in weeks, will erase entries. **Export weekly.**

## Files
`index.html`, `styles.css`, `app.js` (UI), `scoring.js` (scoring), `reminders.js` (calendar file + reminder checks), `profile.js` (profile validation, countdown), `manifest.webmanifest`, `sw.js`, `icons/`, `test.js`, `test-reminders.js`, `test-profile.js` (`node test.js && node test-reminders.js && node test-profile.js`).

