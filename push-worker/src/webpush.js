// Minimal RFC 8291 (aes128gcm) + RFC 8292 (VAPID) Web Push using WebCrypto only.
const enc = new TextEncoder();
export const b64u = {
  enc: (buf) => { const b = new Uint8Array(buf); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); },
  dec: (str) => { str = str.replace(/-/g,'+').replace(/_/g,'/'); while (str.length % 4) str += '='; const s = atob(str); return Uint8Array.from(s, c => c.charCodeAt(0)); },
};
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hmac(key, data) { const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', k, data)); }
async function hkdf(salt, ikm, info, len) { const prk = await hmac(salt, ikm); return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, len); }

// vapid: { publicKey: b64url uncompressed P-256 (65 bytes), privateKey: b64url d (32 bytes), subject: 'mailto:...' }
async function vapidHeader(endpoint, vapid, ttlSec = 12 * 3600) {
  const aud = new URL(endpoint).origin;
  const pub = b64u.dec(vapid.publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', d: vapid.privateKey, x: b64u.enc(pub.slice(1, 33)), y: b64u.enc(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const h = b64u.enc(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const p = b64u.enc(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + ttlSec, sub: vapid.subject })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${h}.${p}`));
  return `vapid t=${h}.${p}.${b64u.enc(sig)}, k=${vapid.publicKey}`;
}

export async function encryptPayload(sub, plaintext) {
  const uaPub = b64u.dec(sub.keys.p256dh), auth = b64u.dec(sub.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, concat(enc.encode(plaintext), new Uint8Array([2]))));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

export async function sendPush(sub, payload, vapid, fetchImpl = fetch) {
  const body = await encryptPayload(sub, typeof payload === 'string' ? payload : JSON.stringify(payload));
  return fetchImpl(sub.endpoint, { method: 'POST', body, headers: {
    Authorization: await vapidHeader(sub.endpoint, vapid), 'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream', TTL: '43200', Urgency: 'normal' } });
}
