// Cold-open splash (fr-v43). Run: node test-splash.js
const Sp = require('./splash.js'), fs = require('fs'), assert = require('assert');
assert.equal(Sp.shouldPlay({ search:'', hidden:false, played:false }), true, 'cold start plays');
assert.equal(Sp.shouldPlay({ search:'', hidden:false, played:true }), false, 'resume / same session does not replay');
assert.equal(Sp.shouldPlay({ search:'', hidden:true, played:false }), false, 'background open skipped');
assert.equal(Sp.shouldPlay({ search:'?replay', played:true }), true); assert.equal(Sp.shouldPlay({ search:'?nosplash' }), false);
const sw = fs.readFileSync('sw.js', 'utf8'), idx = fs.readFileSync('index.html', 'utf8'), css = fs.readFileSync('splash.css', 'utf8');
['splash.js','splash.css','brand/splash/crown.webp','brand/splash/f.webp','brand/splash/r.webp'].forEach(f => { assert.ok(sw.includes(`'${f}'`), 'precached ' + f); assert.ok(fs.existsSync(f), f); });
assert.ok(idx.indexOf('src="splash.js"') > idx.indexOf('src="app.js"'), 'splash runs after the app has rendered');
assert.ok(/prefers-reduced-motion/.test(css), 'reduced motion handled');
assert.ok(!/(^|[{}, ])\.(logo|mark|crown|fr|word|plate|burst|flash)\b/.test(css), 'splash CSS is scoped under #splash');
const kb = ['crown','f','r'].reduce((s, f) => s + fs.statSync(`brand/splash/${f}.webp`).size, 0) / 1024; assert.ok(kb < 60, 'assets small: ' + kb.toFixed(1) + ' KB');
console.log('splash ok', kb.toFixed(1) + ' KB');
// fr-v44: readiness gate
const js = fs.readFileSync('splash.js', 'utf8'), app = fs.readFileSync('app.js', 'utf8');
assert.ok(/#splash:not\(\.sp-go\) \*\{animation-play-state:paused/.test(css), 'intro held until ready');
assert.ok(/decode\(\)/.test(js) && /fonts\.load/.test(js) && Sp.MAXWAIT <= 4000, 'waits for images + font, capped');
assert.ok(/__frSplashDone/.test(app) && /regSW/.test(app), 'SW registration deferred until after splash');
console.log('splash gate ok');
