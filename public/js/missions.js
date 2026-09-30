// Missions : parcours d'anneaux, livraison inter-aéroports, tour de piste
import * as THREE from 'three';
import { AIRPORTS, RWY } from './world.js';
const $ = (s) => document.querySelector(s);

export const MISSIONS = [
  { id: 'rings', icon: '💍', name: 'Parcours d\'anneaux', desc: 'Traversez 12 anneaux dorés le plus vite possible.', xp: '200–900' },
  { id: 'delivery', icon: '📦', name: 'Livraison express', desc: 'Rejoignez un autre aéroport et posez-vous.', xp: '800+' },
  { id: 'circuit', icon: '🔁', name: 'Tour de piste', desc: 'Décollez et reposez-vous au même aéroport en moins de 4 min.', xp: '400' },
  { id: 'lowlevel', icon: '🌊', name: 'Rase-vagues', desc: 'Survolez la mer sous 150 ft pendant 20 s.', xp: '350' },
];

export class Missions {
  constructor(scene, world, progress, toast) { this.scene = scene; this.world = world; this.pg = progress; this.toast = toast; this.active = null; this.group = new THREE.Group(); scene.add(this.group); }
  clear() { this.group.clear(); this.active = null; $('#missionCard').classList.add('hidden'); }
  start(id, S) {
    this.clear(); const m = { id, t: 0, def: MISSIONS.find((x) => x.id === id) }; this.active = m;
    if (id === 'rings') {
      m.rings = []; const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(S.quat).setY(0).normalize(); let p = S.pos.clone().addScaledVector(fwd, 600); let dir = fwd.clone();
      p.y = Math.max(p.y, this.world.height(p.x, p.z) + 150);
      for (let i = 0; i < 12; i++) {
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.9); p = p.clone().addScaledVector(dir, 700 + Math.random() * 300);
        p.y = THREE.MathUtils.clamp(p.y + (Math.random() - 0.5) * 180, this.world.height(p.x, p.z) + 90, 2500);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(38, 3.2, 12, 48), new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0xffa000, emissiveIntensity: 1.2, metalness: 0.9, roughness: 0.25 }));
        ring.position.copy(p); ring.lookAt(p.clone().add(dir)); ring.userData.n = dir.clone(); this.group.add(ring); m.rings.push(ring);
      }
      m.idx = 0; this.highlight();
    } else if (id === 'delivery' || id === 'circuit') {
      const from = this.nearestAirport(S.pos);
      const to = id === 'circuit' ? from : AIRPORTS.filter((a) => a !== from)[Math.floor(Math.random() * (AIRPORTS.length - 1))];
      m.from = from; m.to = to; m.left = false;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 3000, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      beam.position.set(to.x, to.h + 1500, to.z + RWY.len / 2 + 200); this.group.add(beam);
    } else if (id === 'lowlevel') { m.low = 0; }
    this.toast(m.def.icon + ' ' + m.def.name.toUpperCase(), m.def.desc, 3000);
    $('#missionCard').classList.remove('hidden'); this.ui(S);
  }
  nearestAirport(p) { return AIRPORTS.reduce((b, a) => (Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b)); }
  highlight() { const m = this.active; m.rings.forEach((r, i) => { r.visible = i >= m.idx; r.material.emissiveIntensity = i === m.idx ? 2.5 : 0.6; r.material.color.set(i === m.idx ? 0xffe27a : 0xb58a2a); }); }
  // événements depuis le jeu
  onLand(S, touch) {
    const m = this.active; if (!m || (m.id !== 'delivery' && m.id !== 'circuit') || !m.left) return;
    const a = this.nearestAirport(S.pos); if (a !== m.to || !this.world.onRunway(S.pos.x, S.pos.z)) return;
    if (m.id === 'circuit' && m.t > 240) { this.toast('TOUR DE PISTE', 'trop lent (' + Math.round(m.t) + ' s)', 2500); return this.clear(); }
    const xp = m.id === 'circuit' ? 400 : 800 + Math.max(0, 600 - m.t) + (touch.fpm < 300 ? 200 : 0);
    this.pg.add(xp, m.def.name + ' réussie'); if (m.id === 'delivery') this.pg.unlock('delivery');
    this.toast('✅ MISSION RÉUSSIE', `${m.def.name} · ${Math.round(m.t)} s · +${Math.round(xp)} XP`, 3500); this.clear();
  }
  onCrash() { if (this.active) { this.toast('MISSION ÉCHOUÉE', this.active.def.name, 2000); this.clear(); } }
  update(dt, S) {
    const m = this.active; if (!m) return; m.t += dt;
    if (m.id === 'rings') {
      const r = m.rings[m.idx]; r.rotation.z += dt * 0.5;
      const rel = S.pos.clone().sub(r.position), side = rel.dot(r.userData.n);
      if (m.prevSide !== undefined && m.prevSide < 0 && side >= 0) {
        if (rel.clone().addScaledVector(r.userData.n, -side).length() < 40) { m.idx++; this.pg.popup('💍 ' + m.idx + '/12', 'anneau'); if (m.idx >= m.rings.length) { const xp = Math.max(200, 900 - m.t * 4); this.pg.add(xp, 'Parcours terminé en ' + Math.round(m.t) + ' s'); this.pg.unlock('rings'); this.toast('🏁 PARCOURS TERMINÉ', Math.round(m.t) + ' s · +' + Math.round(xp) + ' XP', 3500); return this.clear(); } this.highlight(); m.prevSide = undefined; this.ui(S); return; }
      }
      m.prevSide = side;
    } else if (m.id === 'delivery' || m.id === 'circuit') { if (!S.onGround) m.left = true; }
    else if (m.id === 'lowlevel') {
      const h = this.world.height(S.pos.x, S.pos.z), agl = S.pos.y - Math.max(h, 0.5);
      if (h < 1 && agl < 46 && !S.onGround) m.low += dt; else m.low = Math.max(0, m.low - dt * 0.5);
      if (m.low >= 20) { this.pg.add(350, 'Rase-vagues'); this.toast('🌊 RASE-VAGUES RÉUSSI', '+350 XP', 3000); return this.clear(); }
    }
    if ((m.uiT = (m.uiT || 0) + dt) > 0.25) { m.uiT = 0; this.ui(S); }
  }
  // direction de l'objectif (pour la flèche HUD / minimap)
  target() {
    const m = this.active; if (!m) return null;
    if (m.id === 'rings') return m.rings[m.idx]?.position;
    if (m.to) return new THREE.Vector3(m.to.x, m.to.h, m.to.z + RWY.len / 2);
    return null;
  }
  ui(S) {
    const m = this.active; if (!m) return; const t = this.target(); const d = t ? (S.pos.distanceTo(t) / 1000).toFixed(1) + ' km' : '';
    let obj = '';
    if (m.id === 'rings') obj = `Anneau ${m.idx + 1} / 12 · ${d}`;
    else if (m.id === 'delivery') obj = `Destination : <b>${m.to.name}</b> · piste 36 · ${d}`;
    else if (m.id === 'circuit') obj = m.left ? `Reposez-vous à <b>${m.to.name}</b> · ${d}` : 'Décollez !';
    else obj = `Sous 150 ft au-dessus de la mer : ${m.low.toFixed(1)} / 20 s`;
    $('#missionCard').innerHTML = `<div class="mh">${m.def.icon} ${m.def.name}<span>${Math.floor(m.t / 60)}:${String(Math.floor(m.t % 60)).padStart(2, '0')}</span></div><div>${obj}</div><button id="mAbort">Abandonner</button>`;
    $('#mAbort').onclick = () => this.clear();
  }
}
