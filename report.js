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
  function draw(canvas, d, scale = 1) { const H = 3000; canvas.width = W * scale; canvas.height = H * scale; const ctx = canvas.getContext('2d'); ctx.scale(scale, scale);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, 150); ctx.fillStyle = '#fff'; ctx.font = 'bold 46px -apple-system,Helvetica,Arial'; ctx.fillText('🥊 FightReady weekly report', PAD, 70);
    ctx.font = '28px Helvetica,Arial'; ctx.fillStyle = '#ddd'; ctx.fillText(d.subject.split(' – ').filter((_, i) => i !== 1).join(' • '), PAD, 118);
    let y = 200; ctx.fillStyle = INK; ctx.font = '26px Helvetica,Arial'; if (d.meta) y = wrap(ctx, d.meta, PAD, y, W - 2*PAD, 34) + 10;
    // score card
    ctx.fillStyle = '#fafafa'; ctx.strokeStyle = LINE; ctx.fillRect(PAD, y, W - 2*PAD, 210); ctx.strokeRect(PAD, y, W - 2*PAD, 210);
    ctx.fillStyle = RED; ctx.font = 'bold 130px Helvetica,Arial'; ctx.fillText(d.score == null ? '—' : d.score, PAD + 30, y + 150);
    ctx.fillStyle = INK; ctx.font = 'bold 32px Helvetica,Arial'; ctx.fillText(d.scoreLabel || 'FightReady Score', PAD + 300, y + 70);
    ctx.font = '28px Helvetica,Arial'; ctx.fillStyle = MUTE; wrap(ctx, d.verdict || '', PAD + 300, y + 115, W - 2*PAD - 330, 34); y += 250;
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
