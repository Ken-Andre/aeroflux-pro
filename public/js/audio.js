// Moteur audio 100% procédural (hors-ligne) : moteur, vent, effets + 4 musiques génératives
export class Audio {
  constructor() { this.ctx = null; this.track = 0; this.musicOn = true; }
  static TRACKS = ['Skyline Synth', 'Lo-Fi Clouds', 'Horizon Orchestral', 'Night Drive'];
  init() {
    if (this.ctx) return; const C = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = C.createGain(); this.master.gain.value = 0.9; this.master.connect(C.destination);
    this.sfx = C.createGain(); this.sfx.connect(this.master);
    this.music = C.createGain(); this.music.gain.value = 0.55; this.music.connect(this.master);
    // réverb douce pour la musique
    const conv = C.createConvolver(); const len = C.sampleRate * 2.2, ir = C.createBuffer(2, len, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    conv.buffer = ir; this.rev = C.createGain(); this.rev.gain.value = 0.3; this.rev.connect(conv); conv.connect(this.music);
    // bruit
    const nb = C.createBuffer(1, C.sampleRate * 2, C.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
    // moteur : bruit filtré + oscillateurs
    const n = C.createBufferSource(); n.buffer = nb; n.loop = true; this.engF = C.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 300;
    this.engG = C.createGain(); this.engG.gain.value = 0; n.connect(this.engF).connect(this.engG).connect(this.sfx); n.start();
    this.osc = C.createOscillator(); this.osc.type = 'sawtooth'; this.oscG = C.createGain(); this.oscG.gain.value = 0; const of = C.createBiquadFilter(); of.frequency.value = 900;
    this.osc.connect(of).connect(this.oscG).connect(this.sfx); this.osc.start();
    const w = C.createBufferSource(); w.buffer = nb; w.loop = true; this.windF = C.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.Q.value = 0.6; this.windG = C.createGain(); this.windG.gain.value = 0;
    w.connect(this.windF).connect(this.windG).connect(this.sfx); w.start();
    this.step = 0; this.next = C.currentTime + 0.1; setInterval(() => this.schedule(), 50);
  }
  setVolume(v) { if (this.music) this.music.gain.value = v; }
  engine(throttle, speed, type) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const base = type === 'prop' ? 60 : type === 'cargo' ? 90 : 120;
    this.engF.frequency.setTargetAtTime(200 + throttle * (type === 'jet' ? 3500 : 1600), t, 0.2);
    this.engG.gain.setTargetAtTime(0.08 + throttle * 0.35, t, 0.2);
    this.osc.frequency.setTargetAtTime(base + throttle * base * 1.5, t, 0.3);
    this.oscG.gain.setTargetAtTime(type === 'prop' ? 0.05 + throttle * 0.08 : 0.015 + throttle * 0.03, t, 0.2);
    this.windF.frequency.setTargetAtTime(300 + speed * 12, t, 0.3); this.windG.gain.setTargetAtTime(Math.min(0.35, speed / 450), t, 0.3);
  }
  boom(big = true) {
    if (!this.ctx) return; const C = this.ctx, s = C.createBufferSource(); s.buffer = this.noiseBuf; const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(big ? 1200 : 3000, C.currentTime); f.frequency.exponentialRampToValueAtTime(60, C.currentTime + (big ? 2.5 : 0.3));
    const g = C.createGain(); g.gain.setValueAtTime(big ? 1.4 : 0.35, C.currentTime); g.gain.exponentialRampToValueAtTime(0.001, C.currentTime + (big ? 3 : 0.35)); s.connect(f).connect(g).connect(this.sfx); s.start(); s.stop(C.currentTime + 3);
  }
  beep(freq = 880, dur = 0.12, vol = 0.12) { if (!this.ctx) return; const C = this.ctx, o = C.createOscillator(), g = C.createGain(); o.frequency.value = freq; o.type = 'square'; g.gain.setValueAtTime(vol, C.currentTime); g.gain.exponentialRampToValueAtTime(0.001, C.currentTime + dur); o.connect(g).connect(this.sfx); o.start(); o.stop(C.currentTime + dur); }
  chirp() { this.boom(false); this.beep(1400, 0.05, 0.05); }

  // --------------------- Musique générative (séquenceur 16 pas avec anticipation)
  note(f, t, dur, type = 'sawtooth', vol = 0.1, cut = 2000, rev = 0.3) {
    const C = this.ctx, o = C.createOscillator(), g = C.createGain(), fl = C.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.frequency.value = cut; fl.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl).connect(g); g.connect(this.music); if (rev) { const r = C.createGain(); r.gain.value = rev; g.connect(r).connect(this.rev); } o.start(t); o.stop(t + dur + 0.05);
  }
  pad(freqs, t, dur, vol = 0.03, type = 'sawtooth', cut = 1200) { for (const f of freqs) for (const d of [-6, 6]) { this.note(f * Math.pow(2, d / 1200), t, dur, type, vol, cut, 0.6); } }
  kick(t, v = 0.6) { const C = this.ctx, o = C.createOscillator(), g = C.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.35); }
  hat(t, v = 0.08, len = 0.04) { const C = this.ctx, s = C.createBufferSource(); s.buffer = this.noiseBuf; const f = C.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = C.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); s.connect(f).connect(g).connect(this.music); s.start(t, Math.random()); s.stop(t + len + 0.02); }
  snare(t, v = 0.2) { const C = this.ctx, s = C.createBufferSource(); s.buffer = this.noiseBuf; const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = C.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); s.connect(f).connect(g).connect(this.music); const r = this.ctx.createGain(); r.gain.value = 0.4; g.connect(r).connect(this.rev); s.start(t, Math.random()); s.stop(t + 0.2); }
  schedule() {
    if (!this.musicOn) { this.next = this.ctx.currentTime + 0.1; return; }
    const bpm = [104, 78, 70, 92][this.track], spb = 60 / bpm / 4;
    while (this.next < this.ctx.currentTime + 0.2) { this.play(this.step, this.next, spb); this.next += spb; this.step++; }
  }
  play(s, t, spb) {
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12); const bar = Math.floor(s / 16) % 4, st = s % 16;
    if (this.track === 0) { // Synthwave
      const roots = [57, 53, 48, 55][bar]; const chord = [roots, roots + 3 + (bar === 2 ? 1 : 0), roots + 7];
      if (st === 0) this.pad(chord.map((m) => mtof(m)), t, spb * 16, 0.018, 'sawtooth', 1400);
      if (st % 2 === 0) this.note(mtof(roots - 12), t, spb * 1.6, 'sawtooth', 0.09, 600, 0);
      const arp = [0, 7, 12, 15, 12, 7, 3, 7]; this.note(mtof(roots + 12 + arp[st % 8]), t, spb * 0.9, 'square', 0.03, 2600, 0.5);
      if (st % 4 === 0) this.kick(t); if (st % 8 === 4) this.snare(t); if (st % 2 === 1) this.hat(t);
    } else if (this.track === 1) { // Lo-fi
      const prog = [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [57, 60, 64, 67]][bar];
      if (st === 0 || st === 10) prog.forEach((m, i) => this.note(mtof(m), t + i * 0.02, spb * 8, 'triangle', 0.05, 1100, 0.5));
      if (st === 0 || st === 7 || st === 10) this.kick(t, 0.45); if (st === 4 || st === 12) this.snare(t, 0.12); if (st % 2 === 0) this.hat(t + (st % 4 === 2 ? spb * 0.25 : 0), 0.05);
      if (Math.random() < 0.3 && st % 2 === 0) this.note(mtof(prog[Math.floor(Math.random() * 4)] + 12), t, spb * 3, 'sine', 0.05, 3000, 0.7);
      if (st === 0) this.note(mtof(prog[0] - 24), t, spb * 12, 'sine', 0.12, 400, 0);
    } else if (this.track === 2) { // Orchestral
      const prog = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]][bar];
      if (st === 0) { this.pad(prog.map(mtof), t, spb * 17, 0.022, 'sawtooth', 900); this.note(mtof(prog[0] - 12), t, spb * 16, 'triangle', 0.12, 500, 0.3); this.kick(t, 0.5); }
      const mel = [74, 76, 78, 81, 78, 76, 74, 73][(s >> 2) % 8]; if (st % 4 === 0) this.note(mtof(mel - (bar === 1 ? 2 : 0)), t, spb * 5, 'triangle', 0.06, 2400, 0.8);
      if (st === 12 || st === 14) this.kick(t, 0.25);
    } else { // Night Drive
      const r = [45, 45, 41, 43][bar];
      for (const k of [0, 3, 6, 10, 12]) if (st === k) this.note(mtof(r - 12), t, spb * 2, 'square', 0.07, 350 + bar * 60, 0);
      if (st % 4 === 0) this.kick(t, 0.7); if (st % 8 === 4) this.snare(t, 0.15); this.hat(t, st % 4 === 2 ? 0.07 : 0.03, st % 4 === 2 ? 0.1 : 0.03);
      if (st === 0) this.pad([mtof(r + 12), mtof(r + 15), mtof(r + 19)], t, spb * 16, 0.012, 'sawtooth', 700);
      if (st === 8 && bar % 2) this.note(mtof(r + 24 + 7), t, spb * 6, 'sine', 0.05, 4000, 0.9);
    }
  }
}
