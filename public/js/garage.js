// Garage / hangar 3D : inspection libre de l'appareil, livrées, animations, points d'intérêt
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAircraft, animateAircraft, SPECS, LIVERIES } from './aircraft.js';
const $ = (s) => document.querySelector(s);

const STATS = { // notes /10 pour la fiche
  jet: { Vitesse: 9, Agilité: 9, Stabilité: 5, Charge: 2, Facilité: 4 },
  cargo: { Vitesse: 6, Agilité: 3, Stabilité: 9, Charge: 10, Facilité: 6 },
  prop: { Vitesse: 3, Agilité: 6, Stabilité: 8, Charge: 3, Facilité: 10 },
};
const DESC = {
  jet: 'Chasseur bimoteur à ailes delta, dérives canted, postcombustion. Extrêmement vif : idéal pour la voltige et les parcours d\'anneaux.',
  cargo: 'Long-courrier quadriréacteur. Lourd et très stable, pardonne les erreurs en approche. Longue piste nécessaire.',
  prop: 'Monomoteur à aile haute. Lent, docile, décolle en quelques centaines de mètres : parfait pour apprendre.',
};

export class Garage {
  constructor(renderer, progress, onFly) {
    this.r = renderer; this.pg = progress; this.onFly = onFly; this.open = false; this.type = 'jet'; this.anim = { gear: true, flaps: 0, surf: false, engine: false, rotate: true, wire: false };
    const sc = (this.scene = new THREE.Scene()); sc.background = new THREE.Color(0x0b0f17); sc.fog = new THREE.Fog(0x0b0f17, 120, 260);
    this.cam = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    const pm = new THREE.PMREMGenerator(renderer); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    sc.environment = this.env;
    // sol réfléchissant + plateau tournant
    const gc = document.createElement('canvas'); gc.width = gc.height = 512; const g = gc.getContext('2d'); g.fillStyle = '#14181f'; g.fillRect(0, 0, 512, 512); g.strokeStyle = 'rgba(120,160,220,.18)'; g.lineWidth = 2; for (let i = 0; i <= 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    const gt = new THREE.CanvasTexture(gc); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(30, 30); gt.anisotropy = 8;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(300, 64), new THREE.MeshStandardMaterial({ map: gt, metalness: 0.6, roughness: 0.35 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    this.table = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.3, 96), new THREE.MeshStandardMaterial({ color: 0x1b2230, metalness: 0.9, roughness: 0.25 })); this.table.receiveShadow = true; sc.add(this.table);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 128), new THREE.MeshBasicMaterial({ color: 0x38bdf8, toneMapped: false })); this.ring.rotation.x = Math.PI / 2; sc.add(this.ring);
    // hangar : arches + néons
    const archM = new THREE.MeshStandardMaterial({ color: 0x2a303b, metalness: 0.8, roughness: 0.4 });
    for (let i = -3; i <= 3; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(90, 1.4, 8, 48, Math.PI), archM); a.position.z = i * 30; sc.add(a); const n = new THREE.Mesh(new THREE.TorusGeometry(88, 0.35, 6, 64, Math.PI), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x6366f1 : 0x38bdf8, toneMapped: false })); n.position.z = i * 30; sc.add(n); }
    sc.add(new THREE.HemisphereLight(0xb8c8ff, 0x10131a, 0.6));
    const key = new THREE.SpotLight(0xffffff, 1100, 300, 0.5, 0.6, 1.4); key.position.set(30, 60, 40); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0002; sc.add(key); this.key = key;
    const rim = new THREE.SpotLight(0x7dd3fc, 1800, 300, 0.6, 0.8, 1.4); rim.position.set(-40, 30, -50); sc.add(rim);
    const fill = new THREE.PointLight(0xf0abfc, 400, 200, 1.5); fill.position.set(-30, 10, 40); sc.add(fill);
    this.controls = new OrbitControls(this.cam, renderer.domElement); this.controls.enableDamping = true; this.controls.dampingFactor = 0.06; this.controls.maxPolarAngle = Math.PI * 0.495; this.controls.enabled = false;
    this.clock = new THREE.Clock(); this.tween = null; this.t = 0;
    this.st = { inRoll: 0, inPitch: 0, inYaw: 0, flaps: 0, gear: true, gearAnim: 1, throttle: 0 };
    this.bindUI();
  }
  bindUI() {
    $('#gClose').onclick = () => this.hide();
    $('#gFly').onclick = () => { this.hide(); this.onFly(this.type); };
    $('#gPlanes').innerHTML = Object.entries(SPECS).map(([k, s]) => `<button data-k="${k}"><b>${s.name}</b><small>${{ jet: 'Chasseur', cargo: 'Long-courrier', prop: 'Monomoteur' }[k]}</small></button>`).join('');
    $('#gPlanes').querySelectorAll('button').forEach((b) => (b.onclick = () => this.select(b.dataset.k)));
    const tog = (id, key, fn) => ($(id).onclick = () => { this.anim[key] = typeof this.anim[key] === 'number' ? (this.anim[key] ? 0 : 1) : !this.anim[key]; $(id).classList.toggle('on', !!this.anim[key]); fn && fn(); });
    tog('#gGear', 'gear'); tog('#gFlaps', 'flaps'); tog('#gSurf', 'surf'); tog('#gEngine', 'engine'); tog('#gRot', 'rotate', () => (this.controls.autoRotate = this.anim.rotate)); tog('#gWire', 'wire', () => this.applyWire());
    document.querySelectorAll('#gSpots button').forEach((b) => (b.onclick = () => this.focus(b.dataset.s)));
    addEventListener('keydown', (e) => { if (!this.open) return; if (e.code === 'Escape') this.hide(); if (e.code === 'ArrowRight') this.cycle(1); if (e.code === 'ArrowLeft') this.cycle(-1); });
  }
  cycle(d) { const k = Object.keys(SPECS); this.select(k[(k.indexOf(this.type) + d + k.length) % k.length]); }
  show(type) { this.open = true; document.body.classList.add('ingarage'); $('#garage').classList.remove('hidden'); this.controls.enabled = true; this.controls.autoRotate = this.anim.rotate; this.controls.autoRotateSpeed = 0.8; this.select(type || this.type); this.resize(); }
  hide() { this.open = false; document.body.classList.remove('ingarage'); $('#garage').classList.add('hidden'); this.controls.enabled = false; }
  resize() { this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); }
  select(type) {
    this.type = type; const liv = this.pg.p.livery[type] || 'default';
    if (this.model) this.scene.remove(this.model);
    const m = (this.model = buildAircraft(type, this.pg.name, liv));
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } if (o.isSpotLight) o.intensity = 0; });
    const sp = SPECS[type]; m.position.y = sp.gearH + 0.15; this.scene.add(m);
    const box = new THREE.Box3().setFromObject(m); this.box = box; const size = box.getSize(new THREE.Vector3()); const R = Math.max(size.x, size.z) * 0.62;
    this.table.scale.set(R, 1, R); this.table.position.y = 0.0; this.ring.scale.setScalar(R); this.ring.position.y = 0.16;
    this.key.position.set(R * 1.5, R * 3, R * 2);
    this.R = R; this.applyWire(); this.focus('all', true);
    // UI
    $('#gPlanes').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === type));
    $('#gName').textContent = sp.name; $('#gDesc').textContent = DESC[type];
    $('#gStats').innerHTML = Object.entries(STATS[type]).map(([k, v]) => `<div class="gs"><span>${k}</span><i><em style="width:${v * 10}%"></em></i><b>${v}</b></div>`).join('')
      + `<div class="gspec"><div><small>Masse</small><b>${(sp.mass / 1000).toFixed(1)} t</b></div><div><small>Poussée</small><b>${(sp.thrust / 1000).toFixed(0)} kN</b></div><div><small>Surface alaire</small><b>${sp.S} m²</b></div><div><small>V rotation</small><b>${Math.round(sp.vr * 1.944)} kt</b></div><div><small>Décrochage</small><b>${Math.round(sp.stall * 1.944)} kt</b></div><div><small>Longueur</small><b>${sp.len} m</b></div></div>`;
    let meshes = 0, tris = 0; m.traverse((o) => { if (o.isMesh) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
    $('#gMesh').textContent = `${meshes} maillages · ${Math.round(tris).toLocaleString('fr-FR')} triangles`;
    const lvl = this.pg.level;
    $('#gLiv').innerHTML = LIVERIES.map((l) => { const c = l.color ? '#' + new THREE.Color(l.color).getHexString() : '#8e99a6', a = l.accent ? '#' + new THREE.Color(l.accent).getHexString() : '#1e3a8a'; const lock = lvl < l.lvl; return `<button data-l="${l.id}" class="${liv === l.id ? 'on' : ''} ${lock ? 'lock' : ''}" title="${lock ? 'Niveau ' + l.lvl + ' requis' : l.name}"><i style="background:linear-gradient(135deg,${c} 55%,${a} 55%)"></i><small>${lock ? '🔒 Niv. ' + l.lvl : l.name}</small></button>`; }).join('');
    $('#gLiv').querySelectorAll('button').forEach((b) => (b.onclick = () => { const l = LIVERIES.find((x) => x.id === b.dataset.l); if (this.pg.level < l.lvl) return; this.pg.p.livery[type] = l.id; this.pg.save(); this.select(type); }));
  }
  applyWire() { this.model?.traverse((o) => { if (o.isMesh && o.material && 'wireframe' in o.material) o.material.wireframe = this.anim.wire; }); }
  focus(spot, instant) {
    const sp = SPECS[this.type], L = sp.len, R = this.R, y0 = sp.gearH;
    const eye = { jet: [0, 1.05, -4.1], cargo: [-0.5, 1.4, -19.6], prop: [-0.3, 0.55, -0.9] }[this.type];
    const P = {
      all: [[R * 1.9, R * 0.75, R * 2.1], [0, y0, 0]],
      nose: [[L * 0.18, y0 + L * 0.05, -L * 0.75], [0, y0, -L * 0.45]],
      cockpit: [[L * 0.12, y0 + eye[1] + L * 0.1, eye[2] - L * 0.08], [0, y0 + eye[1], eye[2]]],
      engines: this.type === 'cargo' ? [[16, y0 - 1, -14], [10, y0 - 2.3, -3]] : this.type === 'jet' ? [[3, y0 + 1, L * 0.95], [0, y0, L * 0.5]] : [[2.4, y0 + 0.3, -5.5], [0, y0, -3.4]],
      gear: [[L * 0.35, 0.8, L * 0.1], [0, y0 * 0.45, 0]],
      tail: [[-L * 0.35, y0 + L * 0.25, L * 0.85], [0, y0 + L * 0.12, L * 0.45]],
      wing: [[R * 0.9, y0 + L * 0.3, R * 0.2], [R * 0.45, y0, 0]],
      top: [[0.01, R * 2.2, 0], [0, y0, 0]],
    }[spot];
    const to = { p: new THREE.Vector3(...P[0]), t: new THREE.Vector3(...P[1]) };
    if (instant) { this.cam.position.copy(to.p); this.controls.target.copy(to.t); this.controls.update(); return; }
    this.tween = { from: { p: this.cam.position.clone(), t: this.controls.target.clone() }, to, k: 0 };
    document.querySelectorAll('#gSpots button').forEach((b) => b.classList.toggle('on', b.dataset.s === spot));
    if (spot !== 'all') { this.anim.rotate = false; this.controls.autoRotate = false; $('#gRot').classList.remove('on'); }
  }
  render() {
    const dt = Math.min(this.clock.getDelta(), 0.05); this.t += dt;
    if (this.tween) { const tw = this.tween; tw.k = Math.min(1, tw.k + dt * 1.1); const e = 1 - Math.pow(1 - tw.k, 3); this.cam.position.lerpVectors(tw.from.p, tw.to.p, e); this.controls.target.lerpVectors(tw.from.t, tw.to.t, e); if (tw.k >= 1) this.tween = null; }
    this.controls.update();
    const st = this.st; st.gear = this.anim.gear; st.flaps = this.anim.flaps ? 1 : 0; st.throttle = this.anim.engine ? 0.75 + Math.sin(this.t * 0.7) * 0.25 : 0;
    const s = this.anim.surf ? Math.sin(this.t * 1.6) : 0; st.inRoll = s; st.inPitch = this.anim.surf ? Math.sin(this.t * 1.1) : 0; st.inYaw = this.anim.surf ? Math.sin(this.t * 0.8) : 0;
    if (this.model) animateAircraft(this.model, st, dt, this.t);
    this.ring.material.color.setHSL(0.55 + Math.sin(this.t * 0.5) * 0.08, 0.9, 0.6);
    if (this.model) this.model.userData.parts.landingLight.intensity = 0;
    const ex = this.r.toneMappingExposure; this.r.toneMappingExposure = 1.0; this.r.render(this.scene, this.cam); this.r.toneMappingExposure = ex;
  }
}
