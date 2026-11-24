// fr-v60: Maintenance push weigh-in reminders follow the outline setting.
import test from 'node:test'; import assert from 'node:assert/strict';
import { dueReminders } from '../src/schedule.js';
import { cleanLifecycle } from '../src/phase-policy.js';
import worker from '../src/index.js';
const life = (x = {}) => ({ version:1, mode:'maintenance', asOf:'2026-11-01', campOptIn:true, paused:false, weighInsPerWeek:3, ...x });
const rec = (x = {}, l = {}) => ({ lifecycle: life(l), tz:'America/Toronto', morning:'07:00', evening:'21:00', name:'UNIT', weighDays:[1,3,5], ...x });
// 2026-11-23 is a Monday; 12:05Z = 07:05 Toronto (EST)
const MON = new Date('2026-11-23T12:05:00Z'), TUE = new Date('2026-11-24T12:05:00Z'), WED = new Date('2026-11-25T12:05:00Z');
test('maintenance weigh-in on outline days only, morning slot', () => {
  const m = dueReminders(rec(), MON); assert.equal(m.length, 1); assert.equal(m[0].kind, 'maint-weigh'); assert.match(m[0].title, /CornerReady: Weigh-in day/); assert.match(m[0].body, /doesn't change your score/);
  assert.equal(dueReminders(rec(), TUE).length, 0, 'Tuesday not an outline day');
  assert.equal(dueReminders(rec(), WED).length, 1, 'Wednesday is (3 a week = Mon/Wed/Fri)');
  assert.equal(dueReminders(rec(), new Date('2026-11-23T17:00:00Z')).length, 0, 'only the morning slot');
});
test('maintenance: 1 a week = Monday only; 0 = off', () => {
  assert.equal(dueReminders(rec({ weighDays:[1] }, { weighInsPerWeek:1 }), MON).length, 1);
  assert.equal(dueReminders(rec({ weighDays:[1] }, { weighInsPerWeek:1 }), WED).length, 0);
  assert.equal(dueReminders(rec({ weighDays:[] }, { weighInsPerWeek:0 }), MON).length, 0);
});
test('maintenance silence: old apps, notifications off, paused, hold, snooze, quiet, already weighed, already sent', () => {
  const old = rec(); delete old.lifecycle.weighInsPerWeek; assert.equal(dueReminders(old, MON).length, 0, 'older app without outline setting stays silent');
  assert.equal(dueReminders(rec({}, { campOptIn:false }), MON).length, 0);
  assert.equal(dueReminders(rec({}, { paused:true }), MON).length, 0);
  assert.equal(dueReminders(rec({}, { restrictionPause:true }), MON).length, 0);
  assert.equal(dueReminders(rec({}, { snoozeUntil:'2026-11-30' }), MON).length, 0);
  assert.equal(dueReminders(rec({}, { quietStart:'06:00', quietEnd:'08:00' }), MON).length, 0);
  assert.equal(dueReminders(rec(), MON, { date:'2026-11-23', weighed:true }).length, 0, 'already weighed today');
  assert.equal(dueReminders(rec({ sent:{ 'maint-weigh':'2026-11-23' } }), MON).length, 0, 'once a day');
  assert.equal(dueReminders(rec(), MON).filter(r => r.kind !== 'maint-weigh').length, 0, 'no camp nags in maintenance');
});
test('camp weigh-ins unchanged (Mon/Thu) and lifecycle keeps only valid weighInsPerWeek', () => {
  const camp = { lifecycle:{ version:1, mode:'camp', asOf:'2026-11-01', fightDate:'2026-12-20', campOptIn:true, paused:false, weighInsPerWeek:3 }, tz:'America/Toronto', morning:'07:00', evening:'21:00', weighDays:[1,4] };
  assert.match(dueReminders(camp, MON)[0].title, /CornerReady: Weigh-in \+ morning check-in/);
  assert.doesNotMatch(dueReminders(camp, WED)[0].title, /Weigh/);
  assert.equal(cleanLifecycle(life({ weighInsPerWeek:9 })).weighInsPerWeek, null);
  assert.equal(cleanLifecycle(life({ weighInsPerWeek:'3' })).weighInsPerWeek, null);
  assert.equal(cleanLifecycle(life({ weighInsPerWeek:0 })).weighInsPerWeek, 0);
});
test('health reports the new policy; /status keeps the weighed flag only', async () => {
  const kv = new Map(), env = { ALLOWED_ORIGIN:'https://philljustice.github.io', SUBS:{ get:async (k, t) => kv.has(k) ? (t === 'json' ? JSON.parse(kv.get(k)) : kv.get(k)) : null, put:async (k, v) => kv.set(k, v), delete:async k => kv.delete(k), list:async () => ({ keys:[...kv.keys()].map(name => ({ name })), list_complete:true }) } };
  const h = await (await worker.fetch(new Request('https://w/'), env)).json(); assert.equal(h.phasePolicy, 'v4-cornerready-maint-weighin-outline');
  const sub = { endpoint:'https://push.example.com/m', keys:{ p256dh:'k', auth:'a' } };
  const post = (p, b) => worker.fetch(new Request('https://w' + p, { method:'POST', headers:{ Origin:'https://philljustice.github.io', 'Content-Type':'application/json' }, body:JSON.stringify(b) }), env);
  assert.equal((await post('/subscribe', { subscription:sub, morning:'07:00', evening:'21:00', weighDays:[1,3,5], lifecycle:life() })).status, 200);
  const id = [...kv.keys()][0]; assert.equal(JSON.parse(kv.get(id)).lifecycle.weighInsPerWeek, 3); assert.deepEqual(JSON.parse(kv.get(id)).weighDays, [1,3,5]);
  assert.equal((await post('/status', { endpoint:sub.endpoint, date:'2026-11-23', complete:false, missing:0, weighed:true, weight:180 })).status, 200);
  const st = JSON.parse(kv.get('st:' + id)); assert.equal(st.weighed, true); assert.equal(st.weight, undefined, 'no weight value stored');
});
