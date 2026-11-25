/* M1 (fr-v61): optional fighter photo. Stays on this phone (S.photo, a small JPEG data URL) and goes into JSON backups.
   Shown in Setup, on the fight-day score card and on the weekly coach report. */
const FighterPhoto = (() => {
  const MAX = 320;
  const src = () => (typeof S !== 'undefined' && typeof S.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(S.photo)) ? S.photo : '';
  const img = cls => src() ? `<img class="${cls || 'fr-photo'}" src="${src()}" alt="Fighter photo">` : '';
  function card() { const has = !!src();
    return `<div class="card" id="photoCard"><h3>📸 Fighter photo</h3><p class="muted">Optional. Shown on your fight-day score card and your weekly coach report. It stays on this phone and in your backups.</p>
     <div class="row" style="align-items:center;gap:14px">${has ? img('fr-photo big') : '<div class="fr-photo big empty" aria-hidden="true">👤</div>'}<div style="flex:1">
     <label class="btn alt" for="photoFile" style="display:block;text-align:center;margin:0 0 8px">${has ? '🔄 Change photo' : '➕ Add a photo'}</label><input type="file" id="photoFile" accept="image/*" hidden>
     ${has ? '<button type="button" class="btn alt" id="photoRemove" style="margin:0">Remove photo</button>' : ''}</div></div><p class="muted" id="photoMsg" role="status"></p></div>`; }
  // Resize to MAX px on the long side as JPEG (keeps localStorage small).
  function fromFile(file) { return new Promise((resolve, reject) => { if (!file || !/^image\//.test(file.type)) return reject(new Error('Pick an image file.'));
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { try { const k = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.82)); } catch (err) { reject(err); } };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read.')); }; im.src = url; }); }
  function install() {
    document.addEventListener('change', async ev => { if (ev.target.id !== 'photoFile') return; const f = ev.target.files && ev.target.files[0]; if (!f) return;
      try { S.photo = await fromFile(f); save(); show('setup'); const m = document.getElementById('photoMsg'); if (m) m.textContent = 'Photo saved ✔'; } catch (err) { alert(err.message || 'Could not save the photo.'); } });
    document.addEventListener('click', ev => { const t = ev.target.closest('#photoRemove'); if (!t) return; ev.preventDefault(); ev.stopImmediatePropagation(); if (!confirm('Remove the fighter photo?')) return; delete S.photo; save(); show('setup'); }, true); }
  return { src, img, card, fromFile, install };
})();
