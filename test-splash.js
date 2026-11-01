// Cold-open splash (fr-v43). Run: node test-splash.js
const Sp = require('./splash.js'), fs = require('fs'), assert = require('assert');
assert.equal(Sp.shouldPlay({ search:'', hidden:false, played:false }), true, 'cold start plays');
assert.equal(Sp.shouldPlay({ search:'', hidden:false, played:true }), false, 'resume / same session does not replay');
assert.equal(Sp.shouldPlay({ search:'', hidden:true, played:false }), false, 'background open skipped');
assert.equal(Sp.shouldPlay({ search:'?replay', played:true }), true); assert.equal(Sp.shouldPlay({ search:'?nosplash' }), false);
const sw = fs.readFileSync('sw.js', 'utf8'), idx = fs.readFileSync('index.html', 'utf8'), css = fs.readFileSync('splash.css', 'utf8');
['splash.js','splash.css','brand/splash/crown.webp','brand/splash/f.webp','brand/splash/r.webp'].forEach(f => { assert.ok(sw.includes(`'${f}'`), 'precached ' + f); assert.ok(fs.existsSync(f), f); });
assert.ok(idx.indexOf('splash.js') > idx.indexOf('app.js'), 'splash runs after the app has rendered');
assert.ok(/prefers-reduced-motion/.test(css), 'reduced motion handled');
assert.ok(!/(^|[{}, ])\.(logo|mark|crown|fr|word|plate|burst|flash)\b/.test(css), 'splash CSS is scoped under #splash');
const kb = ['crown','f','r'].reduce((s, f) => s + fs.statSync(`brand/splash/${f}.webp`).size, 0) / 1024; assert.ok(kb < 60, 'assets small: ' + kb.toFixed(1) + ' KB');
console.log('splash ok', kb.toFixed(1) + ' KB');
