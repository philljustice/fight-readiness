import test from 'node:test'; import assert from 'node:assert/strict';
import { encryptPayload, sendPush, b64u } from '../src/webpush.js';
import { dueReminders, nudgeSlots } from '../src/schedule.js';
import worker, { runCron } from '../src/index.js';

// Ephemeral test-only VAPID key, never reads production/private key files.
const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey);
const vapid={publicKey:b64u.enc(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey))),privateKey:jwk.d,subject:'mailto:unit@example.invalid'};
const enc = new TextEncoder(), cat = (...a) => Uint8Array.from(a.flatMap(x => [...x]));
async function hmac(k, d) { const key = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', key, d)); }
const hkdf = async (s, i, info, n) => (await hmac(await hmac(s, i), cat(info, [1]))).slice(0, n);
async function fakeUA() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
  return { kp, pub, auth, sub: { endpoint: 'https://push.example.com/abc', keys: { p256dh: b64u.enc(pub), auth: b64u.enc(auth) } } };
}
async function decrypt(ua, body) { // receiver side per RFC 8291
  const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.kp.privateKey, 256));
  const ikm = await hkdf(ua.auth, shared, cat(enc.encode('WebPush: info\0'), ua.pub, asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, ct));
  assert.equal(pt[pt.length - 1], 2); return new TextDecoder().decode(pt.slice(0, -1));
}
test('aes128gcm payload decrypts on receiver side', async () => { const ua = await fakeUA(); assert.equal(await decrypt(ua, await encryptPayload(ua.sub, 'hello 🥊')), 'hello 🥊'); });
test('VAPID JWT verifies with public key', async () => {
  const ua = await fakeUA(); let req;
  await sendPush(ua.sub, { t: 1 }, vapid, async (u, o) => { req = o; return new Response(null, { status: 201 }); });
  const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(req.headers.Authorization); assert.equal(k, vapid.publicKey);
  const [h, p, s] = jwt.split('.'); assert.equal(JSON.parse(new TextDecoder().decode(b64u.dec(p))).aud, 'https://push.example.com');
  const key = await crypto.subtle.importKey('raw', b64u.dec(vapid.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64u.dec(s), enc.encode(h + '.' + p)));
  assert.equal(req.headers['Content-Encoding'], 'aes128gcm');
});
const rec = { lifecycle:{version:1,mode:'camp',asOf:'2026-10-01',fightDate:'2026-12-01',campOptIn:true,paused:false}, tz: 'America/Toronto', morning: '07:00', evening: '21:00', name: 'UNIT' };
test('schedule: Monday 7:05 Toronto = weigh-in morning', () => { const d = dueReminders(rec, new Date('2026-10-19T11:05:00Z')); assert.equal(d.length, 1); assert.match(d[0].title, /Weigh-in/); });
test('schedule: Tuesday morning no weigh-in; 7:20 not due', () => { assert.doesNotMatch(dueReminders(rec, new Date('2026-10-20T11:00:00Z'))[0].title, /Weigh/); assert.equal(dueReminders(rec, new Date('2026-10-20T11:20:00Z')).length, 0); });
test('schedule: Sunday 18:00 weekly, 21:00 evening, dedupe by sent', () => {
  const w = dueReminders(rec, new Date('2026-10-25T22:00:00Z')); assert.deepEqual(w.map(x => x.kind), ['weekly']);
  assert.equal(dueReminders(rec, new Date('2026-10-26T01:10:00Z'))[0].kind, 'evening');
  assert.equal(dueReminders({ ...rec, sent: { weekly: '2026-10-25' } }, new Date('2026-10-25T22:00:00Z')).length, 0);
});
test('schedule: other timezone (Vancouver)', () => assert.equal(dueReminders({ ...rec, tz: 'America/Vancouver' }, new Date('2026-10-20T14:00:00Z'))[0].kind, 'morning'));
function kv() { const m = new Map(); return { m, get: async (k, t) => m.has(k) ? (t === 'json' ? JSON.parse(m.get(k)) : m.get(k)) : null, put: async (k, v) => m.set(k, v), delete: async k => m.delete(k), list: async () => ({ keys: [...m.keys()].map(name => ({ name })), list_complete: true }) }; }
const env = () => ({ SUBS: kv(), ALLOWED_ORIGIN: 'https://philljustice.github.io', VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: vapid.subject });
const post = (path, body, origin = 'https://philljustice.github.io') => new Request('https://w.dev' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('endpoints + CORS + cron + 410 cleanup', async () => {
  const e = env(), ua = await fakeUA(), ua2 = await fakeUA(); ua2.sub.endpoint = 'https://push.example.com/gone';
  assert.equal((await worker.fetch(post('/subscribe', { subscription: ua.sub }, 'https://evil.com'), e)).status, 403);
  const pre = await worker.fetch(new Request('https://w.dev/subscribe', { method: 'OPTIONS', headers: { Origin: 'https://philljustice.github.io' } }), e);
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), 'https://philljustice.github.io');
  assert.equal((await worker.fetch(post('/update', { subscription: ua.sub }), e)).status, 404);
  const r = await worker.fetch(post('/subscribe', { subscription: ua.sub, ...rec, name: 'UNIT Athlete', log: 'x' }), e); assert.equal(r.status, 200);
  const stored = JSON.parse([...e.SUBS.m.values()][0]); assert.equal(stored.name, 'UNIT'); assert.equal(stored.log, undefined);
  assert.equal((await worker.fetch(post('/subscribe', { subscription: ua2.sub, ...rec }), e)).status, 200);
  assert.equal((await worker.fetch(post('/update', { subscription: ua.sub, ...rec, morning: '06:30' }), e)).status, 200);
  assert.equal((await worker.fetch(post('/update', { subscription: ua.sub, ...rec }), e)).status, 200);
  const got = []; const res = await runCron(e, new Date('2026-10-19T11:02:00Z'), async (u, o) => { if (u.endsWith('/gone')) return new Response(null, { status: 410 }); got.push(await decrypt(ua, o.body)); return new Response(null, { status: 201 }); });
  assert.deepEqual(res, { sent: 1, removed: 1 }); assert.match(JSON.parse(got[0]).title, /Weigh-in/); assert.equal(e.SUBS.m.size, 1);
  assert.equal((await runCron(e, new Date('2026-10-19T11:10:00Z'), async () => assert.fail('dup'))).sent, 0);
  assert.equal((await worker.fetch(post('/unsubscribe', { endpoint: ua.sub.endpoint }), e)).status, 200); assert.equal(e.SUBS.m.size, 0);
});

// ---- follow-up nudges until today's log is complete ----
const T = (iso) => new Date(iso); // Toronto is UTC-4 in Oct (EDT) until Nov 1, 2026
const nrec = { ...rec, remind: true, evening: '19:00' };
const kinds = (r, iso, st) => dueReminders(r, T(iso), st).map(x => x.kind);
test('nudgeSlots: evening+2h and 21:30, min 30 min apart, none after 23:00', () => {
  assert.deepEqual(nudgeSlots('19:00').map(x => [x.kind, x.min]), [['followup', 21 * 60], ['final', 21 * 60 + 30]]);
  assert.deepEqual(nudgeSlots('18:00').map(x => [x.kind, x.min]), [['followup', 20 * 60], ['final', 21 * 60 + 30]]);
  assert.deepEqual(nudgeSlots('21:00').map(x => [x.kind, x.min]), [['final', 21 * 60 + 30], ['followup', 23 * 60]]);
  assert.deepEqual(nudgeSlots('22:00'), []); assert.deepEqual(nudgeSlots('21:30'), []); assert.deepEqual(nudgeSlots('23:00'), []);
});
test('nudges: default 21:00 evening -> 21:00 reminder, 21:30 last call, 23:00 follow-up', () => {
  const r = { ...rec, remind: true };
  assert.deepEqual(kinds(r, '2026-10-21T01:00:00Z'), ['evening']); assert.deepEqual(kinds(r, '2026-10-21T01:30:00Z'), ['final']); assert.deepEqual(kinds(r, '2026-10-21T03:00:00Z'), ['followup']);
});
test('nudges: incomplete -> evening, +2h follow-up, 9:30 PM final; each once per day', () => {
  const st = { date: '2026-10-20', complete: false, missing: 3 };
  assert.deepEqual(kinds(nrec, '2026-10-20T23:00:00Z', st), ['evening']); // 19:00 EDT
  assert.match(dueReminders(nrec, T('2026-10-20T23:00:00Z'), st)[0].body, /3 items still to log/);
  const f = dueReminders(nrec, T('2026-10-21T01:00:00Z'), st); assert.deepEqual(f.map(x => x.kind), ['followup']); assert.equal(f[0].tag, 'fr-nudge'); assert.match(f[0].body, /Finish today's log: 3 items/);
  const l = dueReminders(nrec, T('2026-10-21T01:30:00Z'), st); assert.deepEqual(l.map(x => x.kind), ['final']); assert.match(l[0].title, /Last call/);
  assert.deepEqual(kinds({ ...nrec, sent: { followup: '2026-10-20', final: '2026-10-20', evening: '2026-10-20' } }, '2026-10-21T01:30:00Z', st), []);
  assert.deepEqual(kinds(nrec, '2026-10-21T01:20:00Z', st), []); // not on a slot
});
test('nudges: stop as soon as complete (evening reminder too); flag from another day is ignored', () => {
  const done = { date: '2026-10-20', complete: true, missing: 0 };
  for (const iso of ['2026-10-20T23:00:00Z', '2026-10-21T01:00:00Z', '2026-10-21T01:30:00Z']) assert.deepEqual(kinds(nrec, iso, done), []);
  const old = { date: '2026-10-19', complete: true, missing: 0 }; assert.deepEqual(kinds(nrec, '2026-10-21T01:00:00Z', old), ['followup']);
  assert.deepEqual(kinds(nrec, '2026-10-21T01:00:00Z', null), ['followup']); // nothing logged yet today = incomplete
  assert.match(dueReminders(nrec, T('2026-10-21T01:00:00Z'), null)[0].body, /UNIT, finish today's log/);
});
test('nudges: toggle off / old app (no remind) = old behaviour, morning unchanged', () => {
  const off = { ...nrec, remind: false }; const st = { date: '2026-10-20', complete: false, missing: 5 };
  assert.deepEqual(kinds(off, '2026-10-20T23:00:00Z', st), ['evening']); assert.match(dueReminders(off, T('2026-10-20T23:00:00Z'), st)[0].body, /nutrition, training, screen time, family/);
  assert.deepEqual(kinds(off, '2026-10-21T01:00:00Z', st), []); assert.deepEqual(kinds(off, '2026-10-21T01:30:00Z', st), []);
  assert.deepEqual(kinds({ ...off, evening: '19:00' }, '2026-10-20T23:00:00Z', { date: '2026-10-20', complete: true }), ['evening']); // old behaviour: always sent
  assert.deepEqual(kinds(nrec, '2026-10-20T11:00:00Z', st), ['morning']); assert.match(dueReminders(nrec, T('2026-10-20T11:00:00Z'), st)[0].title, /Morning check-in/);
});
test('nudges: respect subscriber timezone', () => {
  const v = { ...nrec, tz: 'America/Vancouver' }; assert.deepEqual(kinds(v, '2026-10-21T04:00:00Z'), ['followup']); // 21:00 PDT
  assert.deepEqual(kinds(v, '2026-10-21T01:00:00Z'), []); // 18:00 PDT
});
test('worker: /status stores only a flag (TTL 2 days), cron uses it, unsubscribe clears it', async () => {
  const e = env(), ua = await fakeUA(); const puts = []; const put = e.SUBS.put; e.SUBS.put = async (k, v, o) => { puts.push([k, o]); return put(k, v, o); };
  const mk = (b, o) => post('/status', { endpoint: ua.sub.endpoint, ...b }, o);
  assert.equal((await worker.fetch(mk({ date: '2026-10-20', complete: false, missing: 3 }), e)).status, 404); // not subscribed
  assert.equal((await worker.fetch(post('/subscribe', { subscription: ua.sub, ...rec, evening: '19:00', remind: true, log: 'secret' }), e)).status, 200);
  assert.equal(JSON.parse([...e.SUBS.m.values()][0]).remind, true);
  assert.equal((await worker.fetch(mk({ date: '2026-10-20', complete: false, missing: 3 }, 'https://evil.com'), e)).status, 403);
  assert.equal((await worker.fetch(mk({ date: 'x', complete: false }), e)).status, 400); assert.equal((await worker.fetch(mk({ date: '2026-10-20', complete: 'yes' }), e)).status, 400);
  assert.equal((await worker.fetch(mk({ date: '2026-10-20', complete: false, missing: 3, weight: 180, notes: 'knee hurts' }), e)).status, 200);
  const stKey = [...e.SUBS.m.keys()].find(k => k.startsWith('st:')); assert.deepEqual(JSON.parse(e.SUBS.m.get(stKey)), { date: '2026-10-20', complete: false, missing: 3, morning: false, recoveryCheckin: false, weighed: false });
  assert.equal(puts.at(-1)[1].expirationTtl, 172800);
  const n = puts.length; await worker.fetch(mk({ date: '2026-10-20', complete: false, missing: 3 }), e); assert.equal(puts.length, n); // unchanged = no KV write
  const got = []; const f = async (u, o) => { got.push(JSON.parse(await decrypt(ua, o.body))); return new Response(null, { status: 201 }); };
  assert.equal((await runCron(e, T('2026-10-21T01:00:00Z'), f)).sent, 1); assert.equal(got[0].tag, 'fr-nudge'); assert.match(got[0].body, /3 items/);
  assert.equal((await runCron(e, T('2026-10-21T01:05:00Z'), f)).sent, 0); // already sent today
  await worker.fetch(mk({ date: '2026-10-20', complete: true, missing: 0 }), e);
  assert.equal((await runCron(e, T('2026-10-21T01:30:00Z'), async () => assert.fail('must not nudge once complete'))).sent, 0);
  assert.equal((await worker.fetch(post('/unsubscribe', { endpoint: ua.sub.endpoint }), e)).status, 200); assert.equal(e.SUBS.m.size, 0);
});

// fr-v41: morning check-in skipped once the app reports the Morning tile done
{
  const { dueReminders } = await import('../src/schedule.js');
  const rec = { lifecycle:{version:1,mode:'camp',asOf:'2026-10-01',fightDate:'2026-12-01',campOptIn:true,paused:false}, tz:'America/Toronto', morning:'07:00', evening:'21:00', remind:true, weighDays:[] };
  const now = new Date('2026-11-03T12:05:00Z'); // 07:05 Toronto
  if (!dueReminders(rec, now, null).some(r => r.kind === 'morning')) throw new Error('morning should send without status');
  if (dueReminders(rec, now, { date:'2026-11-03', complete:false, missing:4, morning:true }).some(r => r.kind === 'morning')) throw new Error('morning should be skipped');
  console.log('morning skip ok');
}
