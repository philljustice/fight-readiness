# CornerReady push worker

Secrets-free snapshot of `/workspace/fight-readiness-push` at commit `ff2c9f3` (live at fr-v60). This folder has no git remote of its own; the plan is to give it one later, only if Phill agrees.

**Live:** https://fight-readiness-push.philljustice.workers.dev  
**Bindings:** `ALLOWED_ORIGIN`, KV `SUBS`, `VAPID_*` (the private key is a Wrangler secret — never commit it)  
**Cron:** every 15 minutes (`*/15`)  
**Health:** `GET /` must return `ok` and the current `phasePolicy`.

```bash
npm test
npx wrangler deploy
```

Do not copy or commit `.dev.vars`, `.secrets/`, or `.wrangler/`. Do not print secret values. Tests must use ephemeral keys only and must not send real pushes or change live subscriptions.
