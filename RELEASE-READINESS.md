# Recovery / Maintenance fr-v57 — REVIEW CANDIDATE, NOT RELEASE APPROVED

## Production freeze and savepoint
Verified local main, remote main and live service worker: fr-v56 at `b397e56295e431f81b4762f4fa085958f3790890`.
Annotated tag pushed and remote peeled SHA verified: `savepoint-before-recovery-maintenance-2026-11-05`.
Existing savepoint tags preserved.
Source archive: `/workspace/fr-savepoints/fightready-fr-v56-b397e562-2026-11-05.tar.gz`.
Archive SHA256: `1013c6b311c0e06f48ce3f26c9d3610cb3d09d25c21ebe50d73b966ad09c48c9`.

Candidate is committed only on local `preview/recovery-v1` in `/workspace/fight-readiness-recovery-preview`.
After the content commit the exact frozen SHA and check results are written to `/workspace/fr-recovery-release/RELEASE-READINESS.md` and `/workspace/fr-recovery-release/release-manifest.json`. Those external records identify the immutable commit; do not deploy an uncommitted worktree or infer readiness from the version number.
Earliest authorized production release: **Monday November 9, 2026 00:00 EST** (`2026-11-09T05:00:00Z`). No main push/merge, production Pages deployment, or production push-worker change has occurred.

## Implemented
- Explicit scheduler, separate weigh-in record, new/rescheduled/cancelled/postponed bouts, configurable 3–14-day recovery, extension, next-day transitions and maintenance with no date.
- Persistent protective holds, care flags and clinician/commission-only recorded clearance. Not a diagnosis or clinical validation. New bouts never bypass recovery/holds.
- Regular morning/evening/wellness/training controls in optional non-camp logging. Camp logic/weight model unchanged; cut cards and daily completeness pressure are off outside camp.
- Versioned non-destructive migration, local pre-upgrade copy attempt, backup/restore, separate immutable camp snapshots and per-bout questionnaire history.
- Optional care-first questionnaire, discipline follow-ups, free area notes, defer/dismiss/resume, answer-only generated draft, editable coach summary and separate coach notes, existing manual text-sharing/print flow.
- Maintenance rolling process score, achievable coach-agreed check-in/session goals, optional weekly goal checkmarks, three-reading hydrated-band discussions and conservative frequency/intensity conversations suppressed during restrictions/illness/recovery. No score reward for weight, symptom improvement, intensity or excessive sessions.
- Plain daily recovery comments, social prompts days 2/5 each week, social gym/no-workout wording and quiet-call alternatives, break/gentle preference and restricted variants with no return deadline.
- In-app prompt opt-in, quiet hours, snooze and pause. These are not push consent. No recovery/maintenance push is enabled.
- Approved existing crown asset; brief skippable silent F/R/ring/rays confirmation for a newly confirmed bout only. Reduced-motion static variant. Reschedule is calm.

## Checks
22 Node test files pass (`npm ci && npm test`), including DOM-unit (not browser) integration, legacy/new-profile and backup migration, timezone/DST/calendar-day boundaries, recovery extensions, cancellation/rescheduling, persistent holds and clearance authority, isolated camp snapshots, optional ordinary logs, questionnaire skipped items, process score direction, no load/weight incentives, hydrated-band persistence, reminder preferences and animation/reduced-motion/safe-area static checks.
`node --check` and `git diff --check` pass. `weightplan.js`, `scoring.js` and `push.js` are unchanged.

## Hard release blockers — do not blindly release at midnight
1. **Visual QA pending:** parent computerUse must review phone sizes, iPhone safe areas, regular optional logging, long questionnaire, saved drafts, scheduler, Maintenance, replay tutorial after lifecycle changes, animation and reduced motion. No actual device/browser validation is claimed.
2. **Existing remote camp notifications:** suppressing foreground camp reminders and new non-camp subscriptions does not cancel existing server-side subscriptions. The current push worker has no lifecycle schedule support. Before release, implement/test an approved release-time pause/phase policy or explicitly resolve this limitation. Do not deploy this candidate while it can nag a recovering fighter. No production push-worker change has been made.
3. **Migration acceptance:** automated round-trips pass; parent must exercise representative anonymized old backups on the test origin and confirm camp history, edits and export/restore. Never use real Pablo/Diego data on the public tester.
4. **Weigh-in timing reconciliation:** scheduler stores an explicit event date while the unchanged camp weight model uses profile timing. UI discloses this. Review with parent whether this is sufficient or needs a related integration before release.
5. **Product/medical copy review:** conservative wellness flags currently record persistent protective holds; ensure this conservative behavior is desired. The app cannot verify professional clearance. No validated clinical protocol is claimed.

## Scheduled release checklist
- Confirm exact SHA against external manifest; no unresolved blockers; obtain/record visual and migration QA.
- Re-run npm ci/test at that SHA; ensure production main is still the savepoint SHA and live is fr-v56. If unexpected, stop.
- At or after authorized midnight EST only, release the approved exact candidate via the authorized routine. Do not improvise a different SHA.
- Coordinate the approved reminder-worker policy at release, never earlier. Do not mutate subscriptions from the tester.
- Verify Pages fr-v57 app.js/sw.js, required assets, update behavior, real-origin backup continuity and phase screens.
- Keep savepoint/tag/archive intact. A frontend rollback does not roll back local schema-v3 data; use exported backups and reviewed migration policy.

## Separate tester
Public sample-only origin: https://fightready-recovery-test.philljustice.workers.dev/ .
Local safe tester: http://localhost:8107/preview.html .
Tester has a fixed disclosed Nov 5, 2026 clock, separate localStorage key, TEST icon/title/badge, no service worker, no live push module and disabled external sharing/import. Choose SAMPLE day2/day5/injured/maintenance/camp/no-date. It is built outside the production checkout by `/workspace/fr-build-recovery-tester.py`; fixtures are not part of the production entrypoint or release artifact.
Pablo alone has tested the app through a camp. No real athlete data or Diego app-assessment claims are included.
