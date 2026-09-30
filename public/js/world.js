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
export const RWY = { x: 0, z: 0, len: 3200, wid: 50 }; // piste 36/18 orientée Nord (-Z)
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
    const ax = Math.abs(x - a.x - 150) - 520, az = Math.abs(z - a.z) - 2100;
    const ad = Math.max(ax, az, 0) + Math.min(Math.max(ax, az), 0);
    const af = smooth(0, 1100, ad);
    h = a.h * (1 - af) + Math.max(h, af > 0.99 ? h : 6) * af;
    // couloirs d'approche dégagés (pente 2°) aux deux extrémités de la piste
    const dzA = Math.abs(z - a.z) - 1600;
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
  onPaved(x, z) { return this.onRunway(x, z) || AIRPORTS.some((a) => x - a.x > 80 && x - a.x < 520 && Math.abs(z - a.z) < 1650); }

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
    const g = new THREE.Group(); g.position.set(ap.x, 0, ap.z); this.scene.add(g); const y = ap.h + 0.08;
    // --- texture piste détaillée
    const rtex = canvasTex(256, 4096, (c, w, h) => {
      noiseFill(c, w, h, [58, 60, 64], 26, 0.6);
      for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(20,20,20,${Math.random() * 0.25})`; c.fillRect(w * 0.35 + Math.random() * w * 0.3, Math.random() * h, 3 + Math.random() * 6, 30 + Math.random() * 120); } // traces de pneus
      c.fillStyle = '#e9e9e2';
      c.fillRect(8, 0, 4, h); c.fillRect(w - 12, 0, 4, h); // bords
      for (let yy = 260; yy < h - 260; yy += 70) c.fillRect(w / 2 - 2, yy, 4, 38); // axe
      for (const end of [0, 1]) {
        const Y = (v) => (end ? h - v : v);
        for (let k = 0; k < 8; k++) { const x = 24 + k * 12 + (k >= 4 ? 16 : 0); c.fillRect(x, Math.min(Y(20), Y(90)), 7, 70); } // piano
        c.save(); c.translate(w / 2, Y(135)); if (!end) c.rotate(Math.PI); c.font = 'bold 44px Arial'; c.textAlign = 'center'; c.fillText(end ? '36' : '18', 0, 0); c.restore();
        for (const d of [220, 330, 440]) { c.fillRect(60, Math.min(Y(d), Y(d + 30)), 8, 30); c.fillRect(w - 68, Math.min(Y(d), Y(d + 30)), 8, 30); c.fillRect(80, Math.min(Y(d), Y(d + 30)), 8, 30); c.fillRect(w - 88, Math.min(Y(d), Y(d + 30)), 8, 30); }
        c.fillRect(70, Math.min(Y(300), Y(345)), 22, 45); c.fillRect(w - 92, Math.min(Y(300), Y(345)), 22, 45); // aiming point
      }
    });
    rtex.repeat.set(1, 1); rtex.wrapT = THREE.ClampToEdgeWrapping;
    const asphaltN = normalFromHeight(128, 4, 2); asphaltN.repeat.set(4, 60);
    const rwy = new THREE.Mesh(new THREE.PlaneGeometry(RWY.wid + 10, RWY.len), new THREE.MeshStandardMaterial({ map: rtex, roughness: 0.85, normalMap: asphaltN, normalScale: new THREE.Vector2(0.4, 0.4) }));
    rwy.rotation.x = -Math.PI / 2; rwy.position.set(RWY.x, y, RWY.z); rwy.receiveShadow = true; g.add(rwy);
    // taxiway + bretelles + tarmac
    const twTex = canvasTex(128, 128, (c, w, h) => { noiseFill(c, w, h, [72, 72, 70], 22); c.fillStyle = '#e8c33a'; c.fillRect(w / 2 - 2, 0, 4, h); }); twTex.repeat.set(1, 40);
    const tw = new THREE.Mesh(new THREE.PlaneGeometry(24, 3000), new THREE.MeshStandardMaterial({ map: twTex, roughness: 0.9 })); tw.rotation.x = -Math.PI / 2; tw.position.set(160, y - 0.02, 0); tw.receiveShadow = true; g.add(tw);
    for (const z of [-1450, -700, 0, 700, 1450]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(140, 20), tw.material.clone()); b.material.map = twTex.clone(); b.material.map.repeat.set(1, 1); b.material.map.rotation = Math.PI / 2; b.rotation.x = -Math.PI / 2; b.position.set(92, y - 0.03, z); b.receiveShadow = true; g.add(b); }
    const apTex = canvasTex(256, 256, (c, w, h) => { noiseFill(c, w, h, [140, 140, 136], 20); c.strokeStyle = 'rgba(40,40,40,.5)'; c.lineWidth = 2; for (let i = 0; i <= w; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } }); apTex.repeat.set(10, 30);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(320, 1100), new THREE.MeshStandardMaterial({ map: apTex, roughness: 0.9 })); apron.rotation.x = -Math.PI / 2; apron.position.set(340, y - 0.04, 0); apron.receiveShadow = true; g.add(apron);
    // hangars
    const hangMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
    const hTex = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#8b949c'; c.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 6) { c.fillStyle = i % 12 ? '#7f8890' : '#9aa3ab'; c.fillRect(i, 0, 3, h); } }); hangMat.map = hTex;
    for (let i = 0; i < 5; i++) {
      const hg = new THREE.Group(); const L = 70, R = 22;
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 32, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), hangMat); hg.add(shell);
      const back = new THREE.Mesh(new THREE.CircleGeometry(R, 32, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x5f6870, roughness: 0.7, side: THREE.DoubleSide })); back.rotation.y = Math.PI / 2; back.position.x = L / 2; hg.add(back);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.6, R * 0.8), new THREE.MeshStandardMaterial({ color: 0x20262c, roughness: 0.6, side: THREE.DoubleSide })); door.position.set(-L / 2, R * 0.4, 0); door.rotation.y = Math.PI / 2; hg.add(door);
      hg.children.forEach((m) => { m.castShadow = m.receiveShadow = true; });
      hg.position.set(560, y, -420 + i * 180); g.add(hg);
    }
    // tour de contrôle
    const tower = new THREE.Group();
    const concrete = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.8 });
    tower.add(new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 42, 24), concrete)); tower.children[0].position.y = 21;
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(9, 7, 7, 8), new THREE.MeshStandardMaterial({ color: 0x1b3a4a, metalness: 0.9, roughness: 0.05, emissive: 0x3aa0ff, emissiveIntensity: 0 })); cab.position.y = 45.5; tower.add(cab); cab.material.userData.base = 1.2; this.nightMats.push(cab.material);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 1.2, 8), concrete); roof.position.y = 49.6; tower.add(roof);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 2 })); ant.position.y = 55; tower.add(ant);
    const term = new THREE.Mesh(new THREE.BoxGeometry(40, 12, 160), new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.3, metalness: 0.2 })); term.position.set(20, 6, 0); tower.add(term);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(40.4, 6, 158), new THREE.MeshStandardMaterial({ color: 0x163348, roughness: 0.05, metalness: 1, emissive: 0xffd89a, emissiveIntensity: 0 })); glass.position.set(20, 7, 0); glass.material.userData.base = 0.9; this.nightMats.push(glass.material); tower.add(glass);
    tower.traverse((m) => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
    tower.position.set(540, y, 520); g.add(tower); this.towers.push(new THREE.Vector3(ap.x + 540, y + 58, ap.z + 520));
    // balisage : feux de bord, d'axe, rampe d'approche, PAPI
    const lightGeo = new THREE.SphereGeometry(0.45, 8, 6); const pts = []; const cols = [];
    const addL = (x, z, c) => { pts.push([x, z]); cols.push(new THREE.Color(c)); };
    for (let z = -RWY.len / 2; z <= RWY.len / 2; z += 60) { addL(-RWY.wid / 2 - 2, z, 0xfff2cc); addL(RWY.wid / 2 + 2, z, 0xfff2cc); }
    for (let x = -22; x <= 22; x += 4) { addL(x, RWY.len / 2 + 3, 0x33ff66); addL(x, -RWY.len / 2 - 3, 0xff3344); }
    for (let d = 60; d < 900; d += 30) { for (let x = -6; x <= 6; x += 3) addL(x, RWY.len / 2 + d, 0xffffff); if (d % 150 === 0) for (let x = -15; x <= 15; x += 2.5) addL(x, RWY.len / 2 + d, 0xffffff); }
    for (let z = -1500; z <= 1500; z += 30) addL(147, z, 0x3399ff);
    const lm = new THREE.InstancedMesh(lightGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), pts.length);
    const M = new THREE.Matrix4(); pts.forEach(([x, z], i) => { M.makeTranslation(x, y + 0.4, z); lm.setMatrixAt(i, M); lm.setColorAt(i, cols[i].multiplyScalar(3)); });
    g.add(lm);
    // PAPI (4 feux à gauche du point d'aiming)
    if (idx === 0) this.papi = []; if (idx === 0) for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); m.position.set(-RWY.wid / 2 - 14 - i * 9, y + 0.7, RWY.len / 2 - 320); g.add(m); this.papi.push(m); }
    // manche à air
    const sock = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xff6a00, side: THREE.DoubleSide })); sock.rotation.z = Math.PI / 2; sock.position.set(-60, y + 8, 1300); g.add(sock);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8), concrete); mast.position.set(-57, y + 4, 1300); g.add(mast);
    // véhicules / conteneurs sur le tarmac
    const vGeo = new THREE.BoxGeometry(3, 2.4, 6); const vcol = [0xffcc00, 0xffffff, 0xd03030, 0x2a6fdb];
    for (let i = 0; i < 26; i++) { const v = new THREE.Mesh(vGeo, new THREE.MeshStandardMaterial({ color: vcol[i % 4], roughness: 0.5, metalness: 0.3 })); v.position.set(420 + Math.random() * 60, y + 1.2, -450 + Math.random() * 900); v.rotation.y = Math.random() * 3; v.castShadow = true; g.add(v); }
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
      if (h < 6 || h > 900 || this.onPaved(x, z) || AIRPORTS.some((a) => Math.abs(x - a.x - 150) < 800 && Math.abs(z - a.z) < 2400) || cityF(x, z) > 0.05 || this.nearRoad(x, z)) continue;
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
    const nodes = [...AIRPORTS.map((a) => new THREE.Vector3(a.x + 450, 0, a.z)), ...CITIES.map((c) => new THREE.Vector3(c.x, 0, c.z))];
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
    const s = N / SIZE; g.fillStyle = '#eee'; for (const a of AIRPORTS) g.fillRect(N / 2 + a.x * s - 1.5, N / 2 + (a.z - RWY.len / 2) * s, 3, RWY.len * s);
    g.strokeStyle = 'rgba(230,200,120,.8)'; g.lineWidth = 1; for (const r of this.roads || []) { g.beginPath(); r.forEach((p, i) => (i ? g.lineTo(N / 2 + p.x * s, N / 2 + p.z * s) : g.moveTo(N / 2 + p.x * s, N / 2 + p.z * s))); g.stroke(); }
    g.fillStyle = '#fff'; g.font = 'bold 8px system-ui'; for (const c of CITIES) g.fillText(c.name, N / 2 + c.x * s - 14, N / 2 + c.z * s - c.r * s - 2);
    return c;
  }
  update(t, focus) {
    if (this.water) this.water.material.uniforms.time.value = t * 0.6;
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 1500); this.sun.target.position.copy(focus);
    if (this.rotors) for (const r of this.rotors) r.rotation.z += 0.02;
    if (this.boats) for (const b of this.boats) { b.userData.a += b.userData.s; b.position.set(b.userData.cx + Math.cos(b.userData.a) * b.userData.r, 0.6 + Math.sin(t * 1.3 + b.userData.a * 9) * 0.25, b.userData.cz + Math.sin(b.userData.a) * b.userData.r); b.rotation.y = -b.userData.a + (b.userData.s > 0 ? Math.PI : 0); b.rotation.z = Math.sin(t + b.userData.a * 5) * 0.03; }
  }
}
