import { sendPush } from './webpush.js';
import { dueReminders } from './schedule.js';
import { cleanLifecycle, mergeLifecycle } from './phase-policy.js';

const ST = 'st:', TTL = 2 * 86400; // completion flags expire after 2 days
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const json = (o, s, h) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json', ...h } });
async function idFor(endpoint) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)); return [...new Uint8Array(d)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join(''); }
function validTz(tz) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }

export function clean(body) {
  const s = body.subscription || {};
  if (typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 1000 || !s.keys || !s.keys.p256dh || !s.keys.auth) throw new Error('bad subscription');
  const r = { sub: { endpoint: s.endpoint, keys: { p256dh: String(s.keys.p256dh), auth: String(s.keys.auth) } } };
  r.morning = TIME.test(body.morning) ? body.morning : '07:00';
  r.evening = TIME.test(body.evening) ? body.evening : '21:00';
  r.weekly = TIME.test(body.weekly) ? body.weekly : '18:00';
  r.tz = typeof body.tz === 'string' && validTz(body.tz) ? body.tz : 'UTC';
  r.weighDays = Array.isArray(body.weighDays) ? body.weighDays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6).slice(0, 7) : [1, 4];
  r.remind = body.remind === true; // opt-in per app version: older apps never send it, so they get no follow-ups
  r.name = typeof body.name === 'string' ? body.name.trim().split(/\s+/)[0].slice(0, 20) : '';
  r.lifecycle=cleanLifecycle(body.lifecycle); // only minimal dates/preferences; never symptoms, notes, logs or weights
  return r;
}

export async function runCron(env, now = new Date(), fetchImpl = fetch) {
  const vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT };
  let cursor, sent = 0, removed = 0;
  do {
    const page = await env.SUBS.list({ cursor }); cursor = page.list_complete ? null : page.cursor;
    for (const k of page.keys) {
      if (k.name.startsWith(ST)) continue; // completion flags live beside subscribers
      const rec = await env.SUBS.get(k.name, 'json'); if (!rec) continue;
      let status = null;
      const probe = dueReminders(rec, now, { date: '-' });
      if (probe.length && (rec.remind || (rec.lifecycle && (rec.lifecycle.mode === 'recovery' || rec.lifecycle.mode === 'maintenance')))) status = await env.SUBS.get(ST + k.name, 'json');
      const due = dueReminders(rec, now, status); if (!due.length) continue;
      let gone = false;
      for (const d of due) {
        const res = await sendPush(rec.sub, { title: d.title, body: d.body, tab: d.tab, tag: d.tag || 'fr-' + d.kind }, vapid, fetchImpl);
        if (res.status === 404 || res.status === 410) { gone = true; break; }
        if (res.ok) {
          rec.sent = { ...rec.sent, [d.kind]: d.date };
          if (d.kind === 'rec-review' || d.kind === 'rec-checkin' || d.kind === 'rec-day1-am' || d.kind === 'rec-day1-pm') {
            const prev = Array.isArray(rec.recoverySendDates) ? rec.recoverySendDates.filter(x => typeof x === 'string') : [];
            if (!prev.includes(d.date)) prev.push(d.date);
            rec.recoverySendDates = prev.slice(-14); // keep two weeks of day marks
          }
          sent++;
        }
        else console.log('push failed', res.status, await res.text().catch(() => ''));
      }
      if (gone) { await env.SUBS.delete(k.name); await env.SUBS.delete(ST + k.name); removed++; } else await env.SUBS.put(k.name, JSON.stringify(rec));
    }
  } while (cursor);
  return { sent, removed };
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '', allowed = (env.ALLOWED_ORIGIN || '').split(',');
    const cors = allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : null;
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'fight-readiness-push', phasePolicy: 'v4-cornerready-maint-weighin-outline' });
    if (!cors) return json({ error: 'origin not allowed' }, 403);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ error: 'method' }, 405, cors);
    let body; try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, cors); }
    try {
      if (url.pathname === '/unsubscribe') {
        if (!body.endpoint && !(body.subscription || {}).endpoint) throw new Error('endpoint required');
        const id = await idFor(body.endpoint || body.subscription.endpoint); await env.SUBS.delete(id); await env.SUBS.delete(ST + id); return json({ ok: true }, 200, cors);
      }
      if (url.pathname === '/subscribe' || url.pathname === '/update') {
        const r = clean(body), id = await idFor(r.sub.endpoint), old = await env.SUBS.get(id, 'json');
        if (url.pathname === '/update' && !old) return json({ error: 'not subscribed' }, 404, cors);
        r.lifecycle = mergeLifecycle(old && old.lifecycle, r.lifecycle);
        // keep "sent today" marks only if the time didn't change; recovery kinds keep week/day marks across preference sync
        r.sent = {}; if (old && old.sent) {
          for (const k of ['morning', 'evening', 'weekly']) if (old[k] === r[k]) r.sent[k] = old.sent[k];
          if (old.morning === r.morning && old.sent['maint-weigh']) r.sent['maint-weigh'] = old.sent['maint-weigh'];
          if (old.evening === r.evening) for (const k of ['followup', 'final']) if (old.sent[k]) r.sent[k] = old.sent[k];
          for (const k of ['rec-review', 'rec-checkin', 'rec-day1-am', 'rec-day1-pm']) if (old.sent[k]) r.sent[k] = old.sent[k];
          if (Array.isArray(old.recoverySendDates)) r.recoverySendDates = old.recoverySendDates.filter(x => typeof x === 'string').slice(-14);
        }
        await env.SUBS.put(id, JSON.stringify(r)); return json({ ok: true, id }, 200, cors);
      }
      if (url.pathname === '/status') { // { endpoint, date, complete, missing }: a completion flag only, never log data
        if (typeof body.endpoint !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || typeof body.complete !== 'boolean') throw new Error('bad status');
        const id = await idFor(body.endpoint); if (!(await env.SUBS.get(id))) return json({ error: 'not subscribed' }, 404, cors);
        const st = { date: body.date, complete: body.complete, missing: Number.isInteger(body.missing) ? Math.max(0, Math.min(12, body.missing)) : 0, morning: body.morning === true, recoveryCheckin: body.recoveryCheckin === true, weighed: body.weighed === true };
        const old = await env.SUBS.get(ST + id, 'json');
        if (!old || old.date !== st.date || old.complete !== st.complete || old.missing !== st.missing || old.morning !== st.morning || old.recoveryCheckin !== st.recoveryCheckin || old.weighed !== st.weighed) await env.SUBS.put(ST + id, JSON.stringify(st), { expirationTtl: TTL });
        return json({ ok: true }, 200, cors);
      }
      return json({ error: 'not found' }, 404, cors);
    } catch (e) { return json({ error: e.message }, 400, cors); }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(runCron(env, new Date(event.scheduledTime))); },
};
