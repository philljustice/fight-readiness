// Web Push reminders via the Cloudflare Worker (fight-readiness-push).
const Push = (() => {
  const CONFIG = {
    WORKER_URL: 'https://fight-readiness-push.REPLACE-ME.workers.dev', // set after `wrangler deploy`
    VAPID_PUBLIC_KEY: 'BEmDoaMF8fOZOVErc87lv4SdzLAsVmQgrQFWugnlFMe2-q2pFFOfGTvhtAZ6mokkTJYtMhTND6bQzY-BUvqZFuA',
  };
  const configured = () => !/REPLACE-ME/.test(CONFIG.WORKER_URL);
  const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  // 'ok' | 'ios-install' (iPhone Safari tab, must add to Home Screen) | 'unsupported' | 'not-configured'
  function status() { if (!configured()) return 'not-configured'; if (isIOS() && !standalone()) return 'ios-install'; return supported() ? 'ok' : 'unsupported'; }
  const key = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
  const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };
  const payload = (sub, r, name) => ({ subscription: sub.toJSON ? sub.toJSON() : sub, morning: r.morning, evening: r.evening, weekly: '18:00', weighDays: [1, 4], tz: tz(), name: (name || '').trim().split(/\s+/)[0] || '' });
  async function call(path, body) { const res = await fetch(CONFIG.WORKER_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!res.ok) throw new Error('Server ' + res.status); return res.json(); }
  async function current() { if (!supported()) return null; const reg = await navigator.serviceWorker.ready; return reg.pushManager.getSubscription(); }
  async function enable(reminders, name) { // must be called from a user tap
    const p = await Notification.requestPermission(); if (p !== 'granted') throw new Error('denied');
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(CONFIG.VAPID_PUBLIC_KEY) });
    await call('/subscribe', payload(sub, reminders, name)); return true;
  }
  async function update(reminders, name) { const sub = await current(); if (!sub) return false;
    try { await call('/update', payload(sub, reminders, name)); } catch (e) { await call('/subscribe', payload(sub, reminders, name)); } return true; }
  async function disable() { const sub = await current(); if (!sub) return; try { await call('/unsubscribe', { endpoint: sub.endpoint }); } catch (e) {} await sub.unsubscribe(); }
  return { CONFIG, status, enable, update, disable, current, isIOS, standalone };
})();
