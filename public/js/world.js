import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------ bruit
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, o = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
function ridged(x, y) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { s += a * (1 - Math.abs(vnoise(x * f, y * f) * 2 - 1)) ** 2; f *= 2.1; a *= 0.5; } return s; }
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ constantes monde
export const SIZE = 60000, SEG = 640, AIRPORT_H = 14;
export const RWY = { x: 0, z: 0, len: 3800, wid: 60 }; // piste 36/18 orientée Nord (-Z)
export const AIRPORTS = [
  { x: 0, z: 0, h: AIRPORT_H, name: 'AeroFlux International' },
  { x: -17000, z: 12000, h: 38, name: 'Nord-Ouest Regional' },
  { x: 15000, z: -13000, h: 26, name: 'Cap Sud-Est' },
];
export const CITIES = [
  { x: 2600, z: -600, r: 1200, name: 'Port-Flux' }, { x: -13500, z: 8000, r: 1000, name: 'Valmont' },
  { x: 11000, z: -9000, r: 900, name: 'Sable-Rouge' }, { x: 7000, z: 12500, r: 650, name: 'Bourg-Vert' }, { x: -9000, z: -12000, r: 600, name: 'Rocheval' },
];
const CITY = CITIES[0];

function rawHeight(x, z) {
  const d = Math.hypot(x * 0.8, z) / 25500;
  const island = 1 - smooth(0.55, 1.02, d);
  let h = fbm(x / 4200 + 11, z / 4200 + 7) * 300 - 60;
  h += ridged(x / 7000 + 3, z / 7000 + 9) * 1700 * smooth(0.3, 0.8, fbm(x / 14000 + 1, z / 14000 + 4, 3));
  h += (fbm(x / 600, z / 600, 3) - 0.5) * 30; // micro relief
  h = h * island - 90 * (1 - island);
  // lac intérieur
  const ld = Math.hypot(x + 4000, z - 3000) / 1800; h = h * smooth(0.6, 1.2, ld) + (-8) * (1 - smooth(0.6, 1.2, ld));
  for (const a of AIRPORTS) {
    const ax = Math.abs(x - a.x - 560) - 900, az = Math.abs(z - a.z) - 2250;
    const ad = Math.max(ax, az, 0) + Math.min(Math.max(ax, az), 0);
    const af = smooth(0, 1100, ad);
    h = a.h * (1 - af) + Math.max(h, af > 0.99 ? h : 6) * af;
    // couloirs d'approche dégagés (pente 2°) aux deux extrémités de la piste
    const dzA = Math.abs(z - a.z) - 2000;
    if (dzA > 0 && dzA < 14000) {
      const lat = smooth(700 + dzA * 0.12, 1500 + dzA * 0.2, Math.abs(x - a.x));
      const cap = a.h - 3 + dzA * 0.014;
      if (h > cap) h = cap + (h - cap) * lat;
    }
  }
  for (const c of CITIES) {
    const cd = Math.hypot(x - c.x, z - c.z) / c.r, cf = smooth(0.7, 1.5, cd);
    h = (Math.max(18, Math.min(h, 60)) + fbm(x / 800, z / 800, 2) * 10) * (1 - cf) + h * cf;
  }
  return h;
}
const cityF = (x, z) => { let v = 0; for (const c of CITIES) v = Math.max(v, 1 - smooth(0.6, 1.0, Math.hypot(x - c.x, z - c.z) / c.r)); return v; };

// ------------------------------------------------------------------ avion de ligne stationné (géométrie fusionnée)
function makeLiner() {
  const parts = []; const col = (geo, c) => { const n = geo.attributes.position.count, a = new Float32Array(n * 3), C = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = C.r; a[i * 3 + 1] = C.g; a[i * 3 + 2] = C.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (geo.index) geo = geo.toNonIndexed(); return geo; };
  const add = (geo, c) => parts.push(col(geo.index ? geo.toNonIndexed() : geo, c));
  // nez vers +Z
  add(new THREE.CylinderGeometry(2.4, 2.4, 34, 16).rotateX(Math.PI / 2).translate(0, 4.2, 0), 0xf4f6f8);
  add(new THREE.SphereGeometry(2.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 1.8).translate(0, 4.2, 17), 0xf4f6f8);
  add(new THREE.ConeGeometry(2.4, 9, 16).rotateX(-Math.PI / 2).translate(0, 4.8, -21.5), 0xf4f6f8);
  add(new THREE.BoxGeometry(4.9, 0.5, 30).translate(0, 3, 0), 0x2b4a6a); // bande
  add(new THREE.BoxGeometry(2.2, 0.6, 1).translate(0, 5.3, 18.5), 0x10161c); // cockpit
  const wing = new THREE.Shape([new THREE.Vector2(0, 4), new THREE.Vector2(18, -4), new THREE.Vector2(18, -6.5), new THREE.Vector2(0, -6)]);
  for (const s of [1, -1]) { const g = new THREE.ExtrudeGeometry(wing, { depth: 0.5, bevelEnabled: false }).rotateX(Math.PI / 2).scale(s, 1, -1).translate(s * 1.5, 3.2, 1); add(g, 0xdfe3e7); add(new THREE.CylinderGeometry(1.3, 1.1, 5, 12).rotateX(Math.PI / 2).translate(s * 7, 2.0, 3.5), 0xc9ced3);
    const st = new THREE.Shape([new THREE.Vector2(0, 2), new THREE.Vector2(7, -2), new THREE.Vector2(7, -3.5), new THREE.Vector2(0, -2.5)]); add(new THREE.ExtrudeGeometry(st, { depth: 0.3, bevelEnabled: false }).rotateX(Math.PI / 2).scale(s, 1, -1).translate(s, 5, -21), 0xdfe3e7); }
  const fin = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(5.5, 0), new THREE.Vector2(8.5, 8), new THREE.Vector2(5.5, 8)]);
  add(new THREE.ExtrudeGeometry(fin, { depth: 0.4, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-0.2, 6, -17), 0x0000ff); // dérive (couleur compagnie)
  for (const [x, z] of [[0, 14], [2.5, 0], [-2.5, 0]]) add(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 10).rotateZ(Math.PI / 2).translate(x, 0.5, z), 0x111111), add(new THREE.CylinderGeometry(0.15, 0.15, 2.5).translate(x, 1.5, z), 0x999999);
  return mergeGeometries(parts.map((p) => { for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'color'].includes(k)) p.deleteAttribute(k); return p; }));
}

// ------------------------------------------------------------------ textures procédurales
function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function noiseFill(g, w, h, base, amp, scale = 1) {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = (fbm(x / (8 * scale), y / (8 * scale), 4) - 0.5) * amp + (Math.random() - 0.5) * amp * 0.5;
    const i = (y * w + x) * 4; img.data[i] = base[0] + n; img.data[i + 1] = base[1] + n; img.data[i + 2] = base[2] + n; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
function normalFromHeight(w, amp, scl) {
  const c = document.createElement('canvas'); c.width = c.height = w; const g = c.getContext('2d'); const img = g.createImageData(w, w);
  const H = (x, y) => fbm(((x + w) % w) / scl, ((y + w) % w) / scl, 4) + Math.random() * 0.02;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * amp, dy = (H(x, y + 1) - H(x, y - 1)) * amp;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export class World {
  constructor(renderer, scene, quality) {
    this.renderer = renderer; this.scene = scene; this.q = quality;
    this.heights = new Float32Array((SEG + 1) * (SEG + 1));
    this.nightMats = []; this.lights = [];
    this.buildSky(); this.buildTerrain(); this.buildWater(); this.towers = []; AIRPORTS.forEach((a, i) => this.buildAirport(a, i)); this.buildCity(); this.buildRoads(); this.buildTurbines(); this.buildBoats(); this.buildTrees(); this.buildClouds();
    this.mapCanvas = this.makeMap();
  }
  // hauteur exacte du maillage (interpolation bilinéaire)
  height(x, z) {
    const s = SIZE / SEG, gx = (x + SIZE / 2) / s, gz = (z + SIZE / 2) / s;
    if (gx < 0 || gz < 0 || gx >= SEG || gz >= SEG) return -90;
    const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz, H = this.heights, n = SEG + 1;
    const a = H[iz * n + ix], b = H[iz * n + ix + 1], c = H[(iz + 1) * n + ix], d = H[(iz + 1) * n + ix + 1];
    return fx + fz <= 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  }
  onRunway(x, z) { return AIRPORTS.some((a) => Math.abs(x - a.x) < RWY.wid / 2 + 8 && Math.abs(z - a.z) < RWY.len / 2 + 60); }
  onPaved(x, z) { return this.onRunway(x, z) || AIRPORTS.some((a, i) => { const dx = x - a.x, dz = z - a.z; return (dx > 170 && dx < (i ? 600 : 800) && Math.abs(dz) < (i ? 1850 : 1900)) || (dx > 20 && dx < 200 && [-1870, -900, 0, 900, 1870].some((e) => Math.abs(dz - e) < 18)); }); }

  buildSky() {
    const sky = new Sky(); sky.scale.setScalar(100000); this.scene.add(sky); this.sky = sky;
    const u = sky.material.uniforms; u.turbidity.value = 6; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.85;
    this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -120; sc.right = sc.top = 120; sc.near = 10; sc.far = 3000;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfdcff, 0x3a4a2a, 0.8); this.scene.add(this.hemi);
    this.scene.fog = new THREE.FogExp2(0xbfd6ee, 0.000032);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    // étoiles
    const sp = []; for (let i = 0; i < 3000; i++) { const v = new THREE.Vector3().randomDirection(); if (v.y < 0.02) v.y = Math.abs(v.y) + 0.02; sp.push(v.x * 60000, v.y * 60000, v.z * 60000); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);
  }
  setTime(mode) {
    const cfg = { day: [52, 200, 3.2, 0.9, 0xbfd6ee, 0.5, 0], sunset: [4, 250, 2.2, 0.45, 0xe8a27a, 0.35, 0.3], night: [-12, 200, 0.12, 0.12, 0x0b1426, 0.14, 1] }[mode];
    const [elev, az, sunI, hemiI, fog, expo, night] = cfg;
    const phi = THREE.MathUtils.degToRad(90 - Math.max(elev, -4)), th = THREE.MathUtils.degToRad(az);
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, th);
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    this.sky.material.uniforms.rayleigh.value = mode === 'sunset' ? 3 : mode === 'night' ? 0.3 : 1.6;
    this.sun.intensity = sunI; this.sun.color.set(mode === 'sunset' ? 0xffb07a : mode === 'night' ? 0x8fa8ff : 0xfff4e6);
    this.hemi.intensity = hemiI; this.hemi.color.set(mode === 'night' ? 0x31456e : 0xbfdcff);
    this.scene.fog.color.set(fog); this.renderer.toneMappingExposure = expo;
    this.stars.material.opacity = night;
    this.night = night;
    this.sky.visible = mode !== 'night';
    this.scene.background = mode === 'night' ? new THREE.Color(0x040914) : null;
    if (this.water) { this.water.material.uniforms.sunDirection.value.copy(this.sunDir).normalize(); this.water.material.uniforms.sunColor.value.set(mode === 'night' ? 0x223355 : 0xffffff); this.water.material.uniforms.waterColor.value.set(mode === 'night' ? 0x020a14 : 0x0b3a4d); }
    for (const m of this.nightMats) m.emissiveIntensity = m.userData.base * (night > 0.5 ? 1 : mode === 'sunset' ? 0.4 : 0);
    for (const l of this.lights) l.visible = night > 0.2;
    if (this.cloudMat) this.cloudMat.color.set(mode === 'night' ? 0x2a3550 : mode === 'sunset' ? 0xffc9a8 : 0xffffff);
    // environnement réfléchi (PMREM depuis le ciel)
    const envScene = new THREE.Scene(); const s2 = new Sky(); s2.scale.setScalar(1000); s2.material.uniforms.sunPosition.value.copy(this.sunDir);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) s2.material.uniforms[k].value = this.sky.material.uniforms[k].value;
    envScene.add(s2);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(envScene, 0, 1, 2000);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = mode === 'night' ? 0.15 : 1;
  }

  buildTerrain() {
    const n = SEG + 1, geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const h = rawHeight(pos.getX(i), pos.getZ(i)); pos.setY(i, h); this.heights[i] = h; }
    geo.computeVertexNormals();
    const nor = geo.attributes.normal, c = new THREE.Color();
    const sand = new THREE.Color(0xc9b98a), g1 = new THREE.Color(0x4d7a2c), g2 = new THREE.Color(0x6b8f3a), g3 = new THREE.Color(0x35561f), dry = new THREE.Color(0x8d8a52), rock = new THREE.Color(0x6e675e), rock2 = new THREE.Color(0x8a8378), snow = new THREE.Color(0xf4f7fb), urban = new THREE.Color(0x77776f);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), slope = 1 - nor.getY(i);
      const m = fbm(x / 600, z / 600, 4), m2 = fbm(x / 140 + 5, z / 140, 3);
      c.copy(g1).lerp(g2, m).lerp(g3, smooth(0.45, 0.75, m2)).lerp(dry, smooth(0.6, 0.85, fbm(x / 2000, z / 2000, 3)) * 0.7);
      c.lerp(sand, 1 - smooth(2, 14, h));
      c.lerp(rock.clone().lerp(rock2, m2), smooth(0.18, 0.4, slope) * smooth(30, 120, h));
      c.lerp(rock, smooth(500, 800, h) * 0.8);
      c.lerp(snow, smooth(950, 1150, h + m * 120) * (1 - smooth(0.35, 0.6, slope)));
      c.lerp(urban, cityF(x, z) * 0.8);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const detail = canvasTex(512, 512, (g, w, h) => noiseFill(g, w, h, [200, 200, 200], 90, 1.2), 1);
    const nmap = normalFromHeight(256, 6, 10);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, normalMap: nmap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.95, metalness: 0 });
    // double échelle de détail : texture fine proche + macro variation (évite le carrelage)
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <map_fragment>', `
          vec4 d1 = texture2D(map, vWPos.xz/18.0);
          vec4 d2 = texture2D(map, vWPos.xz/210.0);
          vec4 d3 = texture2D(map, vWPos.xz/1900.0);
          float dist = length(vWPos - cameraPosition);
          float fine = mix(d1.r, 0.78, smoothstep(150.0, 900.0, dist));
          diffuseColor.rgb *= (fine*0.55 + d2.r*0.45) * (0.75 + d3.r*0.5) * 1.35;`)
        .replace('#include <normal_fragment_maps>', `
          vec3 mapN = texture2D(normalMap, vWPos.xz/9.0).xyz*2.0-1.0;
          mapN.xy *= normalScale * (1.0 - smoothstep(60.0, 500.0, length(vWPos - cameraPosition)));
          normal = normalize(tbnT * mapN);`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nmat3 tbnT = mat3(vec3(1.,0.,0.), vec3(0.,0.,-1.), normal);');
    };
    this.terrain = new THREE.Mesh(geo, mat); this.terrain.receiveShadow = true; this.scene.add(this.terrain);
  }
  buildWater() {
    const wn = normalFromHeight(256, 3, 6);
    const water = new Water(new THREE.PlaneGeometry(120000, 120000), { textureWidth: 512, textureHeight: 512, waterNormals: wn, sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xffffff, waterColor: 0x0b3a4d, distortionScale: 2.2, fog: true });
    water.rotation.x = -Math.PI / 2; water.position.y = 0.5; water.material.uniforms.size.value = 6; this.scene.add(water); this.water = water;
  }

  buildAirport(ap, idx) {
    const g = new THREE.Group(); g.position.set(ap.x, 0, ap.z); this.scene.add(g); const y = ap.h + 0.3, main = idx === 0;
    const L = RWY.len, W = RWY.wid;
    const flat = (w, l, mat, x, z, dy = 0, rot = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat); m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, y + dy, z); m.receiveShadow = true; g.add(m); return m; };
    // --- piste
    const rtex = canvasTex(256, 4096, (c, w, h) => {
      noiseFill(c, w, h, [56, 58, 62], 24, 0.6);
      for (let i = 0; i < 140; i++) { c.fillStyle = `rgba(15,15,15,${Math.random() * 0.3})`; const e = Math.random() < 0.5 ? Math.random() * 500 : h - Math.random() * 500; c.fillRect(w * 0.38 + Math.random() * w * 0.24, e, 3 + Math.random() * 5, 40 + Math.random() * 160); }
      c.fillStyle = '#ecece4'; c.fillRect(6, 0, 4, h); c.fillRect(w - 10, 0, 4, h);
      for (let yy = 300; yy < h - 300; yy += 64) c.fillRect(w / 2 - 2, yy, 4, 34);
      for (const end of [0, 1]) {
        const Y = (v) => (end ? h - v : v);
        for (let k = 0; k < 12; k++) { const x = 18 + k * 9 + (k >= 6 ? 30 : 0); c.fillRect(x, Math.min(Y(16), Y(80)), 5, 64); }
        c.save(); c.translate(w / 2, Y(125)); if (!end) c.rotate(Math.PI); c.font = 'bold 46px Arial'; c.textAlign = 'center'; c.fillText(end ? '36' : '18', 0, 0); c.restore();
        for (const d of [200, 290, 380, 470]) for (const x of [50, 62, w - 67, w - 55]) c.fillRect(x, Math.min(Y(d), Y(d + 26)), 5, 26);
        c.fillRect(60, Math.min(Y(300), Y(350)), 22, 50); c.fillRect(w - 82, Math.min(Y(300), Y(350)), 22, 50);
      }
    });
    rtex.wrapT = THREE.ClampToEdgeWrapping;
    const asphaltN = normalFromHeight(128, 4, 2); asphaltN.repeat.set(4, 60);
    flat(W + 16, L + 120, new THREE.MeshStandardMaterial({ color: 0x4a4c50, roughness: 0.95 }), 0, 0, -0.06); // accotements
    flat(W, L, new THREE.MeshStandardMaterial({ map: rtex, roughness: 0.85, normalMap: asphaltN, normalScale: new THREE.Vector2(0.4, 0.4) }), 0, 0, 0.02);
    // --- taxiways
    const twTex = canvasTex(128, 128, (c, w, h) => { noiseFill(c, w, h, [70, 70, 68], 20); c.fillStyle = '#e8c33a'; c.fillRect(w / 2 - 2, 0, 4, h); c.fillRect(6, 0, 2, h); c.fillRect(w - 8, 0, 2, h); });
    const twMat = new THREE.MeshStandardMaterial({ map: twTex, roughness: 0.9 }); twTex.repeat.set(1, 70);
    flat(32, L - 100, twMat, 190, 0, -0.01);
    const exits = [-L / 2 + 30, -900, 0, 900, L / 2 - 30];
    for (const z of exits) { const t = twTex.clone(); t.repeat.set(1, 4); t.needsUpdate = true; flat(180, 28, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), 100, z, -0.015).material.map.rotation = Math.PI / 2; }
    // bretelles rapides inclinées
    for (const z of [-1300, 450]) { const m = flat(26, 200, twMat.clone(), 105, z, -0.012, 0.6); m.material.map = twTex.clone(); m.material.map.repeat.set(1, 6); m.material.map.needsUpdate = true; }
    // marquages de point d'attente
    const holdTex = canvasTex(64, 32, (c, w, h) => { c.fillStyle = '#e8c33a'; for (const x of [4, 12]) c.fillRect(0, x, w, 3); for (let i = 0; i < w; i += 8) { c.fillRect(i, 20, 5, 3); c.fillRect(i, 26, 5, 3); } });
    for (const z of exits) { const m = flat(28, 12, new THREE.MeshBasicMaterial({ map: holdTex, transparent: true }), 60, z, 0.01); m.rotation.z = Math.PI / 2; }
    // --- tarmac (béton)
    const apTex = canvasTex(256, 256, (c, w, h) => { noiseFill(c, w, h, [150, 150, 146], 16); c.strokeStyle = 'rgba(50,50,50,.45)'; c.lineWidth = 1.5; for (let i = 0; i <= w; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } });
    apTex.repeat.set(16, 110);
    const apW = main ? 560 : 360, apX = 206 + apW / 2, apL = main ? 3500 : 2000;
    flat(apW, apL, new THREE.MeshStandardMaterial({ map: apTex, roughness: 0.9 }), apX, 0, -0.03);
    // lignes de guidage jaunes vers les postes
    const guide = new THREE.MeshBasicMaterial({ color: 0xe8c33a });
    // --- terminal
    const TX = 206 + apW + 60, TL = main ? 1100 : 500;
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1d4058, metalness: 0.95, roughness: 0.06, emissive: 0xffd9a0, emissiveIntensity: 0 }); glassMat.userData.base = 0.8; this.nightMats.push(glassMat);
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeef0f2, roughness: 0.35, metalness: 0.25 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.3, metalness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.7 });
    const box = (w, h, d, mat, x, yy, z, parent = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + yy, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
    box(70, 16, TL, glassMat, TX, 8, 0);
    box(74, 2, TL + 6, whiteMat, TX, 0.9, 0);
    for (let z = -TL / 2; z <= TL / 2; z += 25) box(1.2, 16, 1.2, whiteMat, TX - 35.5, 8, z); // meneaux
    // toit ondulé
    const roofG = new THREE.CylinderGeometry(60, 60, TL + 30, 32, 1, false, -0.75, 1.5); roofG.rotateX(-Math.PI / 2); roofG.scale(1, 0.18, 1);
    const roof = new THREE.Mesh(roofG, steelMat); roof.position.set(TX, y + 16 - 60 * 0.18 * Math.cos(0.75), 0); roof.castShadow = true; g.add(roof);
    // jetées + passerelles + avions en stationnement
    const piers = main ? [-1050, -380, 380, 1050].filter((z) => Math.abs(z) < TL / 2 + 100).slice(0, 4) : [0];
    const pierLen = apW - 140, gates = [];
    for (const pz of piers) {
      const px = TX - 35 - pierLen / 2;
      box(pierLen, 9, 26, glassMat, px, 7.5, pz); box(pierLen + 2, 1.2, 28, whiteMat, px, 12.5, pz);
      for (let x = TX - 35 - 40; x > TX - 35 - pierLen + 20; x -= 68) for (const s of [-1, 1]) gates.push([x, pz + s * 13, s]);
    }
    const bridgeG = new THREE.BoxGeometry(3.4, 3.2, 22); bridgeG.translate(0, 0, 11);
    const bridges = new THREE.InstancedMesh(bridgeG, steelMat, gates.length); const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(1, 1, 1);
    gates.forEach(([x, z, s], i) => { Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s > 0 ? -0.35 : Math.PI + 0.35); M.compose(V.set(x, y + 5.5, z), Q, Sc); bridges.setMatrixAt(i, M); });
    bridges.castShadow = true; g.add(bridges);
    // avions de ligne stationnés (géométrie fusionnée instanciée)
    const liner = this.linerGeo || (this.linerGeo = makeLiner());
    const tails = [0xd02a2a, 0x1f6fd1, 0x0f9d58, 0xf2a900];
    const parked = gates.filter(() => Math.random() < 0.8);
    tails.forEach((tc, k) => {
      const list = parked.filter((_, i) => i % 4 === k); if (!list.length) return;
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3 });
      mat.onBeforeCompile = (sh) => { sh.uniforms.tailC = { value: new THREE.Color(tc) }; sh.fragmentShader = 'uniform vec3 tailC;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (vColor.b > 0.9 && vColor.r < 0.1) diffuseColor.rgb = tailC;'); };
      const im = new THREE.InstancedMesh(liner, mat, list.length);
      list.forEach(([x, z, s], i) => { Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s > 0 ? Math.PI : 0); M.compose(V.set(x - 6, y + 0, z + s * 32), Q, Sc); im.setMatrixAt(i, M); });
      im.castShadow = im.receiveShadow = true; g.add(im);
    });
    // lignes d'entrée de poste
    for (const [x, z, s] of gates) { const m = flat(0.5, 60, guide, x - 6, z + s * 38, 0.005); }
    // --- véhicules de piste
    const vGeo = new THREE.BoxGeometry(2.6, 2.2, 5.5); vGeo.translate(0, 1.1, 0);
    const vehicles = new THREE.InstancedMesh(vGeo, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.3 }), gates.length * 3 + 30); const vc = [0xffcc00, 0xffffff, 0xff7a00, 0x2a6fdb]; let vi = 0;
    for (const [x, z, s] of gates) for (let k = 0; k < 3; k++) { Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 3); M.compose(V.set(x - 6 + (Math.random() - 0.5) * 40, y, z + s * (20 + Math.random() * 30)), Q, Sc); vehicles.setMatrixAt(vi, M); vehicles.setColorAt(vi++, new THREE.Color(vc[(vi + k) % 4])); }
    for (let k = 0; k < 30; k++) { Q.identity(); M.compose(V.set(apX + apW / 2 - 20 - (k % 3) * 8, y, -apL / 2 + 60 + Math.floor(k / 3) * 9), Q, Sc); vehicles.setMatrixAt(vi, M); vehicles.setColorAt(vi++, new THREE.Color(vc[k % 4])); }
    vehicles.count = vi; vehicles.castShadow = true; g.add(vehicles);
    // --- hangars de maintenance
    const hangMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
    hangMat.map = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#8b949c'; c.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 6) { c.fillStyle = i % 12 ? '#7f8890' : '#9aa3ab'; c.fillRect(i, 0, 3, h); } });
    const nH = main ? 4 : 2;
    for (let i = 0; i < nH; i++) {
      const hg = new THREE.Group(); const HL = 80, R = 30;
      hg.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, HL, 32, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), hangMat));
      const back = new THREE.Mesh(new THREE.CircleGeometry(R, 32, 0, Math.PI), darkMat); back.rotation.y = Math.PI / 2; back.position.x = HL / 2; hg.add(back);
      const door = new THREE.Mesh(new THREE.CircleGeometry(R, 32, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.8, side: THREE.DoubleSide })); door.rotation.y = -Math.PI / 2; door.position.x = -HL / 2 + 0.5; hg.add(door);
      hg.children.forEach((m) => { m.castShadow = m.receiveShadow = true; });
      hg.position.set(apX + apW / 2 - HL / 2 - 10, y, -apL / 2 + 80 + i * 75); g.add(hg);
    }
    // --- terminal fret
    if (main) { box(120, 18, 260, new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.6, map: hangMat.map }), apX + apW / 2 - 60, 9, apL / 2 - 220); for (let i = 0; i < 18; i++) box(2.4, 2.6, 12, new THREE.MeshStandardMaterial({ color: [0xb83a2c, 0x2c6db8, 0x3a8a3a, 0xd9a400][i % 4], roughness: 0.6 }), apX - 40 + (i % 6) * 6, 1.3, apL / 2 - 330 + Math.floor(i / 6) * 16); }
    // --- tour de contrôle moderne
    const concrete = new THREE.MeshStandardMaterial({ color: 0xdcd8d0, roughness: 0.8 });
    const tower = new THREE.Group(); const TH = main ? 72 : 40;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 7, TH, 24), concrete); shaft.position.y = TH / 2; tower.add(shaft);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(11, 6, 5, 12), concrete); ring.position.y = TH + 1; tower.add(ring);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(12, 10, 8, 12), new THREE.MeshStandardMaterial({ color: 0x1b3a4a, metalness: 0.9, roughness: 0.05, emissive: 0x3aa0ff, emissiveIntensity: 0 })); cab.position.y = TH + 7.5; tower.add(cab); cab.material.userData.base = 1.2; this.nightMats.push(cab.material);
    const troof = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 1.4, 12), concrete); troof.position.y = TH + 12.2; tower.add(troof);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 14), new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 2 })); ant.position.y = TH + 20; tower.add(ant);
    const base = new THREE.Mesh(new THREE.BoxGeometry(40, 10, 40), whiteMat); base.position.y = 5; tower.add(base);
    tower.traverse((m) => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
    const twX = TX - 10, twZ = TL / 2 + 120; tower.position.set(twX, y, twZ); g.add(tower); this.towers.push(new THREE.Vector3(ap.x + twX, y + TH + 9, ap.z + twZ));
    // --- radar tournant
    const radar = new THREE.Group(); radar.add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 18, 8), steelMat)); radar.children[0].position.y = 9;
    const dish = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 0.6), whiteMat); dish.position.y = 19; radar.add(dish); radar.position.set(TX + 30, y, -TL / 2 - 160); g.add(radar); (this.spinners ||= []).push(dish);
    // --- dépôt carburant
    const tankG = new THREE.CylinderGeometry(9, 9, 12, 24); tankG.translate(0, 6, 0);
    const tanks = new THREE.InstancedMesh(tankG, new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: 0.4, metalness: 0.5 }), 6);
    for (let i = 0; i < 6; i++) { M.makeTranslation(TX + 90 + (i % 3) * 24, y, TL / 2 + 40 + Math.floor(i / 3) * 24); tanks.setMatrixAt(i, M); } tanks.castShadow = true; g.add(tanks);
    // --- parking + route d'accès
    const roadTex = canvasTex(64, 128, (c, w, h) => { noiseFill(c, w, h, [52, 52, 54], 16); c.fillStyle = '#ddd'; for (let i = 0; i < h; i += 32) c.fillRect(w / 2 - 1, i, 2, 16); }); roadTex.repeat.set(1, 40);
    flat(18, TL + 300, new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 }), TX + 50, 0, -0.02);
    const pkTex = canvasTex(128, 128, (c, w, h) => { noiseFill(c, w, h, [64, 64, 66], 14); c.fillStyle = '#ddd'; for (let i = 0; i < h; i += 10) { c.fillRect(0, i, 22, 1); c.fillRect(w - 22, i, 22, 1); c.fillRect(44, i, 40, 1); } }); pkTex.repeat.set(1, 6);
    const pkL = Math.min(TL - 100, 600); flat(110, pkL, new THREE.MeshStandardMaterial({ map: pkTex, roughness: 0.9 }), TX + 120, 0, -0.025);
    const carG = new THREE.BoxGeometry(4.2, 1.4, 1.9); carG.translate(0, 0.7, 0); const nC = Math.floor(pkL / 4);
    const cars = new THREE.InstancedMesh(carG, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6 }), nC); let ci = 0;
    for (let i = 0; i < nC; i++) { if (Math.random() < 0.25) continue; const col = [TX + 72, TX + 98, TX + 142, TX + 168][i % 4]; M.makeTranslation(col, y, -pkL / 2 + 8 + Math.floor(i / 4) * 16 * 0.62); cars.setMatrixAt(ci, M); cars.setColorAt(ci++, new THREE.Color().setHSL(Math.random(), Math.random() * 0.6, 0.25 + Math.random() * 0.5)); }
    cars.count = ci; g.add(cars);
    // --- clôture périmétrique
    const postG = new THREE.BoxGeometry(0.2, 2.5, 0.2); postG.translate(0, 1.25, 0); const fence = []; const fx0 = -140, fx1 = TX + 200, fz = L / 2 + 250;
    for (let z = -fz; z <= fz; z += 25) fence.push([fx0, z], [fx1, z]); for (let x = fx0; x <= fx1; x += 25) fence.push([x, -fz], [x, fz]);
    const posts = new THREE.InstancedMesh(postG, darkMat, fence.length); fence.forEach(([x, z], i) => { M.makeTranslation(x, y - 0.3, z); posts.setMatrixAt(i, M); }); g.add(posts);
    // --- balisage
    const lightGeo = new THREE.SphereGeometry(0.45, 8, 6); const pts = [], cols = [];
    const addL = (x, z, c) => { pts.push([x, z]); cols.push(new THREE.Color(c)); };
    for (let z = -L / 2; z <= L / 2; z += 60) { addL(-W / 2 - 2, z, 0xfff2cc); addL(W / 2 + 2, z, 0xfff2cc); }
    for (let z = -L / 2 + 30; z <= L / 2 - 30; z += 30) addL(0.8, z, Math.abs(z) > L / 2 - 900 ? 0xff5555 : 0xffffff);
    for (let x = -W / 2; x <= W / 2; x += 4) { addL(x, L / 2 + 3, 0x33ff66); addL(x, -L / 2 - 3, 0xff3344); }
    for (const sgn of [1, -1]) for (let d = 60; d < 900; d += 30) { for (let x = -6; x <= 6; x += 3) addL(x, sgn * (L / 2 + d), 0xffffff); if (d % 150 === 0) for (let x = -16; x <= 16; x += 2.5) addL(x, sgn * (L / 2 + d), 0xffffff); }
    for (let z = -L / 2 + 50; z <= L / 2 - 50; z += 30) { addL(173, z, 0x3399ff); addL(207, z, 0x3399ff); }
    for (const z of exits) for (let x = 30; x < 180; x += 15) addL(x, z, 0x33ff66);
    const lm = new THREE.InstancedMesh(lightGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), pts.length);
    pts.forEach(([x, z], i) => { M.makeTranslation(x, y + 0.35, z); lm.setMatrixAt(i, M); lm.setColorAt(i, cols[i].multiplyScalar(3)); }); g.add(lm);
    // panneaux de taxiway
    const signTex = (txt) => canvasTex(128, 48, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); c.fillStyle = '#f5d000'; c.fillRect(64, 0, 64, h); c.font = 'bold 30px Arial'; c.textAlign = 'center'; c.fillStyle = '#f5d000'; c.fillText(txt, 32, 35); c.fillStyle = '#111'; c.fillText('18-36', 96, 35); });
    exits.forEach((z, i) => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 4.4), [darkMat, darkMat, darkMat, darkMat, new THREE.MeshBasicMaterial({ map: signTex('ABCDE'[i]) }), new THREE.MeshBasicMaterial({ map: signTex('ABCDE'[i]) })]); s.rotation.y = Math.PI / 2; s.position.set(45, y + 1, z + 22); g.add(s); });
    // PAPI
    if (main) { this.papi = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); m.position.set(-W / 2 - 14 - i * 9, y + 0.7, L / 2 - 320); g.add(m); this.papi.push(m); } }
    // manches à air
    for (const zz of [L / 2 - 300, -L / 2 + 300]) { const sock = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xff6a00, side: THREE.DoubleSide })); sock.rotation.z = Math.PI / 2; sock.position.set(-70, y + 8, zz); g.add(sock); const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8), concrete); mast.position.set(-67, y + 4, zz); g.add(mast); }
  }
  updatePapi(px, py, pz) {
    // pente 3° vers le point d'aiming (z = len/2-320)
    const dz = pz - (RWY.len / 2 - 320); if (dz <= 0) return;
    const ang = THREE.MathUtils.radToDeg(Math.atan2(py - AIRPORT_H, dz));
    const th = [3.5, 3.17, 2.83, 2.5];
    this.papi.forEach((m, i) => m.material.color.set(ang > th[i] ? 0xffffff : 0xff2020).multiplyScalar(3));
  }

  buildCity() {
    const wTex = canvasTex(128, 256, (c, w, h) => {
      c.fillStyle = '#2b3036'; c.fillRect(0, 0, w, h);
      for (let y = 4; y < h; y += 12) for (let x = 4; x < w; x += 10) { const lit = Math.random() < 0.35; c.fillStyle = lit ? `hsl(${40 + Math.random() * 15},90%,${60 + Math.random() * 25}%)` : `rgb(${40 + Math.random() * 30},${60 + Math.random() * 30},${80 + Math.random() * 30})`; c.fillRect(x, y, 6, 8); }
    });
    const eTex = wTex.clone();
    const facade = new THREE.MeshStandardMaterial({ map: wTex, emissiveMap: eTex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.35, metalness: 0.5 });
    facade.userData.base = 1.4; this.nightMats.push(facade);
    const roof = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.9 });
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const uv = geo.attributes.uv; // UV repère pour la répétition
    const mats = [facade, facade, roof, roof, facade, facade];
    const items = []; const step = 70;
    for (const CITY of CITIES) for (let x = CITY.x - CITY.r; x < CITY.x + CITY.r; x += step) for (let z = CITY.z - CITY.r; z < CITY.z + CITY.r; z += step) {
      const d = Math.hypot(x - CITY.x, z - CITY.z) / CITY.r; if (d > 0.95 || Math.random() < 0.12) continue; const big = CITY.r / 1200;
      for (let k = 0; k < 2; k++) {
        const w = 18 + Math.random() * 22, dd = 18 + Math.random() * 22;
        const hgt = (8 + Math.random() * 25) * (1 + (1 - d) ** 3 * 9 * big * Math.random());
        const bx = x + (k ? 26 : -8) + Math.random() * 6, bz = z + (Math.random() - 0.5) * 14;
        items.push([bx, this.height(bx, bz) - 1, bz, w, hgt, dd]);
      }
    }
    // une instance par matériau groupé : on construit via InstancedMesh multi-matériau
    const im = new THREE.InstancedMesh(geo, mats, items.length); const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    items.forEach((b, i) => { p.set(b[0], b[1], b[2]); s.set(b[3], b[4], b[5]); M.compose(p, q, s); im.setMatrixAt(i, M); });
    // répétition des fenêtres proportionnelle à la taille : via shader (world-space UV)
    facade.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vec2 rep = abs(normal.x) > 0.5 ? vec2(sc.z, sc.y) : vec2(sc.x, sc.y);
        vMapUv = uv * rep / vec2(12.0, 24.0); vEmissiveMapUv = vMapUv;`);
    };
    im.castShadow = true; im.receiveShadow = true; this.scene.add(im); this.city = im;
    // lampadaires / halo urbain
    for (const C of CITIES) { const glow = new THREE.PointLight(0xffc27a, 6e5 * C.r / 1200, 4000, 1.5); glow.position.set(C.x, 300, C.z); this.scene.add(glow); this.lights.push(glow); }
  }

  buildTrees() {
    const count = this.q === 'perf' ? 9000 : 26000;
    const cone = new THREE.ConeGeometry(3.2, 9, 7); cone.translate(0, 8.5, 0);
    const cone2 = new THREE.ConeGeometry(2.4, 6, 7); cone2.translate(0, 12.5, 0);
    const trunk = new THREE.CylinderGeometry(0.35, 0.5, 5, 5); trunk.translate(0, 2.5, 0);
    const pine = mergeGeometries([cone.toNonIndexed(), cone2.toNonIndexed()]);
    const leaf = new THREE.IcosahedronGeometry(4.2, 1); leaf.scale(1, 0.85, 1); leaf.translate(0, 8, 0);
    const pos = leaf.attributes.position; for (let i = 0; i < pos.count; i++) { const f = 1 + (Math.random() - 0.5) * 0.3; pos.setXYZ(i, pos.getX(i) * f, pos.getY(i), pos.getZ(i) * f); } leaf.computeVertexNormals();
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const pines = new THREE.InstancedMesh(pine, leafMat, count), broad = new THREE.InstancedMesh(leaf, leafMat, count), trunks = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 }), count * 2);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    let np = 0, nb = 0, nt = 0, tries = 0;
    while ((np < count || nb < count) && tries++ < count * 14) {
      const x = (Math.random() - 0.5) * SIZE * 0.8, z = (Math.random() - 0.5) * SIZE * 0.8, h = this.height(x, z);
      if (h < 6 || h > 900 || this.onPaved(x, z) || AIRPORTS.some((a) => Math.abs(x - a.x - 560) < 1200 && Math.abs(z - a.z) < 2800) || cityF(x, z) > 0.05 || this.nearRoad(x, z)) continue;
      if (fbm(x / 900 + 50, z / 900, 3) < 0.48) continue;
      const slope = Math.abs(this.height(x + 8, z) - h) + Math.abs(this.height(x, z + 8) - h); if (slope > 7) continue;
      const sc = 0.7 + Math.random() * 0.9; q.setFromAxisAngle(up, Math.random() * 6.28); s.set(sc, sc * (0.8 + Math.random() * 0.5), sc); p.set(x, h - 0.3, z); M.compose(p, q, s);
      const isPine = h > 250 || Math.random() < 0.4;
      if (isPine && np < count) { pines.setMatrixAt(np, M); pines.setColorAt(np++, c.setHSL(0.3 + Math.random() * 0.05, 0.45, 0.16 + Math.random() * 0.08)); }
      else if (!isPine && nb < count) { broad.setMatrixAt(nb, M); broad.setColorAt(nb++, c.setHSL(0.2 + Math.random() * 0.1, 0.5, 0.2 + Math.random() * 0.1)); }
      else continue;
      if (nt < count * 2) trunks.setMatrixAt(nt++, M);
    }
    pines.count = np; broad.count = nb; trunks.count = nt;
    for (const m of [pines, broad, trunks]) { m.castShadow = this.q !== 'perf'; m.receiveShadow = true; this.scene.add(m); }
  }

  buildClouds() {
    const tex = canvasTex(128, 128, (c, w) => {
      for (let i = 0; i < 26; i++) { const x = w / 2 + (Math.random() - 0.5) * w * 0.5, y = w / 2 + (Math.random() - 0.5) * w * 0.3, r = w * (0.12 + Math.random() * 0.18); const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, w); }
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    this.cloudMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, opacity: 0.9 });
    const grp = new THREE.Group(); const n = this.q === 'perf' ? 60 : 130;
    for (let i = 0; i < n; i++) {
      const cx = (Math.random() - 0.5) * 26000, cz = (Math.random() - 0.5) * 26000, cy = 1100 + Math.random() * 700;
      const puffs = 6 + Math.random() * 8;
      for (let k = 0; k < puffs; k++) { const s = new THREE.Sprite(this.cloudMat); const sz = 250 + Math.random() * 350; s.scale.set(sz, sz * 0.6, 1); s.position.set(cx + (Math.random() - 0.5) * 600, cy + (Math.random() - 0.5) * 120, cz + (Math.random() - 0.5) * 400); grp.add(s); }
    }
    this.scene.add(grp); this.clouds = grp;
  }


  // ------------------------------------------------ routes (rubans qui épousent le relief)
  nearRoad(x, z) { if (!this.roadPts) return false; for (const p of this.roadPts) if (Math.abs(p.x - x) < 30 && Math.abs(p.z - z) < 30) return true; return false; }
  buildRoads() {
    const nodes = [...AIRPORTS.map((a) => new THREE.Vector3(a.x + 1300, 0, a.z)), ...CITIES.map((c) => new THREE.Vector3(c.x, 0, c.z))];
    const links = [[0, 3], [3, 6], [0, 7], [1, 4], [4, 7], [2, 5], [5, 3], [7, 4], [0, 5]];
    const tex = canvasTex(64, 256, (c, w, h) => { noiseFill(c, w, h, [66, 66, 68], 20); c.fillStyle = '#ddd'; c.fillRect(3, 0, 2, h); c.fillRect(w - 5, 0, 2, h); c.fillStyle = '#e8c33a'; for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 1, y, 2, 36); });
    tex.repeat.set(1, 1);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
    this.roads = []; this.roadPts = [];
    for (const [a, b] of links) {
      const A = nodes[a], B = nodes[b]; const n = Math.ceil(A.distanceTo(B) / 60); const pts = [];
      const perp = new THREE.Vector3(-(B.z - A.z), 0, B.x - A.x).normalize();
      for (let i = 0; i <= n; i++) { const t = i / n; const p = A.clone().lerp(B, t).addScaledVector(perp, Math.sin(t * Math.PI * 2) * 500 * Math.sin(t * Math.PI)); pts.push(p); }
      if (pts.some((p) => this.height(p.x, p.z) < 2)) continue; // pas de route dans l'eau
      this.roads.push(pts); this.roadPts.push(...pts);
      const pos = [], uv = [], idx = []; let v = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
        const dir = q.clone().sub(o).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(6);
        for (const s of [-1, 1]) { const x = p.x + side.x * s, z = p.z + side.z * s; pos.push(x, this.height(x, z) + 0.6, z); uv.push(s < 0 ? 0 : 1, v); }
        v += 60 / 40;
        if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; this.scene.add(m);
    }
  }
  // ------------------------------------------------ éoliennes
  buildTurbines() {
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.4, metalness: 0.2 });
    const red = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false });
    this.rotors = [];
    const farms = [[-6000, 15000], [18000, 4000], [-19000, -4000]];
    for (const [fx, fz] of farms) for (let i = 0; i < 9; i++) {
      const x = fx + (i % 3) * 320 + Math.random() * 60, z = fz + Math.floor(i / 3) * 360 + Math.random() * 60, h = this.height(x, z); if (h < 5) continue;
      const t = new THREE.Group(); t.position.set(x, h, z);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.6, 80, 16), white); mast.position.y = 40; t.add(mast);
      const nac = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 9), white); nac.position.set(0, 81, 1); t.add(nac);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6), red); lamp.position.set(0, 83.2, 3); t.add(lamp);
      const rotor = new THREE.Group(); rotor.position.set(0, 81, -3.8); t.add(rotor);
      rotor.add(new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 12), white));
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 42, 0.5).translate(0, 22, 0), white); b.rotation.z = (k * Math.PI * 2) / 3; rotor.add(b); }
      rotor.rotation.z = Math.random() * 6; this.rotors.push(rotor);
      t.rotation.y = 0.6; t.traverse((m) => { if (m.isMesh) { m.castShadow = true; } }); this.scene.add(t);
    }
  }
  // ------------------------------------------------ bateaux
  buildBoats() {
    this.boats = [];
    const hullM = new THREE.MeshStandardMaterial({ color: 0x23324a, roughness: 0.5 }), deckM = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.6 }), boxM = [0xc0392b, 0x2e86de, 0xf39c12, 0x27ae60].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
    for (let i = 0; i < 14; i++) {
      const big = i < 5, L = big ? 140 : 25 + Math.random() * 20, b = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(L * 0.16, L * 0.1, L), hullM); b.add(hull);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(L * 0.08, L * 0.18, 4).rotateX(-Math.PI / 2).rotateZ(Math.PI / 4), hullM); bow.scale.set(1, 0.6, 1); bow.position.z = -L * 0.59; b.add(bow);
      const br = new THREE.Mesh(new THREE.BoxGeometry(L * 0.14, L * 0.12, L * 0.12), deckM); br.position.set(0, L * 0.1, L * 0.38); b.add(br);
      if (big) for (let k = 0; k < 14; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(L * 0.13, 6, 12), boxM[k % 4]); c.position.set(0, L * 0.05 + 3 + (k % 2) * 6, -L * 0.35 + Math.floor(k / 2) * 13); b.add(c); }
      b.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      const ang = Math.random() * 6.28, R = 25500 + Math.random() * 3500;
      b.userData = { cx: 0, cz: 0, r: R, a: ang, s: (Math.random() < 0.5 ? 1 : -1) * (big ? 0.000012 : 0.00003) };
      this.scene.add(b); this.boats.push(b);
    }
  }
  makeMap() {
    const N = 384, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const img = g.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / N - 0.5) * SIZE, z = (j / N - 0.5) * SIZE, h = this.height(x, z), k = (j * N + i) * 4;
      let r, gg, b;
      if (h < 1) { r = 14; gg = 60; b = 90; } else if (h > 900) { r = 220; gg = 225; b = 230; } else if (h > 400) { r = 120; gg = 115; b = 100; } else { const t = h / 400; r = 50 + t * 70; gg = 100 + t * 20; b = 40 + t * 40; }
      if (cityF(x, z) > 0.3) { r = gg = b = 125; }
      img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const s = N / SIZE; g.fillStyle = '#eee'; g.fillStyle = '#9a9a9a'; for (const a of AIRPORTS) g.fillRect(N / 2 + (a.x + 170) * s, N / 2 + (a.z - 1800) * s, 650 * s, 3600 * s); g.fillStyle = '#eee'; for (const a of AIRPORTS) g.fillRect(N / 2 + a.x * s - 1.5, N / 2 + (a.z - RWY.len / 2) * s, 3, RWY.len * s);
    g.strokeStyle = 'rgba(230,200,120,.8)'; g.lineWidth = 1; for (const r of this.roads || []) { g.beginPath(); r.forEach((p, i) => (i ? g.lineTo(N / 2 + p.x * s, N / 2 + p.z * s) : g.moveTo(N / 2 + p.x * s, N / 2 + p.z * s))); g.stroke(); }

    return c;
  }
  update(t, focus) {
    if (this.spinners) for (const s of this.spinners) s.parent.rotation.y = t * 1.6;
    if (this.water) this.water.material.uniforms.time.value = t * 0.6;
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 1500); this.sun.target.position.copy(focus);
    if (this.rotors) for (const r of this.rotors) r.rotation.z += 0.02;
    if (this.boats) for (const b of this.boats) { b.userData.a += b.userData.s; b.position.set(b.userData.cx + Math.cos(b.userData.a) * b.userData.r, 0.6 + Math.sin(t * 1.3 + b.userData.a * 9) * 0.25, b.userData.cz + Math.sin(b.userData.a) * b.userData.r); b.rotation.y = -b.userData.a + (b.userData.s > 0 ? Math.PI : 0); b.rotation.z = Math.sin(t + b.userData.a * 5) * 0.03; }
  }
}
