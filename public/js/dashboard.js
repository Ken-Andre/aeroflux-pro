// Dashboard analytique style Power BI (canvas natif, animé, hors-ligne)
const $ = (s) => document.querySelector(s);
const COLORS = ['#38bdf8', '#34d399', '#a78bfa', '#fbbf24', '#f472b6', '#fb7185', '#22d3ee'];

function fit(c) { const r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); if (c.width !== Math.round(r.width * d) || c.height !== Math.round(r.height * d)) { c.width = r.width * d; c.height = r.height * d; } const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return [g, r.width, r.height]; }
export function spark(c, data, color) {
  const [g, W, H] = fit(c); g.clearRect(0, 0, W, H); if (data.length < 2) return;
  let mn = Math.min(...data), mx = Math.max(...data); if (mx - mn < 1e-6) { mx += 1; mn -= 1; }
  const X = (i) => (i / (data.length - 1)) * W, Y = (v) => H - 3 - ((v - mn) / (mx - mn)) * (H - 6);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, color + '66'); gr.addColorStop(1, color + '00');
  g.beginPath(); data.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(0, Y(v)))); g.lineTo(W, H); g.lineTo(0, H); g.fillStyle = gr; g.fill();
  g.beginPath(); data.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(0, Y(v)))); g.strokeStyle = color; g.lineWidth = 1.8; g.shadowColor = color; g.shadowBlur = 6; g.stroke(); g.shadowBlur = 0;
}
const ease = (t) => 1 - Math.pow(1 - Math.min(1, t), 3);

export class Dashboard {
  constructor() {
    this.flights = []; this.filter = 'all'; this.anim = 0; this.t = 0; this.shown = {};
    document.querySelectorAll('.slicers button').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('.slicers button').forEach((x) => x.classList.toggle('on', x === b)); this.filter = b.dataset.f; this.anim = performance.now(); this.drawStatic(); }));
    addEventListener('resize', () => this.drawStatic());
  }
  async refresh(animate) {
    let list = []; try { list = await (await fetch('/api/flights')).json(); } catch {}
    if (!list.length) list = JSON.parse(localStorage.flights || '[]');
    this.flights = list; if (animate) this.anim = performance.now(); this.drawStatic();
  }
  get data() { return this.filter === 'all' ? this.flights : this.flights.filter((f) => f.type === this.filter); }
  visible() { return !$('#dash').classList.contains('hidden'); }
  countUp(id, val, fmt = (v) => Math.round(v)) { const p = ease((performance.now() - this.anim) / 1200); $(id).textContent = fmt(val * p); }
  drawStatic() {
    if (!this.visible()) return; const D = this.data;
    const ok = D.filter((f) => f.landed), hrs = D.reduce((a, f) => a + (f.dur || 0), 0) / 3600, avg = D.length ? D.reduce((a, f) => a + (f.score || 0), 0) / D.length : 0;
    const step = () => {
      this.countUp('#dK1', D.length); this.countUp('#dK2', ok.length); this.countUp('#dK3', D.length ? (ok.length / D.length) * 100 : 0, (v) => v.toFixed(0) + '%'); this.countUp('#dK4', hrs, (v) => v.toFixed(2)); this.countUp('#dK5', avg);
      this.bars(D.slice(-12), ease((performance.now() - this.anim) / 1000)); this.scatter(D, ease((performance.now() - this.anim) / 1000));
      if (performance.now() - this.anim < 1300) requestAnimationFrame(step);
    };
    step();
    const best = D.reduce((b, f) => (f.score > (b?.score || -1) ? f : b), null);
    $('#dK1s').textContent = `${D.filter((f) => Date.now() - new Date(f.at) < 864e5).length} aujourd'hui`; $('#dK2s').textContent = `${ok.filter((f) => f.fpm < 180).length} "butter"`; $('#dK3s').textContent = `${D.length - ok.length} crash(s)`; $('#dK4s').textContent = `max ${Math.max(0, ...D.map((f) => f.maxAlt || 0))} ft`; $('#dK5s').textContent = best ? `record ${best.score} · ${best.name}` : '—';
    $('#dTable').innerHTML = `<table><tr><th>Date</th><th>Pilote</th><th>Appareil</th><th>Durée</th><th>Alt. max</th><th>V max</th><th>Toucher</th><th>Résultat</th></tr>${D.slice(-40).reverse().map((f) => `<tr><td>${new Date(f.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${f.name}</td><td>${f.plane}</td><td>${Math.floor(f.dur / 60)}m${String(f.dur % 60).padStart(2, '0')}</td><td>${f.maxAlt} ft</td><td>${f.maxSpd} kt</td><td>${f.fpm} fpm</td><td><span class="tag ${f.landed ? 'ok' : 'ko'}">${f.grade}</span></td></tr>`).join('') || '<tr><td colspan=8 style="color:#8ea3c0">Aucun vol archivé : faites un atterrissage ou un crash pour alimenter le rapport.</td></tr>'}</table>`;
  }
  bars(D, p) {
    const [g, W, H] = fit($('#cBars')); g.clearRect(0, 0, W, H); const mx = Math.max(1000, ...D.map((f) => f.score)); const pad = 30, bw = (W - pad) / Math.max(12, D.length);
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.fillStyle = '#8ea3c0'; g.font = '10px system-ui';
    for (let i = 0; i <= 4; i++) { const y = H - 20 - (i / 4) * (H - 34); g.beginPath(); g.moveTo(pad, y); g.lineTo(W, y); g.stroke(); g.fillText(Math.round((mx * i) / 4), 0, y + 3); }
    D.forEach((f, i) => { const h = (f.score / mx) * (H - 34) * p, x = pad + i * bw + bw * 0.18, y = H - 20 - h; const gr = g.createLinearGradient(0, y, 0, H - 20); gr.addColorStop(0, f.landed ? '#38bdf8' : '#fb7185'); gr.addColorStop(1, f.landed ? '#6366f155' : '#fb718533'); g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, bw * 0.64, Math.max(h, 2), [6, 6, 0, 0]); g.fill(); g.fillStyle = '#8ea3c0'; g.fillText(f.name.slice(0, 6), x, H - 6); });
  }
  scatter(D, p) {
    const [g, W, H] = fit($('#cScatter')); g.clearRect(0, 0, W, H); const zones = [[0, 180, '#34d39922', 'Butter'], [180, 400, '#38bdf822', 'Doux'], [400, 700, '#fbbf2422', 'Correct'], [700, 1100, '#f9731622', 'Dur'], [1100, 1600, '#ef444422', 'Crash']];
    const X = (v) => 30 + (Math.min(v, 1600) / 1600) * (W - 40);
    for (const [a, b, c, l] of zones) { g.fillStyle = c; g.fillRect(X(a), 6, X(b) - X(a), H - 30); g.fillStyle = '#8ea3c0'; g.font = '10px system-ui'; g.fillText(l, X(a) + 4, 18); }
    D.forEach((f, i) => { const x = X(Math.max(0, f.fpm)), y = 22 + ((i * 37) % 100) / 100 * (H - 56); g.beginPath(); g.arc(x, y, 5 * p + 1, 0, 7); g.fillStyle = f.landed ? '#38bdf8' : '#fb7185'; g.shadowColor = g.fillStyle; g.shadowBlur = 10; g.fill(); g.shadowBlur = 0; });
    g.fillStyle = '#8ea3c0'; for (const v of [0, 400, 800, 1200, 1600]) g.fillText(v, X(v) - 8, H - 8);
  }
  // Graphiques temps réel (vol en cours)
  live(tel, S, world) {
    if (!this.visible()) return; const now = performance.now(); if (now - this.t < 250) return; this.t = now;
    $('#dNow').textContent = new Date().toLocaleTimeString('fr-FR');
    const smp = tel.samples.slice(-240);
    { const [g, W, H] = fit($('#cLine')); g.clearRect(0, 0, W, H); const L = 44, R = W - 44, T = 14, B = H - 22;
      g.strokeStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i <= 5; i++) { const y = T + (i / 5) * (B - T); g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); }
      const series = [['alt', '#34d399', L - 40], ['spd', '#38bdf8', R + 4]];
      for (const [k, col, lx] of series) {
        if (smp.length < 2) break; const vals = smp.map((s) => s[k]); const mx = Math.max(10, ...vals) * 1.1;
        const X = (i) => L + (i / (smp.length - 1)) * (R - L), Y = (v) => B - (v / mx) * (B - T);
        const gr = g.createLinearGradient(0, T, 0, B); gr.addColorStop(0, col + '55'); gr.addColorStop(1, col + '00');
        g.beginPath(); vals.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(0), Y(v)))); g.lineTo(R, B); g.lineTo(L, B); g.fillStyle = gr; g.fill();
        g.beginPath(); vals.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(0), Y(v)))); g.strokeStyle = col; g.lineWidth = 2; g.shadowColor = col; g.shadowBlur = 8; g.stroke(); g.shadowBlur = 0;
        g.fillStyle = col; g.font = '10px system-ui'; for (let i = 0; i <= 5; i++) g.fillText(Math.round(mx * (1 - i / 5)), lx, T + (i / 5) * (B - T) + 3);
        const lv = vals[vals.length - 1]; g.beginPath(); g.arc(R, Y(lv), 4, 0, 7); g.fill();
      }
      g.fillStyle = '#8ea3c0'; g.fillText('● Altitude ft', L + 6, H - 6); g.fillStyle = '#38bdf8'; g.fillText('● Vitesse kt', L + 90, H - 6);
    }
    { const [g, W, H] = fit($('#cGauge')); g.clearRect(0, 0, W, H); const cx = W / 2, cy = H * 0.62, r = Math.min(W, H) * 0.42, a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, v = Math.max(-2, Math.min(9, S.g)); const f = (v + 2) / 11;
      g.lineCap = 'round'; g.lineWidth = 14; g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
      const gr = g.createLinearGradient(cx - r, 0, cx + r, 0); gr.addColorStop(0, '#34d399'); gr.addColorStop(0.5, '#fbbf24'); gr.addColorStop(1, '#ef4444'); g.strokeStyle = gr; g.shadowColor = '#fbbf24'; g.shadowBlur = 12; g.beginPath(); g.arc(cx, cy, r, a0, a0 + (a1 - a0) * f); g.stroke(); g.shadowBlur = 0;
      g.fillStyle = '#fff'; g.font = '700 30px system-ui'; g.textAlign = 'center'; g.fillText(S.g.toFixed(2), cx, cy + 8); g.font = '11px system-ui'; g.fillStyle = '#8ea3c0'; g.fillText('G', cx, cy + 26); g.textAlign = 'left'; }
    { const [g, W, H] = fit($('#cDonut')); g.clearRect(0, 0, W, H); const ent = Object.entries(tel.phases).filter(([, v]) => v > 0.5); const tot = ent.reduce((a, [, v]) => a + v, 0) || 1; const cx = W * 0.32, cy = H / 2, r = Math.min(W * 0.28, H * 0.4); let a = -Math.PI / 2;
      ent.forEach(([k, v], i) => { const da = (v / tot) * Math.PI * 2; g.beginPath(); g.arc(cx, cy, r, a, a + da); g.arc(cx, cy, r * 0.62, a + da, a, true); g.closePath(); g.fillStyle = COLORS[i % 7]; g.fill(); a += da;
        g.fillRect(W * 0.64, 14 + i * 18, 9, 9); g.fillStyle = '#cbd5e1'; g.font = '10.5px system-ui'; g.fillText(`${k.slice(0, 14)} ${Math.round((v / tot) * 100)}%`, W * 0.64 + 14, 22 + i * 18); });
      g.fillStyle = '#fff'; g.font = '700 16px system-ui'; g.textAlign = 'center'; g.fillText(`${Math.round(tot)}s`, cx, cy + 5); g.textAlign = 'left'; }
    { const [g, W, H] = fit($('#cTrack')); g.clearRect(0, 0, W, H); if (!world) return; const sz = Math.min(W, H); const ox = (W - sz) / 2, oy = (H - sz) / 2;
      g.save(); g.beginPath(); g.roundRect(ox, oy, sz, sz, 12); g.clip(); g.drawImage(world.mapCanvas, ox, oy, sz, sz); const s = sz / 30000;
      g.strokeStyle = '#f472b6'; g.lineWidth = 2; g.shadowColor = '#f472b6'; g.shadowBlur = 8; g.beginPath(); tel.track.forEach(([x, z], i) => (i ? g.lineTo(ox + (x + 15000) * s, oy + (z + 15000) * s) : g.moveTo(ox + (x + 15000) * s, oy + (z + 15000) * s))); g.stroke(); g.shadowBlur = 0;
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ox + (S.pos.x + 15000) * s, oy + (S.pos.z + 15000) * s, 4, 0, 7); g.fill(); g.restore(); }
  }
}
