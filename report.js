// Weekly report image: draws the Coach Report (score, categories, charts, load, flags) on a light canvas for email.
(function (root) {
  const W = 1080, PAD = 56, RED = '#d32f2f', INK = '#1a1a1a', MUTE = '#666', LINE = '#e3e3e3', OK = '#2e7d32';
  function wrap(ctx, text, x, y, maxW, lh) { const words = String(text).split(' '); let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = t; }
    if (line) { ctx.fillText(line, x, y); y += lh; } return y; }
  function section(ctx, title, y) { ctx.fillStyle = RED; ctx.fillRect(PAD, y, 8, 34); ctx.fillStyle = INK; ctx.font = 'bold 32px -apple-system,Helvetica,Arial'; ctx.fillText(title, PAD + 22, y + 28); return y + 58; }
  function line(ctx, pts, y, h, o = {}) { const v = pts.filter(p => p.y != null); const x0 = PAD, w = W - 2*PAD;
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.strokeRect(x0, y, w, h);
    if (v.length < 2) { ctx.fillStyle = MUTE; ctx.font = '26px Helvetica,Arial'; ctx.fillText('Not enough data yet', x0 + 20, y + h/2 + 8); return y + h + 20; }
    const ys = v.map(p => p.y).concat(o.ref != null ? [o.ref] : []), lo = o.min ?? Math.min(...ys), hi = o.max ?? Math.max(...ys), r = (hi - lo) || 1;
    const X = i => x0 + 20 + i / (v.length - 1) * (w - 40), Y = q => y + h - 16 - (q - lo) / r * (h - 32);
    if (o.ref != null) { ctx.strokeStyle = OK; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(x0, Y(o.ref)); ctx.lineTo(x0 + w, Y(o.ref)); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = RED; ctx.lineWidth = 4; ctx.beginPath(); v.forEach((p, i) => i ? ctx.lineTo(X(i), Y(p.y)) : ctx.moveTo(X(i), Y(p.y))); ctx.stroke();
    ctx.fillStyle = RED; v.forEach((p, i) => { ctx.beginPath(); ctx.arc(X(i), Y(p.y), 6, 0, 7); ctx.fill(); });
    ctx.fillStyle = MUTE; ctx.font = '24px Helvetica,Arial';
    ctx.fillText(`${v[0].date.slice(5)} → ${v[v.length-1].date.slice(5)} • latest ${v[v.length-1].y}${o.unit||''}${o.ref!=null?' • target '+o.ref+(o.unit||''):''}`, x0, y + h + 32);
    return y + h + 60; }
  // d: { subject, name, meta, score, scoreLabel, verdict, cats:[[label,val,weight]], head:[[label,value]], weight:[{date,y}], target, sleep:[], idealSleep, daily:[], loadWeeks:[4], hydration:{days:[{date,v,color}],summary}, training, flags:[], review:{well,missed,focus} }
  function laurels(ctx, cx, cy, R, filled) { const col = filled ? '#E8A828' : 'rgba(216,245,220,.9)';
    for (const s of [1, -1]) { ctx.save(); ctx.translate(cx, 0); ctx.scale(s, 1); ctx.translate(-cx, 0); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = filled ? 3 : 2; ctx.lineCap = 'round';
      const pt = i => { const a = (128 + i * 13.5) * Math.PI / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a), a]; };
      ctx.beginPath(); for (let i = 0; i <= 8; i++) { const [x, y] = pt(i); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      for (let i = 0; i <= 8; i++) { const [x, y, a] = pt(i), k = 1.3 - i * 0.06, L = 24 * k, Wd = 8 * k;
        for (const side of [-1, 1]) { ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2 + side * 0.7);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L / 2, -Wd, L, 0); ctx.quadraticCurveTo(L / 2, Wd, 0, 0); filled ? ctx.fill() : ctx.stroke(); ctx.restore(); } }
      ctx.restore(); } }
  function draw(canvas, d, scale = 1) { const H = 3000; canvas.width = W * scale; canvas.height = H * scale; const ctx = canvas.getContext('2d'); ctx.scale(scale, scale);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, 150); ctx.fillStyle = '#fff'; ctx.font = 'bold 46px -apple-system,Helvetica,Arial'; ctx.fillText('🥊 FightReady weekly report', PAD, 70);
    ctx.font = '28px Helvetica,Arial'; ctx.fillStyle = '#ddd'; ctx.fillText(d.subject.split(' – ').filter((_, i) => i !== 1).join(' • '), PAD, 118);
    let y = 200; ctx.fillStyle = INK; ctx.font = '26px Helvetica,Arial'; if (d.meta) y = wrap(ctx, d.meta, PAD, y, W - 2*PAD, 34) + 10;
    // hero score card: tier gradient, ring, bold title, verdict badge
    { const v = d.score, tier = v == null ? 'solid' : v >= 90 ? 'elite' : v >= 75 ? 'ready' : v >= 60 ? 'solid' : 'low', G = { elite:['#000000','#1a1408','#3a2a08','#E8A828'], ready:['#0b1f17','#11502f','#2e9d55','#7ee29a'], solid:['#0b1730','#12345e','#1e6fb8','#8fd0fb'], low:['#1a0204','#4a0509','#8a0d16','#ff6b6b'] }[tier];
      const x0 = PAD, w = W - 2*PAD, h = 300, g = ctx.createLinearGradient(x0, y, x0 + w, y + h); g.addColorStop(0, G[0]); g.addColorStop(0.55, G[1]); g.addColorStop(1, G[2]);
      ctx.save(); ctx.shadowColor = G[2]; ctx.shadowBlur = 24; ctx.fillStyle = g; ctx.beginPath(); (ctx.roundRect ? ctx.roundRect(x0, y, w, h, 24) : ctx.rect(x0, y, w, h)); ctx.fill(); ctx.restore();
      const cx = x0 + 160, cy = y + h/2, R = 110; ctx.lineWidth = 18; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.stroke();
      if (v != null) { ctx.save(); ctx.shadowColor = G[3]; ctx.shadowBlur = 14; ctx.strokeStyle = G[3]; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI/2, -Math.PI/2 + Math.PI*2*Math.max(0, Math.min(100, v))/100); ctx.stroke(); ctx.restore(); }
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '900 104px Helvetica,Arial'; ctx.fillText(v == null ? '—' : v, cx, cy + 36); ctx.textAlign = 'left';
      const tx = x0 + 320, tw = w - 340; ctx.font = '900 40px Helvetica,Arial'; ctx.fillText('FIGHTREADY SCORE', tx, y + 70);
      ctx.font = 'bold 24px Helvetica,Arial'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(String(d.scoreLabel || '').replace(/fightready score/i, '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim().toUpperCase(), tx, y + 108);
      const badge = String(d.verdict || '').split(' — ')[0].split('.')[0].toUpperCase().slice(0, 28); ctx.font = '900 26px Helvetica,Arial'; const bw = Math.min(tw, ctx.measureText(badge).width + 40);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); (ctx.roundRect ? ctx.roundRect(tx, y + 128, bw, 46, 23) : ctx.rect(tx, y + 128, bw, 46)); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(badge, tx + 20, y + 160);
      ctx.font = '24px Helvetica,Arial'; ctx.fillStyle = 'rgba(255,255,255,.9)'; wrap(ctx, String(d.verdict || '').split(' — ').slice(1).join(' — ') || '', tx, y + 210, tw, 30);
      if (d.breakdown) { ctx.font = 'bold 22px Helvetica,Arial'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(d.breakdown, tx, y + h - 24); }
      if (v != null && (tier === 'elite' || tier === 'ready')) laurels(ctx, cx, cy, R + 26, tier === 'elite');
      y += h + 40; }
    // headline grid
    (d.head || []).forEach(([l, v], i) => { const cx = PAD + (i % 2) * ((W - 2*PAD) / 2), cy = y + Math.floor(i / 2) * 84;
      ctx.fillStyle = MUTE; ctx.font = '24px Helvetica,Arial'; ctx.fillText(l, cx, cy); ctx.fillStyle = INK; ctx.font = 'bold 32px Helvetica,Arial'; ctx.fillText(v, cx, cy + 40); });
    y += Math.ceil((d.head || []).length / 2) * 84 + 20;
    y = section(ctx, 'Scores by category', y);
    d.cats.forEach(([l, v, wt]) => { ctx.fillStyle = INK; ctx.font = '28px Helvetica,Arial'; ctx.fillText(`${l} (${wt}%)`, PAD, y + 26);
      const bx = PAD + 330, bw = W - 2*PAD - 330 - 110; ctx.fillStyle = '#eee'; ctx.fillRect(bx, y + 4, bw, 28); ctx.fillStyle = v >= 80 ? OK : v >= 60 ? '#f9a825' : RED; ctx.fillRect(bx, y + 4, bw * Math.max(0, Math.min(100, v)) / 100, 28);
      ctx.fillStyle = INK; ctx.font = 'bold 28px Helvetica,Arial'; ctx.textAlign = 'right'; ctx.fillText(Math.round(v), W - PAD, y + 28); ctx.textAlign = 'left'; y += 50; });
    y += 20; y = section(ctx, 'Daily FightReady score', y); y = line(ctx, d.daily, y, 200, { min: 0, max: 100 });
    y = section(ctx, 'Weight vs target', y); y = line(ctx, d.weight, y, 220, { ref: d.target, unit: ' lbs' });
    y = section(ctx, 'Sleep hours', y); y = line(ctx, d.sleep, y, 200, { ref: d.idealSleep, unit: 'h' });
    if (d.hydration) { y = section(ctx, 'Hydration (first pee colour, last 7 mornings)', y); const hd = d.hydration.days, cw = (W - 2*PAD) / hd.length;
      hd.forEach((x, i) => { const bx = PAD + i * cw + 8, bw = cw - 16; if (x.v) { ctx.fillStyle = x.color; ctx.fillRect(bx, y, bw, 64); ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.strokeRect(bx, y, bw, 64); }
        else { ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.strokeRect(bx, y, bw, 64); ctx.setLineDash([]); }
        ctx.fillStyle = MUTE; ctx.font = '22px Helvetica,Arial'; ctx.textAlign = 'center'; ctx.fillText(x.date.slice(5), bx + bw / 2, y + 92); ctx.textAlign = 'left'; });
      y += 116; ctx.fillStyle = INK; ctx.font = '26px Helvetica,Arial'; y = wrap(ctx, d.hydration.summary, PAD, y, W - 2*PAD, 34) + 20; }
    if (d.nutrition) { y = section(ctx, d.nutrition.title, y); ctx.fillStyle = INK; ctx.font = '28px Helvetica,Arial'; y = wrap(ctx, d.nutrition.text, PAD, y + 4, W - 2*PAD, 36) + 20; }
    y = section(ctx, 'Training', y); ctx.fillStyle = INK; ctx.font = '28px Helvetica,Arial'; y = wrap(ctx, d.training || '', PAD, y + 4, W - 2*PAD, 36) + 10;
    const lw = d.loadWeeks || [0,0,0,0], mx = Math.max(...lw, 1), bwid = (W - 2*PAD) / 4;
    lw.forEach((v, i) => { const h = Math.round(v / mx * 160), x = PAD + i * bwid + 30; ctx.fillStyle = i === 3 ? RED : '#9e9e9e'; ctx.fillRect(x, y + 170 - h, bwid - 60, h);
      ctx.fillStyle = INK; ctx.font = 'bold 24px Helvetica,Arial'; ctx.textAlign = 'center'; ctx.fillText(v, x + (bwid - 60)/2, y + 160 - h); ctx.fillStyle = MUTE; ctx.font = '22px Helvetica,Arial'; ctx.fillText(i === 3 ? 'This week' : (3 - i) + 'w ago', x + (bwid - 60)/2, y + 200); ctx.textAlign = 'left'; });
    y += 230; ctx.fillStyle = MUTE; ctx.font = '22px Helvetica,Arial'; y = wrap(ctx, 'Load (AU) = effort (RPE 1–10) × minutes. A jump of more than ~10–15% over last week raises injury risk.', PAD, y, W - 2*PAD, 30) + 20;
    y = section(ctx, 'Flags', y); ctx.font = '28px Helvetica,Arial';
    (d.flags.length ? d.flags.map(f => '🚩 ' + f) : ['✅ No flags this week']).forEach(f => { ctx.fillStyle = d.flags.length ? RED : OK; y = wrap(ctx, f, PAD, y + 4, W - 2*PAD, 36); });
    y += 20; if (d.review) { y = section(ctx, 'Weekly review', y);
      [['✅ Went well', d.review.well], ['❌ Missed', d.review.missed], ['🎯 Focus next week', d.review.focus]].forEach(([t, a]) => { if (!a || !a.length) return;
        ctx.fillStyle = INK; ctx.font = 'bold 28px Helvetica,Arial'; ctx.fillText(t, PAD, y + 4); y += 40; ctx.font = '26px Helvetica,Arial'; ctx.fillStyle = '#333';
        a.forEach(x => { y = wrap(ctx, '• ' + x, PAD + 10, y, W - 2*PAD - 10, 34); }); y += 12; }); }
    ctx.fillStyle = MUTE; ctx.font = '22px Helvetica,Arial'; ctx.fillText('Generated by FightReady • data stays on the fighter\'s phone', PAD, y + 30); y += 60;
    // crop to content
    const out = document.createElement('canvas'); out.width = W * scale; out.height = Math.ceil(y * scale); out.getContext('2d').drawImage(canvas, 0, 0); return out; }
  // Share text: subject first so it can be copied if Mail leaves the subject blank.
  const shareText = (to, subj, lines) => [`Subject: ${subj}`, `To: ${to}`, '', ...lines].join('\n');
  const fileName = (name, wk) => `FightReady-${String(name||'Fighter').replace(/\W+/g,'-')}-${wk}.png`;
  const api = { draw, shareText, fileName };
  if (typeof module !== 'undefined') module.exports = api; else root.Report = api;
})(this);
