import test from 'node:test'; import assert from 'node:assert/strict'; import ece from 'http_ece'; import nc from 'node:crypto';
import { encryptPayload } from '../src/webpush.js';
test('independent http_ece library decrypts our payload', async () => {
  const ua = nc.createECDH('prime256v1'); ua.generateKeys(); const auth = nc.randomBytes(16);
  const body = await encryptPayload({ endpoint: 'https://x', keys: { p256dh: ua.getPublicKey('base64url'), auth: auth.toString('base64url') } }, '{"title":"hi"}');
  assert.equal(ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: ua, dh: undefined, authSecret: auth }).toString(), '{"title":"hi"}');
});
