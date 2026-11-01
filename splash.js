// FightReady cold-open splash (fr-v44). Plays once per cold start (sessionStorage survives resume/tab switch,
// not a full app close). Tap to skip. Reduced motion: brief static logo. Ends by gliding the mark into the header logo
// and counting the score up; on sign-up (no score yet) it simply fades.
(function (root) {
  const KEY = 'fr_splash', END = 2700, MAXWAIT = 4000;
  // pure: should the splash play for this load?
  function shouldPlay(o) { o = o || {};
    if (/[?&]nosplash\b/.test(o.search || '')) return false;
    if (/[?&](replay|splashrec)\b/.test(o.search || '')) return true;
    if (o.hidden) return false;            // opened in the background / prerender
    if (o.played) return false;            // already shown this session (resume, tab switch, reload of a running app)
    return true; }
  const sparks = (n, d) => Array.from({ length: n }, (_, i) => `<i style="--a:${Math.round(i * 360 / n)}deg;--d:${d + (i * 37) % 60}px"></i>`).join('');
  const HTML = `<div class="sp-flash sp-fl1 sp-hide-rm"></div><div class="sp-flash sp-fl2 sp-hide-rm"></div><div class="sp-logo">
<div class="sp-mark"><div class="sp-burst"></div><div class="sp-plate"></div><div class="sp-sparks sp-s1 sp-hide-rm">${sparks(10, 80)}</div><div class="sp-sparks sp-s2 sp-hide-rm">${sparks(18, 130)}</div>
<img class="sp-crown" src="brand/splash/crown.webp" alt="" decoding="sync"><img class="sp-fr sp-f" src="brand/splash/f.webp" alt="" decoding="sync"><img class="sp-fr sp-r" src="brand/splash/r.webp" alt="" decoding="sync"></div>
<div class="sp-word">FIGHT<b>READY</b></div></div><div class="sp-skip sp-hide-rm">tap to skip</div>`;
  function run(doc, win) {
    let played = false; try { played = !!win.sessionStorage.getItem(KEY); } catch (e) {}
    if (!shouldPlay({ search: win.location.search, hidden: doc.visibilityState === 'hidden', played })) { doc.documentElement.classList.remove('sp-pre'); return null; }
    const REC = /[?&]splashrec\b/.test(win.location.search), rm = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sp = doc.createElement('div'); sp.id = 'splash'; sp.setAttribute('role', 'img'); sp.setAttribute('aria-label', 'FightReady'); sp.innerHTML = HTML;
    doc.body.appendChild(sp); doc.documentElement.classList.remove('sp-pre');
    const hdr = doc.querySelector('header'); if (hdr) hdr.classList.add('sp-wait');
    const hero = doc.getElementById('heroScore'), num = hero && hero.querySelector('.hero-num[data-count]'), val = hero && hero.querySelector('.hero-ring .val'), lau = hero && hero.querySelector('.laurel');
    const to = num && num.dataset.count !== '' ? +num.dataset.count : null, C = val ? +val.getAttribute('stroke-dasharray') : 0, off = val ? +val.getAttribute('stroke-dashoffset') : 0;
    const setNum = k => { if (num && to != null) num.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); };
    if (!rm && hero) { if (num) num.dataset.done = 1; if (to != null) setNum(0); if (val) val.style.strokeDashoffset = C; if (lau) lau.style.opacity = 0; }
    let outs = null, gone = false, doneRes; const done = new Promise(r => doneRes = r); root.__frSplashDone = done;
    function finish() { if (gone) return; gone = true; doneRes(); try { win.sessionStorage.setItem(KEY, '1'); } catch (e) {} /* marked played only once fully shown, so an update reload mid-splash replays it */ if (hdr) hdr.classList.remove('sp-wait'); sp.remove();
      if (val) val.style.strokeDashoffset = ''; if (lau) lau.style.opacity = ''; if (num && to != null) num.textContent = to; }
    function buildOut() { if (outs) return outs; const mk = sp.querySelector('.sp-mark');
      const fade = (el, ms, delay) => el.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration: ms, delay: delay || 0, fill: 'forwards' });
      if (!hero || !hdr || !mk.animate) { // sign-up / restore screen: simple fade
        outs = [sp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' })]; outs.total = 450; return outs; }
      const a = mk.getBoundingClientRect(), hr = hdr.getBoundingClientRect(), cs = getComputedStyle(hdr), pl = parseFloat(cs.paddingLeft), pt = parseFloat(cs.paddingTop);
      // header::before is a 44x44 box (contain-fit 595x537 mark), vertically centred in the content box (below the top border, above the 2px gold border)
      const ch = hdr.clientHeight - pt - parseFloat(cs.paddingBottom), bw = 44, bh = 44 * 537 / 595, bx = hr.left + hdr.clientLeft + pl, by = hr.top + hdr.clientTop + pt + (ch - 44) / 2 + (44 - bh) / 2;
      const s = bw / a.width, dx = bx - a.left, dy = by - a.top;
      outs = [mk.animate([{ opacity: 1 }, { opacity: 1, offset: .9 }, { opacity: 0 }], { duration: 700, fill: 'forwards', composite: 'add' }),
        mk.animate([{ transformOrigin: '0 0', transform: 'none' }, { transformOrigin: '0 0', transform: `translate(${dx}px,${dy}px) scale(${s})` }], { duration: 600, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' }),
        ...[...sp.querySelectorAll('.sp-plate,.sp-burst,.sp-word,.sp-skip')].map(el => fade(el, 280)),
        sp.animate([{ backgroundColor: 'rgba(0,0,0,1)' }, { backgroundColor: 'rgba(0,0,0,0)' }], { duration: 450, delay: 150, fill: 'forwards' })];
      if (val && to != null) outs.push(val.animate([{ strokeDashoffset: C }, { strokeDashoffset: off }], { duration: 700, delay: 550, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }));
      if (lau) outs.push(lau.animate([{ opacity: 0, transform: 'scale(.92)', filter: 'drop-shadow(0 0 0 rgba(232,168,40,0))' }, { opacity: 1, transform: 'scale(1.04)', filter: 'drop-shadow(0 0 14px rgba(232,168,40,.9))', offset: .6 }, { opacity: 1, transform: 'none', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.6))' }], { duration: 800, delay: 850, fill: 'both' }));
      sp.style.pointerEvents = 'none'; outs.total = 1700; return outs; }
    function tickOut(t) { if (hero) setNum(Math.max(0, Math.min(1, (t - 550) / 700))); if (t >= 590 && hdr) hdr.classList.remove('sp-wait'); }
    // Readiness gate: black screen (CSS animations paused) until the images are decoded, the Exo2 font is loaded and the
    // main thread is idle; then the timeline starts fresh. Capped at MAXWAIT -> static logo, then proceed.
    function ready() {
      const imgs = [...sp.querySelectorAll('img')].map(i => i.decode ? i.decode().catch(() => {}) : Promise.resolve());
      const font = doc.fonts && doc.fonts.load ? Promise.all([doc.fonts.load('italic 900 40px Exo2'), doc.fonts.load('italic 800 12px Exo2')]).catch(() => {}) : Promise.resolve();
      const idle = () => new Promise(r => (win.requestIdleCallback ? win.requestIdleCallback(() => r(), { timeout: 600 }) : setTimeout(r, 50)));
      const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return Promise.all([...imgs, font]).then(idle).then(frames).then(() => true); }
    const capped = new Promise(r => setTimeout(() => r(false), MAXWAIT));
    const api = { END, buildOut, tickOut, finish, el: sp, done }; root.__frSplash = api;
    if (REC) { sp.classList.add('sp-go'); return api; }
    const reveal = () => { const os = buildOut(), st = performance.now(), total = os.total;
      const f = () => { const t = performance.now() - st; tickOut(t); if (t < total && !gone) requestAnimationFrame(f); else finish(); }; requestAnimationFrame(f); };
    if (rm) { sp.classList.add('sp-go'); setTimeout(() => { const an = sp.animate ? sp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }) : null; if (an) an.onfinish = finish; else finish(); }, 700); return api; }
    let timer = null, started = false;
    const endIntro = () => doc.getAnimations().forEach(an => { const tg = an.effect && an.effect.target; if (tg && sp.contains(tg)) an.finish(); });
    Promise.race([ready(), capped]).then(ok => { if (gone || outs) return; started = true; sp.classList.add('sp-go');
      if (ok) timer = setTimeout(reveal, END); else { endIntro(); timer = setTimeout(reveal, 600); } // slow device: static logo, then proceed
      setTimeout(finish, END + 4000); }); // safety net: never leave the overlay up
    setTimeout(finish, MAXWAIT + END + 4000);
    sp.addEventListener('pointerdown', () => { if (outs) return; clearTimeout(timer); sp.classList.add('sp-go');
      endIntro(); reveal(); });
    return api; }
  const api = { shouldPlay, KEY, END, MAXWAIT };
  if (typeof module !== 'undefined') module.exports = api;
  else { root.Splash = api; try { run(document, window); } catch (e) { document.documentElement.classList.remove('sp-pre'); const s = document.getElementById('splash'); if (s) s.remove(); const h = document.querySelector('header'); if (h) h.classList.remove('sp-wait'); } }
})(this);
