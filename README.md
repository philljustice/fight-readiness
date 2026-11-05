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

## Hydration check
Morning check-in has **First pee colour this morning**: 8 tappable colour swatches (pale straw to dark amber/brown), no numbers or labels. Stored as `hydration` (1-8) on the day's entry. 1-3 = Hydrated (green), 4-5 = Drink more (amber), 6-8 = Dehydrated (red), with a short tip after tapping. It is required for new days only (v2 entries dated 2026-10-28 or later, `HYD_FROM` in `scoring.js`); older days without it still count complete. It never changes the score. Shown on the Morning tile, a 7-day strip on Score and Report, the weekly report image, and CSV (`Hydration_Colour`, `Hydration_Status`; the colour column is also read on import). Flags: 2+ dehydrated mornings in 7 days; fight-week and weigh-in hydration alerts come from `WeightPlan.hydAlert` (see Weight plan below; opt-in aware). Tested in `test-hydration.js`.

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
- **Wellness** uses Energy, Soreness, Mood and Stress, each 1–5. Energy and Mood: 5 = best. Soreness and Stress: higher = higher (1 = no soreness / very relaxed, 5 = very sore / very stressed), flipped internally (6 − v) for scoring. They're mapped worst→0 … best→100 and averaged, over days that have all four. All four are required daily. Energy/Mood 1–2 or Soreness/Stress 4–5 in the last 3 days raises a 🚩 flag. **Migration:** data stored before fr-v39 used 5 = best for soreness/stress; on first launch of fr-v39 each device flips those values once (v → 6 − v) and sets `wellScale: 2` in its saved state, so historical scores are unchanged. Old JSON backups (no `wellScale`) and old CSVs (no `Wellness_Scale` column) are converted on import.
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
- **Weight plan (`weightplan.js`, since fr-v50):** one model for every division. Personal fight-week allowance A (%): 5 day-before / 4 mid / 3 same-day weigh-in, −1 age 18–20, −1 first/some cut experience, −1 last cut went badly, +1 experienced and fine; clamped 2–6, capped at 3 without the water-cut opt-in and 2 for under-18s. Chronic loss 1%/week (0.75% under 18) until 5 days out. Bands On track / In range / Tight / Unsafe. The coach is responsible for choosing the division; Tight/Unsafe flag the Coach Report. (Old `Insights.cutPlan` is still in insights.js for back-compat.)
- **Daily weigh-in check:** the Log weigh-in compares to the day's plan target. `Insights.weightVerdict` remains only as a fallback when no plan can be built.
- **Fight-week card** (`WeightPlan.steps`): under Today's training, 7 days out to weigh-in, plus fight day after a day-before weigh-in. Water-cut steps (water loading, then fluid cut from 2 days out) appear only if the fighter opted in at sign-up with the acknowledgement that it is a guideline only, not medical advice. Never for under-18s. Stop signs in Help (#helpStop).
- **Hydration in the weight plan (fr-v51):** before fight week, a weigh-in is *water-affected* if that morning's pee colour is 6–8 or 2 of the last 3 mornings were; it is never credited as On track, the plan uses the last hydrated weigh-in, and the app says "Hydrate and re-weigh; this drop is likely water, not real loss." Fight week (`WeightPlan.hydAlert`): opted in + 6+ on water-loading days (5–3 days out) = 🛑 "drying out too early" stop sign; not opted in + 6+ = drink normally; under-18 + 6+ = warning at any time; weigh-in day/fight day = rehydration check, goal pale (1–3). Coach Report weight plan shows pee colour next to check-ins and recent weigh-ins, with water-affected flags.
- **Hooper-style wellness wording:** Fatigue / energy, Muscle soreness, Stress, Mood. All 1–5; Energy/Mood 5 = best, Soreness/Stress 5 = worst (since fr-v39). Stored keys (`energy`, `soreness`, `stress`, `mood`) are unchanged, so existing data stays compatible. Sleep is logged separately.
- **Weekly review** (`Insights.weekReview`): rule-based "What went well / What was missed / Focus for next week" from the last 7 days. It uses categories ≥80 (well) and <70 (missed/focus), fully logged days, missed sessions by date and label, 🚩 wellness flags and the weight verdict. It appears in the Coach Report, the weekly email summary (placed before the CSV, so the mailto length limit still applies by trimming CSV rows first) and the share text.

## Testing phase: weekly report to Phill
Config lives in `weekly.js` → `CONFIG`:
- `ADMIN_EMAIL: 'philljustice@gmail.com'` is the weekly report recipient.
- `SHOW_COACH_CONTACT: false` hides the coach email/phone field on sign-up and profile. Existing saved values are kept untouched. The value is never shown on the Coach Report or in the share text. Set it to `true` to bring the field back.

The report week runs Monday–Sunday. On Sunday, and on every open after that until it's sent, the Score screen shows **Send weekly report to Phill**. Tapping it uses the Web Share API with the CSV of all logs attached, plus a text summary: name, score, streak, training sessions done/scheduled + load, wellness average, weight trend, flags (weight-cut warnings, low wellness, notes). The fighter picks Mail. If file sharing isn't supported, it opens a `mailto:` to the admin with subject `FightReady weekly – <fighter> – <Mon> to <Sun>` and the summary plus CSV rows in the body. The body is kept under about 1800 characters by cutting down to the last 14 days (or fewer). The week is marked sent in `weeklySent` (local only). There are manual **Send report to Phill** buttons in Setup and Report. Tested in `test-weekly.js`.

## Extended morning wellness & smart watches (fr-v40)

New morning items: Sleep quality (1–5, 5 = best), Motivation / readiness to train (1–5), Appetite (1–5), Injury / pain (`none` / `minor` / `limiting` + body area; higher = worse), Ill (yes/no), Resting HR (bpm, watch users only). Stored keys: `sleepq`, `motivation`, `appetite`, `injury`, `injuryArea`, `ill`, `rhr`, `sleepDev` (raw device sleep score), `sleepDevice` (device at entry time). Profile: `profile.device`. Entry is manual only; there is no device API integration.

**Wellness weighting** (weighted average of the items present; anything not logged is left out, so older entries score exactly as before): Energy, Soreness (flipped), Mood, Stress (flipped), Sleep quality, Motivation, Injury (None 100 / Minor 50 / Limiting 0), Illness (No 100 / Yes 0), Resting HR: weight 1 each. Appetite: weight 0.5. The 4 core ratings are still required for a wellness score.

**Required on the log** (days from 2026-11-02): motivation, appetite, and perceived sleep quality when no watch is used. Injury defaults to None and illness to No. Watch sleep score and resting HR are optional.

**Resting HR:** baseline = median of readings in the previous 30 days once there are 7+. Score 100 up to +2 bpm over baseline, linear to 0 at +10. 🚩 at +5 or more. No baseline means no effect on the score.

**Red flags (last 3 days):** limiting injury, illness, resting HR +5 over baseline, motivation / sleep quality / appetite 1–2, a watch sleep score that maps under 50.

**Device sleep scores → in-app sleep quality (0–100).** Linear between anchors: start of the maker's top band → 90, start of its "good" band → 75 (par), start of "fair" → 50, 0 → 0.

| Device | Maker's bands | Anchors (device → app) | Source |
|---|---|---|---|
| Garmin | Excellent 90–100, Good 80–89, Fair 60–79, Poor <60 | 0→0, 60→50, 80→75, 90→90, 100→100 | https://www.garmin.com/en-US/blog/fitness/how-well-do-you-sleep-new-data-examines-garmin-users-sleep/ |
| Fitbit / Google | Excellent 90–100, Good 80–89, Fair 60–79, Poor <60 | same as Garmin | https://support.google.com/fitbit/answer/14236513 |
| Apple Watch (watchOS 26.2+) | Very High 96–100, High 81–95, OK 61–80, Low 41–60, Very Low 0–40 | 0→0, 41→25, 61→50, 81→75, 96→90, 100→100 | https://support.apple.com/guide/watch/view-your-sleep-score-apded441a669/26/watchos/26 |
| Oura | Optimal 85–100, Good 70–84, Fair 60–69, Pay attention <60 | 0→0, 60→50, 70→75, 85→90, 100→100 | https://support.ouraring.com/hc/en-us/articles/360025445574-Sleep-Score |
| WHOOP Sleep Performance % | Optimal 85%+, Sufficient 70–84%, Poor <70% | 0→0, 70→75, 85→90, 100→100 | https://www.whoop.com/us/en/thelocker/how-well-whoop-measures-sleep/ |
| Samsung Galaxy Watch | Excellent / Good / Fair / Needs attention (numeric cut-offs not published; 85+ described as a healthy night) | 0→0, 60→50, 85→90, 100→100 | https://www.samsung.com/uk/mobile-phone-buying-guide/how-do-smartwatches-track-your-sleep/ |
| Other | generic 0–100 | identity | — |

CSV adds optional columns `Sleep_Quality, Sleep_Device, Device_Sleep_Score, Motivation, Appetite, Injury, Injury_Area, Ill, Resting_HR`. Older CSVs without them import unchanged. JSON backups carry the fields as-is.

## Quick tutorial (fr-v54)
New profile creation queues a seven-step, read-only guided tour after the splash has finished. Existing installs do not auto-start it; restoring a backup marks it restored rather than queuing onboarding. Help has a prominent **Replay tutorial** button (enabled after a profile exists). Steps: Score/readiness → Today's training → Log/morning and evening, green completed tiles → Schedule → Coach Report → Setup/backup/watch → Help/replay.

Skip or Escape closes it; Back/Next and Finish navigate the tour. A refresh during the tour does not reopen it. `S.tutorial` records pending/skipped/completed/restored with the local profile/install; it is included in JSON backups. The spotlight scrolls to each target; its dialog stays within the visual viewport, has keyboard focus containment/restoration, an inert background, step count and no animations (including for reduced motion). No logs, schedules, scores or health rules are edited. Unit/static verification: `node test-tutorial.js`; phone-browser visual verification should check short/landscape screens, zoom, screen-reader announcements and safe-area placement.

### Tutorial follow-up (fr-v55)
Coach Report spotlights its concise heading rather than the entire summary card. Where a tooltip cannot fit above or below, it reserves a visible target strip, scrolls the target into it and limits the tooltip height with internal scrolling. Finish returns to Score; Skip/Escape restores the starting tab.

### iPhone tutorial bounds (fr-v56)
All steps use stable bottom docking inside the intersection of visualViewport and the layout viewport safe area. Safe-area lengths are measured as computed padding on an invisible probe. Tooltips keep 12px safe margins, limit their actual content height and scroll internally for larger text/short screens. Scroll no longer switches the tooltip above a tall target. Font readiness, ResizeObserver and viewport resize/scroll trigger reflow. Geometry regressions include iPhone 393×852 with 59px top/34px bottom insets, short landscape, offset visual viewports, large text and tall score targets. Actual iPhone visual verification remains separate from these Node tests.
