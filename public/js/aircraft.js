import * as THREE from 'three';

// Caractéristiques de vol + géométrie de chaque appareil (avant = -Z, haut = +Y, droite = +X)
export const SPECS = {
  jet:   { name: 'Vortex X1',   mass: 11000, S: 38,  thrust: 100000, cd0: 0.022, len: 17,  gearH: 2.05, vr: 72,  stall: 58, color: 0x8e99a6, accent: 0x1e3a8a, roll: 2.6, pitch: 1.1, yaw: 0.4, cam: 26 },
  cargo: { name: 'Atlas C-9',   mass: 70000, S: 260, thrust: 420000, cd0: 0.024, len: 44,  gearH: 4.3, vr: 70,  stall: 55, color: 0xf2f4f7, accent: 0x0e7490, roll: 0.9, pitch: 0.55, yaw: 0.25, cam: 70 },
  prop:  { name: 'Sparrow 172', mass: 1100,  S: 16,  thrust: 5200,  cd0: 0.03,  len: 8.3, gearH: 1.2, vr: 30,  stall: 24, color: 0xf8fafc, accent: 0xdc2626, roll: 1.6, pitch: 0.9, yaw: 0.5, cam: 16 },
};

export const LIVERIES = [
  { id: 'default', name: 'Usine', lvl: 1 },
  { id: 'arctic', name: 'Arctique', lvl: 2, color: 0xf4f7fb, accent: 0x1d4ed8, metal: 0.3, rough: 0.3 },
  { id: 'racing', name: 'Racing', lvl: 3, color: 0xdc2626, accent: 0xfafafa, metal: 0.3, rough: 0.2 },
  { id: 'stealth', name: 'Furtif', lvl: 4, color: 0x22262c, accent: 0xfbbf24, metal: 0.2, rough: 0.6 },
  { id: 'ocean', name: 'Océan', lvl: 5, color: 0x0e7490, accent: 0xfde68a, metal: 0.4, rough: 0.25 },
  { id: 'chrome', name: 'Chrome', lvl: 7, color: 0xd9dde3, accent: 0x111827, metal: 1.0, rough: 0.08 },
  { id: 'gold', name: 'Or Impérial', lvl: 10, color: 0xd4a73a, accent: 0x1f2937, metal: 1.0, rough: 0.18 },
  { id: 'neon', name: 'Néon', lvl: 12, color: 0x1e1b4b, accent: 0xf472b6, metal: 0.5, rough: 0.2, glow: true },
];
function livery(spec, type, callsign, custom) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
  const base = '#' + new THREE.Color(spec.color).getHexString(), acc = '#' + new THREE.Color(spec.accent).getHexString();
  g.fillStyle = base; g.fillRect(0, 0, 1024, 512);
  // bruit de peinture
  for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.025)`; g.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2); }
  // u = tour (0..1), v = longueur (0 queue → 1 nez) ; x = u*1024, y = (1-v)*512
  if (type === 'jet' && !custom) {
    g.fillStyle = '#5b6570'; g.fillRect(0, 0, 1024, 512); g.globalAlpha = 0.35; // camouflage
    for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? '#7c8793' : '#4b545e'; g.beginPath(); g.ellipse(Math.random() * 1024, Math.random() * 512, 60 + Math.random() * 90, 30 + Math.random() * 50, Math.random() * 3, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    g.fillStyle = '#22262b'; g.fillRect(0, 0, 1024, 18); // nez radôme
  } else {
    g.fillStyle = acc; g.fillRect(0, 300, 1024, 26); g.fillStyle = '#f59e0b'; g.fillRect(0, 330, 1024, 8);
    g.fillStyle = '#c3cad3'; g.fillRect(360, 0, 304, 512); g.fillStyle = base; g.fillRect(380, 0, 264, 512); // ventre
    // hublots
    g.fillStyle = '#10161f';
    const rows = type === 'cargo' ? [[40, 430, 13]] : [];
    for (const u of [230, 794]) for (const [y0, y1, st] of rows) for (let y = y0; y < y1; y += st) { g.beginPath(); g.roundRect(u - 4, y, 8, 9, 3); g.fill(); }
    g.save(); g.fillStyle = acc; g.font = 'bold 34px Arial';
    for (const u of [230, 794]) { g.save(); g.translate(u + 14, 250); g.rotate(-Math.PI / 2 * (u < 512 ? 1 : -1)); g.fillText(callsign, -60, 10); g.restore(); }
    g.restore();
  }
  // lignes de panneaux
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.2;
  for (let y = 20; y < 512; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  for (let x = 0; x < 1024; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect((i * 37) % 1024, Math.floor(i / 27) * 42 + 18, 1.5, 1.5); } // rivets
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function wing(span, root, tip, sweep, thick, dihedral = 0) {
  // demi-aile droite, profil arrondi : shape dans le plan (x = envergure, y = corde)
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(span, -sweep); s.lineTo(span, -sweep - tip); s.lineTo(0, -root); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.5, bevelSize: Math.min(tip, root) * 0.12, bevelSegments: 4, curveSegments: 1 });
  g.translate(0, 0, -thick / 2); g.rotateX(-Math.PI / 2); // y(corde) → z
  // amincir le bout d'aile
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); const k = 1 - 0.55 * (x / span); p.setY(i, p.getY(i) * k + x * Math.tan(dihedral)); }
  g.computeVertexNormals(); return g;
}
function lathe(profile, seg = 48) { const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)); const g = new THREE.LatheGeometry(pts, seg); g.rotateX(-Math.PI / 2); return g; }

export function buildAircraft(type, callsign = 'ALPHA-1', liveryId = 'default') {
  const L0 = LIVERIES.find((l) => l.id === liveryId) || LIVERIES[0]; const custom = L0.id !== 'default';
  const sp = custom ? { ...SPECS[type], color: L0.color, accent: L0.accent } : SPECS[type]; const root = new THREE.Group(); const parts = { ailL: null, ailR: null, elev: null, rudder: null, gear: [], props: [], burners: [], strobes: [], flaps: [] };
  const skin = new THREE.MeshStandardMaterial({ map: livery(sp, type, callsign, custom), metalness: custom ? L0.metal : type === 'jet' ? 0.55 : 0.35, roughness: custom ? L0.rough : type === 'jet' ? 0.45 : 0.28 });
  const paint = new THREE.MeshStandardMaterial({ color: type === 'jet' && !custom ? 0x5f6975 : sp.color, metalness: custom ? L0.metal : 0.45, roughness: custom ? L0.rough : 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: sp.accent, metalness: 0.4, roughness: 0.3, emissive: L0.glow ? sp.accent : 0x000000, emissiveIntensity: L0.glow ? 1.5 : 0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.7, roughness: 0.35 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 1, roughness: 0.22 });
  const glass = new THREE.MeshPhysicalMaterial({ color: type === 'jet' ? 0xc9a24a : 0x223344, metalness: 0.2, roughness: 0.02, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 2.5 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const L = sp.len;
  const hinge = (x, y, z, parent = root) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  if (type === 'jet') {
    // fuselage effilé type chasseur
    const prof = [[0, -8.2], [0.55, -8.2], [0.75, -7.6], [0.95, -5], [1.05, -2], [1.05, 1], [0.95, 3.5], [0.75, 5.5], [0.45, 7.2], [0.18, 8.3], [0, 8.8]];
    const fus = add(lathe(prof), skin); fus.scale.set(1.15, 0.95, 1);
    add(new THREE.SphereGeometry(0.62, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 3.2), glass, 0, 0.75, -4.2);
    add(new THREE.BoxGeometry(0.08, 0.5, 0.08), dark, 0, 1.05, -3.2); // arceau
    add(new THREE.CylinderGeometry(0.02, 0.05, 1.4).rotateX(Math.PI / 2), metal, 0, 0, -9.3); // tube pitot
    // entrées d'air
    for (const s of [-1, 1]) {
      const intake = add(lathe([[0.55, -2.2], [0.62, 0], [0.6, 4], [0.5, 4.2], [0.3, 4.2]], 24), paint, s * 1.25, -0.25, 0.2);
      add(new THREE.CircleGeometry(0.5, 24).rotateY(Math.PI), dark, s * 1.25, -0.25, -4.18);
    }
    // ailes delta
    const wg = wing(5.2, 7.5, 1.6, 5.2, 0.22, 0.02);
    for (const s of [-1, 1]) { const w = add(wg, paint, s * 0.9, -0.2, -2.2); w.scale.x = s; }
    for (const s of [-1, 1]) { // ailerons
      const h = hinge(s * 3.8, -0.2, 3.2); const a = add(new THREE.BoxGeometry(2.4, 0.12, 0.9), accent, s * 0.2, 0, 0.45, h); parts[s < 0 ? 'ailL' : 'ailR'] = h;
      add(new THREE.CylinderGeometry(0.07, 0.07, 3.2).rotateX(Math.PI / 2), dark, s * 6.15, -0.2, 1.2); // rail missile
      add(new THREE.CylinderGeometry(0.1, 0.1, 2.6).rotateX(Math.PI / 2), metal, s * 6.15, -0.38, 1.1);
    }
    // empennage double
    const fin = wing(2.3, 3.0, 1.1, 2.2, 0.12);
    for (const s of [-1, 1]) { const f = add(fin, paint, s * 0.8, 0.6, 4.2); f.scale.x = s; f.rotation.z = s * (Math.PI / 2 - 0.42); }
    const rud = hinge(0, 0, 0); parts.rudder = rud;
    for (const s of [-1, 1]) { const hs = add(wing(2.6, 2.4, 1, 1.6, 0.12), paint, s * 1.1, -0.1, 5.6); hs.scale.x = s; }
    parts.elev = hinge(0, -0.1, 7.6);
    add(new THREE.BoxGeometry(6.2, 0.1, 0.6), accent, 0, 0, 0.1, parts.elev);
    // tuyères + postcombustion
    // tuyères détaillées : carénage, pétales titane, cavité sombre, cône central + flamme
    const titan = new THREE.MeshStandardMaterial({ color: 0x8a7f74, metalness: 1, roughness: 0.35 });
    const inner = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9, side: THREE.BackSide });
    add(lathe([[0.6, -0.3], [1.1, 0.6], [1.05, 1.0], [0.3, 1.1]], 32), skin, 0, 0, 7.2).scale.set(1.15, 0.55, 1); // carénage entre tuyères
    for (const s of [-1, 1]) {
      const x = s * 0.62;
      add(lathe([[0.56, 0], [0.54, 0.9], [0.5, 1.2]], 32), metal, x, 0, 7.6);
      for (let k = 0; k < 12; k++) { const pet = add(new THREE.BoxGeometry(0.2, 0.025, 0.55), titan, 0, 0, 0); const a = (k / 12) * Math.PI * 2; pet.position.set(x + Math.cos(a) * 0.46, Math.sin(a) * 0.46, 9.05); pet.rotation.z = a + Math.PI / 2; pet.rotateX(-0.12); }
      add(new THREE.CylinderGeometry(0.44, 0.44, 1.4, 24, 1, true).rotateX(Math.PI / 2), inner, x, 0, 8.6);
      const core = add(new THREE.ConeGeometry(0.22, 0.5, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x222226, emissive: 0xff7a2a, emissiveIntensity: 0.2, metalness: 0.6, roughness: 0.5 }), x, 0, 8.2); core.castShadow = false; parts.cores = (parts.cores || []).concat(core);
      const bm = new THREE.MeshBasicMaterial({ color: 0x7fc8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const b = add(new THREE.ConeGeometry(0.4, 3.6, 20, 1, true).rotateX(-Math.PI / 2), bm, x, 0, 11.1); b.castShadow = false; parts.burners.push(b);
      const bm2 = bm.clone(); bm2.color.set(0xffa050);
      const b2 = add(new THREE.ConeGeometry(0.3, 1.6, 16, 1, true).rotateX(-Math.PI / 2), bm2, x, 0, 10.0); b2.castShadow = false; parts.burners.push(b2);
    }
  } else if (type === 'cargo') {
    const prof = [[0, -22], [0.8, -21.5], [1.6, -19], [2.2, -14], [2.55, -8], [2.6, 0], [2.6, 8], [2.4, 13], [2.0, 16], [1.4, 18.6], [0.9, 20.2], [0.3, 21.5], [0, 22]];
    const fus = add(lathe(prof.map(([r, y]) => [r, -y]).reverse()), skin); fus.scale.set(1, 1.05, 1);
    add(new THREE.BoxGeometry(2.4, 0.5, 1.2), glass, 0, 1.2, -19.2).rotation.x = 0.5; // cockpit
    const wg = wing(19, 8, 2.4, 10, 0.55, 0.08);
    for (const s of [-1, 1]) { const w = add(wg, paint, s * 2, -0.9, -4); w.scale.x = s; }
    for (const s of [-1, 1]) {
      const h = hinge(s * 15.5, -0.3, 8.3); add(new THREE.BoxGeometry(5, 0.2, 1), accent, s * 0.5, 0, 0.3, h); parts[s < 0 ? 'ailL' : 'ailR'] = h;
      const fl = hinge(s * 6.5, -0.7, 4.6); add(new THREE.BoxGeometry(7, 0.2, 1.4), paint, 0, 0, 0.6, fl); parts.flaps.push(fl);
      for (const e of [7, 13]) { // réacteurs
        const ex = s * e, ez = -6.5 + e * 0.52;
        add(lathe([[1.15, -2.2], [1.3, -1.6], [1.3, 1], [1.0, 2.2], [0.5, 2.8]], 32), paint, ex, -2.3, ez);
        add(new THREE.TorusGeometry(1.15, 0.12, 8, 32), metal, ex, -2.3, ez - 2.2);
        add(new THREE.CircleGeometry(1.1, 24).rotateY(Math.PI), dark, ex, -2.3, ez - 2.05);
        const fan = add(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 12).rotateX(Math.PI / 2), metal, ex, -2.3, ez - 2.0); parts.props.push(fan);
        add(new THREE.BoxGeometry(0.3, 1.2, 3), paint, ex, -1.2, ez + 0.2); // mât
      }
    }
    const fin = add(wing(8, 7, 3, 5, 0.35), skin, 0, 2.2, 14.5); fin.rotation.z = Math.PI / 2;
    add(new THREE.BoxGeometry(0.4, 7.2, 1.8), accent, 0, 6.0, 19.2);
    for (const s of [-1, 1]) { const h = add(wing(7, 5, 2, 4, 0.25), paint, s * 1.2, 1.2, 15.5); h.scale.x = s; }
    parts.elev = hinge(0, 1.2, 20.3); add(new THREE.BoxGeometry(14, 0.15, 0.9), accent, 0, 0, 0.3, parts.elev);
    parts.rudder = hinge(0, 5, 20);
  } else {
    // monomoteur à ailes hautes
    const prof = [[0, -3.3], [0.45, -3.2], [0.6, -2.4], [0.72, -1.2], [0.72, 0.6], [0.55, 1.8], [0.3, 3.8], [0.12, 4.7], [0, 4.8]];
    const fus = add(lathe(prof), skin); fus.scale.set(0.95, 1.15, 1);
    add(new THREE.SphereGeometry(0.62, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1.8), glass, 0, 0.45, -0.9);
    const wg = wing(5.4, 1.6, 1.1, 0.2, 0.18, 0.03);
    for (const s of [-1, 1]) { const w = add(wg, skin, s * 0.3, 0.95, -1.3); w.scale.x = s; add(new THREE.CylinderGeometry(0.04, 0.05, 2.2), metal, s * 1.3, 0.35, -0.6).rotation.z = s * 0.95; }
    add(new THREE.BoxGeometry(0.7, 0.08, 1.6), skin, 0, 0.95, -0.5);
    for (const s of [-1, 1]) { const h = hinge(s * 3.8, 0.95, -0.1); add(new THREE.BoxGeometry(2.4, 0.08, 0.4), accent, s * 0.2, 0, 0.2, h); parts[s < 0 ? 'ailL' : 'ailR'] = h;
      const fl = hinge(s * 1.5, 0.92, -0.1); add(new THREE.BoxGeometry(2, 0.07, 0.45), skin, 0, 0, 0.22, fl); parts.flaps.push(fl); }
    const fin = add(wing(1.5, 1.4, 0.8, 0.9, 0.1), skin, 0, 0.2, 3.3); fin.rotation.z = Math.PI / 2;
    add(new THREE.BoxGeometry(0.1, 0.25, 1.2), accent, 0, 1.3, 4.2);
    for (const s of [-1, 1]) { const h = add(wing(1.6, 1, 0.6, 0.3, 0.08), skin, s * 0.1, 0.1, 3.7); h.scale.x = s; }
    parts.elev = hinge(0, 0.1, 4.5); add(new THREE.BoxGeometry(3.2, 0.06, 0.35), accent, 0, 0, 0.15, parts.elev);
    parts.rudder = hinge(0, 1, 4.6);
    // hélice
    const spin = add(new THREE.ConeGeometry(0.22, 0.5, 16).rotateX(-Math.PI / 2), accent, 0, 0, -3.55);
    const prop = new THREE.Group(); prop.position.set(0, 0, -3.5); root.add(prop);
    for (let i = 0; i < 2; i++) { const b = add(new THREE.BoxGeometry(0.14, 0.9, 0.04), dark, 0, 0.45, 0, prop); b.geometry.translate(0, 0, 0); const bb = new THREE.Group(); bb.rotation.z = i * Math.PI; bb.add(b); prop.add(bb); b.rotation.y = 0.3; }
    const disc = add(new THREE.CircleGeometry(0.95, 32), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, depthWrite: false }), 0, 0, -3.52); disc.castShadow = false; parts.disc = disc;
    parts.props.push(prop);
  }

  // train d'atterrissage (rentrant)
  const gh = sp.gearH, wheelR = type === 'cargo' ? 0.65 : type === 'jet' ? 0.38 : 0.3;
  const gearPos = type === 'jet' ? [[0, -5.6], [-1.5, 1.2], [1.5, 1.2]] : type === 'cargo' ? [[0, -17], [-3, 1], [3, 1], [-3, 3], [3, 3]] : [[0, -2.6], [-1.1, 0.1], [1.1, 0.1]];
  for (const [x, z] of gearPos) {
    const g = hinge(x, -0.3, z);
    const len = gh - 0.3 - wheelR;
    add(new THREE.CylinderGeometry(wheelR * 0.18, wheelR * 0.22, len, 10), metal, 0, -len / 2, 0, g);
    add(new THREE.CylinderGeometry(wheelR * 0.28, wheelR * 0.28, len * 0.35, 10), dark, 0, -len * 0.25, 0, g);
    const nw = type === 'cargo' && x !== 0 ? [-0.5, 0.5] : [0];
    for (const o of nw) { const w = add(new THREE.CylinderGeometry(wheelR, wheelR, wheelR * 0.7, 20).rotateZ(Math.PI / 2), tyre, o, -len, 0, g); add(new THREE.CylinderGeometry(wheelR * 0.55, wheelR * 0.55, wheelR * 0.72, 16).rotateZ(Math.PI / 2), metal, o, -len, 0, g); }
    g.userData.side = Math.sign(x) || 0; parts.gear.push(g);
  }
  // feux de navigation / strobes
  const span = type === 'cargo' ? 21 : type === 'jet' ? 6.2 : 5.8;
  const nav = (c, x, y, z) => { const m = add(new THREE.SphereGeometry(type === 'cargo' ? 0.3 : 0.12, 8, 6), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }), x, y, z); m.castShadow = false; return m; };
  nav(0xff2020, -span, type === 'prop' ? 0.95 : -0.2, type === 'cargo' ? 7 : 0.8).material.color.multiplyScalar(4);
  nav(0x20ff40, span, type === 'prop' ? 0.95 : -0.2, type === 'cargo' ? 7 : 0.8).material.color.multiplyScalar(4);
  parts.strobes.push(nav(0xffffff, 0, type === 'cargo' ? 9.5 : type === 'jet' ? 3.3 : 1.45, L * 0.48));
  parts.strobes.push(nav(0xffffff, 0, type === 'cargo' ? -2.8 : -1, type === 'cargo' ? -2 : 0));
  // phare d'atterrissage
  const ll = new THREE.SpotLight(0xfff3d6, 0, 900, 0.35, 0.5, 1.2); ll.position.set(0, -0.5, -L * 0.3); ll.target.position.set(0, -12, -L * 0.3 - 80); root.add(ll, ll.target); parts.landingLight = ll;
  root.userData.parts = parts; root.userData.spec = sp;
  return root;
}

// Animation des gouvernes, train, hélices, feux
export function animateAircraft(obj, st, dt, t) {
  const p = obj.userData.parts;
  if (p.ailL) { p.ailL.rotation.x = -st.inRoll * 0.35; p.ailR.rotation.x = st.inRoll * 0.35; }
  if (p.elev) p.elev.rotation.x = -st.inPitch * 0.35;
  if (p.rudder) p.rudder.rotation.y = st.inYaw * 0.4;
  for (const f of p.flaps) f.rotation.x = st.flaps * 0.6;
  st.gearAnim += ((st.gear ? 1 : 0) - st.gearAnim) * Math.min(1, dt * 1.2);
  for (const g of p.gear) { g.rotation.x = (1 - st.gearAnim) * (g.userData.side === 0 ? -1.55 : 1.55); g.rotation.z = (1 - st.gearAnim) * g.userData.side * 0.0; g.visible = st.gearAnim > 0.03; }
  for (const pr of p.props) pr.rotation.z += dt * (8 + st.throttle * 60);
  if (p.disc) p.disc.material.opacity = Math.min(0.35, st.throttle * 0.5 + 0.08);
  for (const b of p.burners) { b.material.opacity = Math.max(0, (st.throttle - 0.55) * 2) * (0.7 + Math.random() * 0.3); b.scale.set(1, 1, 0.6 + st.throttle * 0.8); }
  if (p.cores) for (const c of p.cores) c.material.emissiveIntensity = 0.3 + st.throttle * 3;
  const on = (t % 1.2) < 0.08; for (const s of p.strobes) s.visible = on;
  p.landingLight.intensity = st.gear ? 400 : 0;
}
