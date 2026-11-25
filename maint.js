/* M1 (fr-v61): Maintenance additions. A fresh Maintenance start builds a 14-day baseline before the full score;
   a fighter with camp history inherits it (the score carries straight on, and on into the next camp).
   Training log: "Did you train today?" Yes (sessions with a comment + intensity) / No (rest day, optional comment). */
const Maint = (() => {
  const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const BASELINE_DAYS = 14;
  const inherited = St => !Recovery.neverInCamp(St);
  const unlockDays = (St, mode) => mode === 'maintenance' && !inherited(St) ? BASELINE_DAYS : ((St.params && St.params.unlockDays) || 7);
  function trainedHtml(x) { const t = x.trained;
    return `<p style="margin:0 0 6px"><b>Did you train today?</b></p><div class="ynx" data-mtr="1"><button type="button" class="y ${t === true ? 'on' : ''}" data-val="1">✅ Yes</button><button type="button" class="n ${t === false ? 'on' : ''}" data-val="0">No, rest day</button></div>
     <div id="maintRestBox" ${t === false ? '' : 'hidden'}><label for="f_restNote">Comment <span class="muted">(optional)</span></label><textarea id="f_restNote" rows="2" maxlength="300" placeholder="e.g. planned rest, sore, travel">${e(x.restNote || '')}</textarea><p class="muted">Rest days are fine and don't lower today's score.</p></div>`; }
  function install() { document.addEventListener('click', ev => { const b = ev.target.closest('[data-mtr] button'); if (!b) return; ev.preventDefault(); ev.stopImmediatePropagation();
    const on = b.dataset.val === '1'; if (V._e) V._e.trained = on; b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    const rest = document.getElementById('maintRestBox'), box = document.getElementById('maintTrainedBox'); if (rest) rest.hidden = on; if (box) box.hidden = !on;
    autosave(); }, true); }
  return { BASELINE_DAYS, inherited, unlockDays, trainedHtml, install };
})();
