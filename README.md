# FightReady (PWA)

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
- a daily morning log (sleep hours + nutrition plan + energy/soreness/mood/stress)
- a Mon/Thu weigh-in before eating
- a daily evening log (each session + effort/minutes, screen hours, family/friends, notes)
- a Sunday 6 PM reminder: "Send weekly FightReady report to Phill" (users who added reminders before this must tap the button again)

Each event links back to the app.
- **iPhone (Safari):** the file opens the "Add to Calendar" screen. Tap *Add All*.
- **Android (Chrome):** the file downloads. Tap it to open it in Google Calendar or your phone's calendar app. If Google Calendar won't open it, go to calendar.google.com → Settings → Import.

If you change the times, add the file again and delete the old events.

Inside the app, a banner shows when today's morning or evening items aren't logged after their times. You can also allow notifications, but they only appear while the app is open, so they don't replace the calendar reminders.

### iPhone fix: static calendar files
Home-screen (standalone) PWAs on iOS ignore `data:`/`blob:` .ics downloads. The calendars are now pre-built static files in `cal/r-HHMM-HHMM.ics`: 11 morning times (05:00–10:00) × 11 evening times (18:00–23:00) at 30-min steps, 121 files, each with all 4 events. Regenerate them with `node build-ics.js` after changing reminder text. The reminder time pickers use the same 30-min steps, and older saved times are rounded to the nearest step. The **Add reminders** button is a normal `https` link (`target=_blank`), so iOS hands it to Safari, which shows the calendar preview with **Add All**. There's also a `webcal://` subscribe link (iOS defaults to "Remove Alerts" on subscriptions, so users turn that off) and a Share/save fallback using the Web Share API with an .ics file. The service worker doesn't intercept `cal/*.ics`. `.gitignore` excludes `*.ics` except `cal/*.ics`. GitHub Pages serves them as `text/calendar`.

## Data & backup
Setup → *Export backup (JSON)* saves a file. *Restore* on any phone loads it back. You can also import a FightLog CSV (Date, Nutrition, Training, Sleep_Hours, Screen_Hours, Family_Friends, Weight, Notes). Deleting browser data, or iOS clearing storage for an app that hasn't been opened in weeks, will erase entries. **Export weekly.**

## Files
`index.html`, `styles.css`, `app.js` (UI), `scoring.js` (scoring), `reminders.js` (calendar file + reminder checks), `profile.js` (profile validation, countdown), `manifest.webmanifest`, `sw.js`, `icons/`, `test.js`, `test-reminders.js`, `test-profile.js`, `push.js` (Web Push client + completion flag), `early.js` (day-1 daily score, feedback, badges, chart data; tested in `test-early.js`) (`for t in test*.js; do node $t; done`).


## Scoring (v2)
The default weights are Nutrition 25, Training 25, Sleep 15, **Wellness 15**, Screen 10 and Family 10. They're editable in Setup and Save is refused unless they add up to 100. Installs with saved params that have no `wWellness` are migrated to these defaults on load.
- **Training** is the average daily % of scheduled sessions completed. A rest day counts as 100. Legacy days count Y = 100 and N or blank = 0. An unscheduled extra session is logged and added to load but doesn't change the training %.
- **Wellness** uses Energy, Soreness, Mood and Stress, each 1–5 with 5 = best (fresh / no soreness / great / no stress). They're mapped 1→0 … 5→100 and averaged, over days that have all four. All four are required daily. Any 1–2 rating in the last 3 days raises a 🚩 flag.
- **Consistency bonus** (+5/+3/+1 at ≥90/75/60%) counts days with Nutrition = Y **and** 100% of scheduled sessions done.

## Training schedule
Sign-up (and Setup → Edit profile & training schedule) asks "Do you train once or twice a day?", then Rest / 1 / 2 sessions for each weekday with optional labels. It's pre-filled from the Weekly Outline (sessions 1–2; "Rest/Recovery" focus = rest day). Saving the schedule writes the labels into the current and future Weekly Outlines. The daily log asks "Did you complete session N (label)?" for each of today's sessions. RPE (1–10) and minutes are required for each completed session. Session load is the sum of RPE × minutes over all sessions plus the extra one, so two-a-days add up correctly in the weekly load bars and the acute:chronic ratio.

## Log screen: tile menu + autosave
The Log screen is a menu of four titled tiles (🌅 Morning check-in, 🍽️ Nutrition, 🥊 Training, 🌙 Evening), one per section of `Insights.sections()`. A tile is **light blue** until its section is complete and then turns **grey with a ✓** (a one-line summary shows what's logged or what's left, from `Insights.sectionInfo()`). Tapping a tile opens that section full-screen with a **‹ Back to menu** button at the top and **✓ Done** at the bottom. The browser/hardware back gesture also returns to the menu (the app pushes a history entry when a section opens and returns on `popstate`). The menu keeps today's score card, "N of 4 sections done", the date picker (past days can be edited the same way) and the Recent entries table.

**There are no per-section Save buttons.** Every field autosaves silently into that date's entry in localStorage as it is entered (same key and entry format as before). Only the open section's fields are on screen, so fields that aren't shown keep their stored value. Out-of-range numbers (sleep/screen 0–24, weight 60–400 lbs) keep the last good value, and an extra session is stored only once effort and minutes are both filled in (or cleared).

**💾 Save today's log** at the bottom of the menu re-checks the day with `Insights.checklist()` and shows ✅ complete plus the score card, or "Saved, but N things are still missing" with a tappable list; tapping an item opens the right section and highlights the field. When all tiles are grey the ✅ confirmation appears automatically. The completion flag for push nudges is synced when a section is closed and on Save.

**Restore point:** the previous single-page log is tagged `savepoint-before-log-menu` and kept on branch `stable-single-save` (sw cache `fr-v23`). To roll back: `git revert <menu commits>` (or `git reset --hard savepoint-before-log-menu && git push --force-with-lease origin main`), bump `CACHE` in `sw.js` to a new, higher value (e.g. `fr-v25`) so phones refresh, and push.

## Follow-up reminders until the log is done
Push only (calendar alarms can't be conditional). Setup → Reminders has **Remind me until today's log is done** (default ON, stored as `S.reminders.untilDone`). Whenever today's log changes (debounced 3 s, and on Save / app hidden / app open) the app sends the Worker `POST /status {endpoint, date, complete, missing}`: just a per-day completion flag and a count of open items from `Insights.dayStatus()`, never any log data. The Worker (see `fight-readiness-push`) then, in the subscriber's own time zone: sends the normal evening reminder (skipped if today is already complete), a follow-up 2 hours later, and a last call at 9:30 PM, dropping any that would land under 30 min after the previous one or after 23:00. All stop as soon as the log is complete or the toggle is off. Flags expire after 2 days (KV TTL). Older app versions never send the flag/toggle, so they keep the old single evening reminder.

## Complete days, streaks, banners
A day logged in v2 is complete only when it has nutrition, every scheduled session answered (with RPE + minutes if done), sleep, screen, family and all 4 wellness ratings. Days stored before v2 keep the old 5-item rule, so existing streaks stay valid. The Day-1 banner, the "still to log" message after saving, and the morning/evening reminders use the same rules. Morning = sleep + nutrition + wellness. Evening = sessions + screen + family.

## Other insights
- **Streak 🔥** with a 28-day grid. Quick sleep and screen chips.
- **Weight-cut safety:** >1%/week bodyweight loss = caution, >1.5% = warning. There's also a pace check against the target weight and fight date (ISSN combat-sports guidance of ~0.5–1 kg/week).
- **Acute:chronic load ratio** after 28 days of data (>1.5 spike, <0.8 light).
- **CSV export/import** columns: Date, Nutrition, Training, Sleep_Hours, Screen_Hours, Family_Friends, Weight, Notes, Energy, Soreness, Mood, Stress, Wellness_Score, Sessions_Scheduled, Sessions_Done, Training_Pct, S1_Label, S1_Done, S1_RPE, S1_Min, S2_Label, S2_Done, S2_RPE, S2_Min, Extra_Label, Extra_RPE, Extra_Min, Session_Load, Complete.

## Weight-cut safety, verdict, fight week, weekly review
- **Impossible-cut check** (`Insights.cutPlan`): runs at sign-up and profile edit (live, under the fight date) and on the Dashboard whenever a target weight and fight date are set. Required loss per week >1% of bodyweight = ⚠️ caution, >1.5% = ⛔ unsafe. It shows "You'd need X lbs/week; a safe pace (~1%/week) reaches about Y lbs by fight day, Z lbs short" and suggests a higher weight class or a later date. The app never shows an unsafe plan as achievable.
- **Daily weight verdict** (`Insights.weightVerdict`): a coloured pill plus one line on the Dashboard and Coach Report. Green **On track**, red **Too fast** (>1.5%/week loss), orange **Too slow** (under 80% of the required pace, capped at the safe 1%/week), grey **No target**. Fewer than 2 weeks of weigh-ins shows "On track?".
- **Fight-week plan** (`Insights.fightWeek`): appears when the fight date (treated as weigh-in day) is 0–7 days away. Day −7 to weigh-in covers training taper, water, sodium and carbs, conservative and in line with the ISSN 2025 combat-sports position stand (https://pmc.ncbi.nlm.nih.gov/articles/PMC11894756/). Carbs stay ≥3 g/kg and protein 1.2–2 g/kg. Water and sodium manipulation only under coach/dietitian supervision. No dehydration protocol. After weigh-in: oral rehydration 1–1.5 L/h and ≤60 g/h carbs. Carries a "general guidance, not medical advice; follow your coach/dietitian; no saunas/diuretics for minors" note, which is highlighted if the profile date of birth gives an age under 18.
- **Hooper-style wellness wording:** Fatigue / energy, Muscle soreness, Stress, Mood. All 1–5 with 5 = best. Stored keys (`energy`, `soreness`, `stress`, `mood`) are unchanged, so existing data stays compatible. Sleep is logged separately.
- **Weekly review** (`Insights.weekReview`): rule-based "What went well / What was missed / Focus for next week" from the last 7 days. It uses categories ≥80 (well) and <70 (missed/focus), fully logged days, missed sessions by date and label, 🚩 wellness flags and the weight verdict. It appears in the Coach Report, the weekly email summary (placed before the CSV, so the mailto length limit still applies by trimming CSV rows first) and the share text.

## Testing phase: weekly report to Phill
Config lives in `weekly.js` → `CONFIG`:
- `ADMIN_EMAIL: 'philljustice@gmail.com'` is the weekly report recipient.
- `SHOW_COACH_CONTACT: false` hides the coach email/phone field on sign-up and profile. Existing saved values are kept untouched. The value is never shown on the Coach Report or in the share text. Set it to `true` to bring the field back.

The report week runs Monday–Sunday. On Sunday, and on every open after that until it's sent, the Score screen shows **Send weekly report to Phill**. Tapping it uses the Web Share API with the CSV of all logs attached, plus a text summary: name, score, streak, training sessions done/scheduled + load, wellness average, weight trend, flags (weight-cut warnings, low wellness, notes). The fighter picks Mail. If file sharing isn't supported, it opens a `mailto:` to the admin with subject `FightReady weekly – <fighter> – <Mon> to <Sun>` and the summary plus CSV rows in the body. The body is kept under about 1800 characters by cutting down to the last 14 days (or fewer). The week is marked sent in `weeklySent` (local only). There are manual **Send report to Phill** buttons in Setup and Report. Tested in `test-weekly.js`.
