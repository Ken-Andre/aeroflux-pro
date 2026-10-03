import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World, RWY, AIRPORT_H, SIZE } from './world.js';
import { buildAircraft, animateAircraft, SPECS } from './aircraft.js';
import { Audio } from './audio.js';
import { Dashboard, spark } from './dashboard.js';
import { Progress, ACHIEVEMENTS, xpForLevel } from './progress.js';
import { Missions, MISSIONS } from './missions.js';
import { Garage } from './garage.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
let quality = localStorage.quality || 'high';
const cfg = { name: 'ALPHA-1', type: 'jet', spawn: 'runway', mode: 'solo' };

// ---------------------------------------------------------------- Renderer
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 90000);
let composer = null, world = null;
const audio = new Audio();
const hud = $('#hud'), hx = hud.getContext('2d');

function applyQuality() {
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(quality === 'perf' ? Math.min(dpr, 1) * 0.8 : quality === 'high' ? Math.min(dpr, 1.5) : Math.min(dpr, 2));
  if (world) { const s = quality === 'perf' ? 1024 : quality === 'high' ? 2048 : 4096; world.sun.shadow.mapSize.set(s, s); if (world.sun.shadow.map) { world.sun.shadow.map.dispose(); world.sun.shadow.map = null; } }
  composer = null;
  if (quality === 'ultra') { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.92)); composer.addPass(new OutputPass()); }
  resize();
  document.querySelectorAll('#qTabs button').forEach((b) => b.classList.toggle('on', b.dataset.q === quality));
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); hud.width = innerWidth; hud.height = innerHeight; if (composer) composer.setSize(innerWidth, innerHeight); }
addEventListener('resize', resize);

// ---------------------------------------------------------------- État avion
const S = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), quat: new THREE.Quaternion(), throttle: 0, gear: true, gearAnim: 1, flaps: 0, brake: false,
  inPitch: 0, inRoll: 0, inYaw: 0, onGround: true, crashed: false, g: 1, aoa: 0, score: 0, airborne: false, t0: 0, maxAlt: 0, maxSpd: 0, touch: null, paused: false,
};
let plane = null, spec = null;
const telemetry = { samples: [], phases: {}, track: [] };

function spawn() {
  rotHint = false;
  if (fireLight) { scene.remove(fireLight); fireLight = null; } fireSrc = null;
  $('#crashPanel')?.classList.add('hidden'); for (const d of debris) scene.remove(d.m); debris.length = 0;
  if (plane) scene.remove(plane);
  plane = buildAircraft(cfg.type, cfg.name, progress.p.livery[cfg.type]); spec = SPECS[cfg.type]; scene.add(plane);
  S.airT = 0; S.distAcc = 0; S.lowT = 0; S.xpAcc = 0; S.from = null; missions?.clear();
  S.crashed = false; S.onGround = cfg.spawn === 'runway'; S.airborne = !S.onGround; S.flying = S.airborne; S.touch = null; S.maxAlt = 0; S.maxSpd = 0; S.t0 = performance.now();
  if (cfg.spawn === 'runway') {
    S.pos.set(RWY.x, AIRPORT_H + spec.gearH, RWY.len / 2 - spec.len - 40); S.quat.identity(); S.vel.set(0, 0, 0); S.throttle = 0; S.gear = true; S.gearAnim = 1; S.flaps = cfg.type === 'jet' ? 0 : 0.33; S.brake = true;
  } else {
    const d = 5200, h = AIRPORT_H + Math.tan(THREE.MathUtils.degToRad(3)) * d; const v = spec.stall * 1.35;
    S.pos.set(RWY.x, h, RWY.len / 2 - 320 + d); S.quat.setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(-1), 0, 0, 'YXZ'));
    S.vel.set(0, -v * Math.sin(THREE.MathUtils.degToRad(3)), -v); S.throttle = 0.45; S.gear = true; S.gearAnim = 1; S.flaps = 0.66; S.brake = false;
  }
  telemetry.samples = []; telemetry.phases = {}; telemetry.track = [];
  plane.visible = true; toast('', ''); atc(cfg.spawn === 'runway' ? `${cfg.name}, piste 36, vent calme, autorisé décollage.` : `${cfg.name}, établi ILS 36, autorisé atterrissage.`);
}

// ---------------------------------------------------------------- Entrées
const keys = {}; const settings = { assist: localStorage.assist !== '0', invert: localStorage.invert === '1' };
addEventListener('keydown', (e) => {
  if (document.activeElement === $('#chatIn') || (document.activeElement?.tagName === 'INPUT' && document.activeElement.type === 'text')) { if (e.key === 'Enter' && document.activeElement === $('#chatIn')) sendChat(); if (e.key === 'Escape') $('#chatIn').blur(); return; }
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  keys[e.code] = true;
  const k = e.code;
  if (k === 'KeyG' && spec.fixedGear) toast('TRAIN FIXE', spec.name + ' a un train non rétractable', 1200);
  else if (k === 'KeyG' && !(S.onGround && !S.crashed)) { S.gear = !S.gear; audio.beep(S.gear ? 500 : 700, 0.25, 0.08); }
  else if (k === 'KeyG' && S.onGround) toast('TRAIN VERROUILLÉ', 'au sol', 1200);
  if (k === 'KeyV') { S.flaps = S.flaps >= 0.99 ? 0 : Math.round((S.flaps + 0.34) * 3) / 3; audio.beep(600, 0.1, 0.06); }
  if (k === 'KeyB') S.brake = !S.brake;
  if (k === 'KeyL') { settings.assist = !settings.assist; localStorage.assist = settings.assist ? '1' : '0'; toast('ASSISTANCE ' + (settings.assist ? 'ON' : 'OFF'), settings.assist ? 'ailes à plat auto · anti-décrochage' : 'mode pilote expert', 1600); }
  if (k === 'KeyI') { settings.invert = !settings.invert; localStorage.invert = settings.invert ? '1' : '0'; toast('TANGAGE ' + (settings.invert ? 'INVERSÉ' : 'NORMAL'), settings.invert ? 'W = cabrer' : 'S = cabrer', 1600); }
  if (k === 'KeyC') cycleCam();
  if (k === 'KeyH') $('#widgets').classList.toggle('hidden');
  if (k === 'KeyP') S.paused = !S.paused;
  if (k === 'KeyN') nextTrack();
  if (k === 'KeyT' && cfg.mode === 'lan') { e.preventDefault(); $('#chatIn').classList.remove('hidden'); $('#chatIn').focus(); }
  if ((k === 'Enter' || k === 'Space') && S.crashed) spawn();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
});
addEventListener('keyup', (e) => (keys[e.code] = false));
const K = (...c) => c.some((x) => keys[x]);
let orbit = { yaw: 0, pitch: 0, drag: false, lx: 0, ly: 0, zoom: 1 };
$('#gl').addEventListener('pointerdown', (e) => { orbit.drag = true; orbit.lx = e.clientX; orbit.ly = e.clientY; });
addEventListener('pointerup', () => (orbit.drag = false));
addEventListener('pointermove', (e) => { if (!orbit.drag) return; orbit.yaw -= (e.clientX - orbit.lx) * 0.006; orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + (e.clientY - orbit.ly) * 0.004, -0.6, 1.2); orbit.lx = e.clientX; orbit.ly = e.clientY; });
$('#gl').addEventListener('wheel', (e) => { orbit.zoom = THREE.MathUtils.clamp(orbit.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.4, 4); }, { passive: true });

function readInput(dt) {
  const gp = navigator.getGamepads?.()[0];
  // convention : inPitch > 0 = cabrer (nez en haut). S/↓ = cabrer, W/Z/↑ = piquer (comme un manche)
  let p = (K('ArrowDown', 'KeyS') ? 1 : 0) - (K('ArrowUp', 'KeyW', 'KeyZ') ? 1 : 0);
  if (settings.invert) p = -p;
  let r = (K('ArrowRight', 'KeyD') ? 1 : 0) - (K('ArrowLeft', 'KeyA') ? 1 : 0);
  let y = (K('KeyE') ? 1 : 0) - (K('KeyQ') ? 1 : 0);
  S.brakeHold = K('Space');
  if (gp) { if (Math.abs(gp.axes[1]) > 0.1) p = -gp.axes[1] * (settings.invert ? -1 : 1); if (Math.abs(gp.axes[0]) > 0.1) r = gp.axes[0]; if (Math.abs(gp.axes[2]) > 0.15) y = gp.axes[2]; if (gp.buttons[7]) S.throttle = Math.max(S.throttle, gp.buttons[7].value); if (gp.buttons[6]?.value > 0.2) S.throttle -= dt * 0.8; }
  const sm = (a, b) => a + (b - a) * Math.min(1, dt * 6);
  S.inPitch = sm(S.inPitch, p); S.inRoll = sm(S.inRoll, r); S.inYaw = sm(S.inYaw, y);
  if (K('ShiftLeft', 'ShiftRight', 'KeyR')) S.throttle += dt * 0.5;
  if (K('ControlLeft', 'ControlRight', 'KeyF', 'KeyX')) S.throttle -= dt * 0.5;
  for (let i = 1; i <= 9; i++) if (keys['Digit' + i]) S.throttle = i / 9;
  if (keys.Digit0) S.throttle = 0;
  S.throttle = THREE.MathUtils.clamp(S.throttle, 0, 1);
}

// ---------------------------------------------------------------- Physique
const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
function axes() { _f.set(0, 0, -1).applyQuaternion(S.quat); _u.set(0, 1, 0).applyQuaternion(S.quat); _r.set(1, 0, 0).applyQuaternion(S.quat); }
function rotLocal(ax, ay, az, ang) { _q.setFromAxisAngle(_v.set(ax, ay, az), ang); S.quat.multiply(_q); }

function physics(dt) {
  if (S.crashed) return;
  axes();
  const speed = S.vel.length(), rho = 1.225 * Math.exp(-S.pos.y / 9000), q = 0.5 * rho * speed * speed;
  const inv = S.quat.clone().invert(); const vb = S.vel.clone().applyQuaternion(inv);
  const u = Math.max(-vb.z, 0.1), aoa = speed < 3 ? 0 : Math.atan2(-vb.y, -vb.z), beta = speed < 3 ? 0 : Math.atan2(vb.x, u); S.aoa = aoa;
  const stallA = 0.27 + S.flaps * 0.03;
  let CL = 0.22 + 5.0 * aoa + S.flaps * 0.55; if (aoa > stallA) CL = (0.22 + 5 * stallA + S.flaps * 0.55) * Math.max(0.35, 1 - (aoa - stallA) * 4); if (aoa < -0.3) CL = -0.8;
  const auth = THREE.MathUtils.clamp(speed / (spec.stall * 1.1), 0.05, 1.3);
  // --- rotations (commandes + stabilité)
  if (!S.onGround) {
    const aoaC = THREE.MathUtils.clamp(aoa, -0.6, 0.6), betaC = THREE.MathUtils.clamp(beta, -0.6, 0.6);
    let pin = S.inPitch;
    _e.setFromQuaternion(S.quat, 'YXZ'); const bank = _e.z, pit = _e.x;
    if (settings.assist) {
      if (pin > 0 && aoa > 0.17) pin *= Math.max(0, 1 - (aoa - 0.17) / 0.08); // protection décrochage
      if (pin > 0 && speed < spec.stall * 1.3) pin *= Math.max(0, (speed - spec.stall * 0.9) / (spec.stall * 0.4)); // pas de cabré sans vitesse
      if (pin > 0 && pit > 0.6) pin *= 0.2; if (pin < 0 && pit < -0.6) pin *= 0.2;  // limites d'assiette
    }
    let extra = 0;
    if (settings.assist) {
      const flat = Math.max(0, 1 - Math.abs(bank) / 1.2);
      if (pit > 0.35) extra -= (pit - 0.35) * 3; if (pit < -0.45) extra += (-0.45 - pit) * 3;          // assiette max +20° / -26°
      if (Math.abs(pin) < 0.08) extra -= (pit - 0.03) * 0.7 * flat;
      extra += Math.min(0.5, 1 - Math.cos(bank)) * 0.9;                                                // compensation en virage                                   // tenue d'assiette
      const vmin = spec.stall * 1.2; if (speed < vmin) extra -= (1 - speed / vmin) * 1.6;              // protection basse vitesse
    }
    rotLocal(1, 0, 0, (pin * spec.pitch * auth - aoaC * 1.6 * auth + extra) * dt);
    let rin = S.inRoll;
    if (settings.assist) {
      if (Math.abs(rin) < 0.08) rotLocal(0, 0, 1, -bank * 1.4 * auth * dt); // retour ailes à plat
      if ((bank > 1.15 && rin < 0) || (bank < -1.15 && rin > 0)) rin = 0;   // inclinaison max ~65°
      rotLocal(0, 1, 0, Math.sin(bank) * 0.25 * auth * dt); // virage coordonné
    }
    rotLocal(0, 0, 1, (-rin * spec.roll * auth) * dt);
    rotLocal(0, 1, 0, (-S.inYaw * spec.yaw * auth - betaC * 2.0 * auth) * dt);
    // en décrochage profond : le nez retombe doucement vers la trajectoire (pas de vrille incontrôlable)
    if (Math.abs(aoa) > 0.5 && speed > 5) { const target = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), S.vel.clone().normalize()); S.quat.slerp(target, Math.min(1, dt * 0.8)); }
  }
  // --- forces
  const m = spec.mass, acc = new THREE.Vector3(0, -9.81, 0);
  const lift = (q * spec.S * CL) / m; acc.addScaledVector(_u, lift);
  const cd = spec.cd0 + 0.05 * CL * CL + (S.gearAnim * 0.018) + S.flaps * 0.045;
  if (speed > 0.1) acc.addScaledVector(S.vel, (-q * spec.S * cd) / m / speed);
  acc.addScaledVector(_f, (S.throttle * spec.thrust * (rho / 1.225) ** 0.6) / m);
  acc.addScaledVector(_r, -vb.x * 1.2); // amortissement dérapage
  S.g = lift / 9.81;
  if (S.onGround) {
    // roulage : pas de roulis, cap orienté par le palonnier/direction
    if (S.brake && S.throttle > 0.3 && !S.touch) { S.brake = false; toast('FREINS RELÂCHÉS', 'bonne course !', 1200); }
    _e.setFromQuaternion(S.quat, 'YXZ');
    const fwdSpeed = Math.max(0, S.vel.dot(_f.clone().setY(0).normalize()));
    let yaw = _e.y - (S.inYaw + S.inRoll * 0.6) * dt * THREE.MathUtils.clamp(8 / (fwdSpeed + 4), 0.08, 0.7) * Math.min(1, fwdSpeed / 3);
    let pitch = _e.x;
    if (fwdSpeed > spec.vr * 0.8 && S.inPitch > 0.1) pitch += S.inPitch * spec.pitch * 0.5 * dt; else pitch -= dt * 0.25;
    if (fwdSpeed > spec.vr * 0.9 && S.inPitch < 0.1 && !S.touch && !rotHint) { rotHint = true; toast('ROTATION', 'maintenez S (ou ↓) pour décoller', 2500); }
    pitch = THREE.MathUtils.clamp(pitch, 0, 0.26);
    S.quat.setFromEuler(_e.set(pitch, yaw, 0, 'YXZ')); axes();
    const fh = _f.clone().setY(0).normalize();
    let a = acc.dot(fh) - 9.81 * ((grass ? 0.07 : 0.02) + ((S.brake || S.brakeHold) ? (grass ? 0.3 : 0.45) : 0)) * Math.sign(fwdSpeed);
    let ns = fwdSpeed + a * dt; if (ns < 0) ns = S.throttle > 0.05 ? 0 : 0; if ((S.brake || S.brakeHold) && ns < 0.4 && S.throttle < 0.1) ns = 0;
    S.vel.copy(fh).multiplyScalar(ns);
    const liftUp = acc.y; if (liftUp > 0.3) { S.onGround = false; S.vel.y = liftUp * dt; }
    S.pos.addScaledVector(S.vel, dt);
    const gh = world.height(S.pos.x, S.pos.z);
    if (S.onGround) { S.pos.y = gh + spec.gearH; if (!world.onPaved(S.pos.x, S.pos.z)) { grass = true; } else grass = false; if (gh < 1.5) crash('AMERRISSAGE'); }
    if (!S.onGround) S.flying = false; // simple rebond : le décollage n'est validé qu'au-dessus de 12 m sol
    else if (ns < 3) { S.airborne = false; S.flying = false; } // arrêté : prêt pour un nouveau décollage
    // fin de vol archivée après atterrissage et arrêt complet
    if (S.touch && ns < 2 && !S.touch.archived) { S.touch.archived = true; archive(true); }
    return;
  }
  S.vel.addScaledVector(acc, dt);
  S.pos.addScaledVector(S.vel, dt);
  // --- contact sol : atterrissage OU crash
  const gh = world.height(S.pos.x, S.pos.z); const clear = S.gearAnim > 0.9 ? spec.gearH : spec.gearH * 0.35;
  if (S.pos.y - clear <= gh) touchdown(gh, clear);
  else if (!S.flying && !S.crashed && S.pos.y - gh > 12) { S.flying = true; S.airborne = true; atc(`${cfg.name}, décollage à ${hhmm()}, bon vol.`); toast('DÉCOLLAGE', 'V-rotation ✓', 1500); S.from = missions.nearestAirport(S.pos); S.touch = null; progress.add(50, 'Décollage'); progress.unlock('takeoff'); progress.p.stats.flights++; progress.save(); }
  if (S.pos.y > 30000) S.vel.y = Math.min(S.vel.y, 0);
  // bâtiments (bbox grossière de la ville)
}
let dmg = 0, grass = false, rotHint = false;

function touchdown(gh, clear) {
  _e.setFromQuaternion(S.quat, 'YXZ');
  const fpm = -S.vel.y * 196.85, roll = Math.abs(THREE.MathUtils.radToDeg(_e.z)), pitch = THREE.MathUtils.radToDeg(_e.x), spd = S.vel.length();
  const paved = world.onPaved(S.pos.x, S.pos.z);
  const slope = Math.abs(world.height(S.pos.x + 10, S.pos.z) - gh) + Math.abs(world.height(S.pos.x, S.pos.z + 10) - gh);
  let reason = null;
  if (gh < 1.5) reason = 'AMERRISSAGE FORCÉ';
  else if (S.gearAnim < 0.9) reason = 'TRAIN RENTRÉ !';
  else if (fpm > 1100) reason = `IMPACT ${fpm.toFixed(0)} ft/min`;
  else if (roll > 16) reason = `INCLINAISON ${roll.toFixed(0)}°`;
  else if (pitch < -7) reason = 'NEZ EN PREMIER';
  else if (pitch > 20) reason = 'TAIL STRIKE';
  else if (!paved && slope > 7) reason = 'TERRAIN TROP PENTU';
  else if (spd > spec.vr * 2.1) reason = 'VITESSE EXCESSIVE';
  if (reason) return crash(reason);
  if (!S.flying) { S.onGround = true; S.pos.y = gh + spec.gearH; S.vel.y = 0; S.quat.setFromEuler(_e.set(Math.max(0, _e.x), _e.y, 0, 'YXZ')); return; } // rebond au roulage : pas un atterrissage
  S.flying = false;
  // atterrissage réussi
  const grade = fpm < 180 ? ['BUTTER !', '#34d399', 1000] : fpm < 400 ? ['DOUX', '#38bdf8', 700] : fpm < 700 ? ['CORRECT', '#fbbf24', 400] : ['DUR', '#f97316', 150];
  const center = paved && world.onRunway(S.pos.x, S.pos.z) ? Math.max(0, 300 - Math.abs(S.pos.x - RWY.x) * 20) : 0;
  const pts = grade[2] + Math.round(center);
  S.score += pts; S.onGround = true; S.pos.y = gh + spec.gearH; S.vel.y = 0; dmg = 0;
  S.quat.setFromEuler(_e.set(Math.max(0, _e.x), _e.y, 0, 'YXZ'));
  S.touch = { fpm, grade: grade[0], pts, paved, archived: false };
  audio.chirp(); dust();
  toast(`<span style="color:${grade[1]}">${grade[0]}</span>`, `${fpm.toFixed(0)} ft/min · +${pts} pts${paved ? '' : ' · hors piste'}`, 3500);
  atc(`${cfg.name}, bel atterrissage (${fpm.toFixed(0)} ft/min). Dégagez à droite.`);
  if (S.gear === false) S.gear = true;
  // --- progression
  const st = progress.p.stats, ap = missions.nearestAirport(S.pos), onRwy = world.onRunway(S.pos.x, S.pos.z);
  progress.add(50 + pts * 0.5, 'Atterrissage ' + grade[0].replace(' !', '')); progress.unlock('landing'); if (fpm < 180) progress.unlock('butter');
  st.landings++; st.planes[cfg.type] = 1; if (Object.keys(st.planes).length >= 3) progress.unlock('allplanes');
  if (onRwy) { st.airports[ap.name] = 1; if (Object.keys(st.airports).length >= 3) progress.unlock('airports3'); if (S.from && S.from !== ap) progress.add(300, 'Nouvel aéroport : ' + ap.name); }
  if (world.night > 0.5) progress.unlock('night');
  progress.save(); missions.onLand(S, S.touch);
}
function crash(reason) {
  if (S.crashed) return; S.crashed = true; S.onGround = false;
  audio.boom(true); explode(S.pos.clone()); plane.visible = false;
  $('#flash').style.opacity = 0.8; setTimeout(() => ($('#flash').style.opacity = 0), 90);
  toast('<span style="color:#f87171">CRASH</span>', reason, 4000); shake = 1.2;
  $('#crashReason').textContent = reason; setTimeout(() => S.crashed && $('#crashPanel').classList.remove('hidden'), 3000);
  atc(`MAYDAY — ${cfg.name} : ${reason.toLowerCase()}. Secours en route.`);
  S.touch = { fpm: -S.vel.y * 196.85, grade: 'CRASH', pts: 0 }; archive(false); missions.onCrash(); progress.p.stats.crashes++; progress.save();
  S.vel.set(0, 0, 0);
}

// ---------------------------------------------------------------- Effets (explosion, poussière)
const particles = [], debris = []; let shake = 0;
function makeTex(draw) { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const puff = (g, col, n) => { for (let i = 0; i < n; i++) { const x = 64 + (Math.random() - .5) * 50, y = 64 + (Math.random() - .5) * 50, r = 18 + Math.random() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col(1)); gr.addColorStop(1, col(0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } };
const TEX = {
  fire: makeTex((g) => { puff(g, (a) => `rgba(255,${200 + Math.random() * 55 | 0},120,${a * .5})`, 14); puff(g, (a) => `rgba(255,255,230,${a * .5})`, 5); }),
  smoke: makeTex((g) => puff(g, (a) => `rgba(${120 + Math.random() * 40 | 0},${115 + Math.random() * 35 | 0},110,${a * .6})`, 22)),
  spark: makeTex((g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.2, 'rgba(255,190,90,.9)'); gr.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }),
  ring: makeTex((g) => { const gr = g.createRadialGradient(64, 64, 40, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.7, 'rgba(255,240,220,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }),
};
function emit(p, n, o) {
  for (let i = 0; i < n; i++) {
    const mat = new THREE.SpriteMaterial({ map: TEX[o.tex], color: o.color ?? 0xffffff, transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 0, rotation: Math.random() * 6.28 });
    const m = new THREE.Sprite(mat); const sz = o.size * (0.6 + Math.random() * 0.8); m.scale.setScalar(sz); m.position.copy(p).add(new THREE.Vector3().randomDirection().multiplyScalar(o.spread || 0)); scene.add(m);
    const dir = new THREE.Vector3().randomDirection(); if (o.up) dir.y = Math.abs(dir.y);
    particles.push({ m, v: dir.multiplyScalar(o.speed * (0.3 + Math.random() * 0.7)).add(new THREE.Vector3(0, o.rise || 0, 0)), life: o.life * (0.7 + Math.random() * 0.6), max: 0, sz, grow: o.grow ?? 1.5, drag: o.drag ?? 1.5, grav: o.grav || 0, op: o.op ?? 1, delay: (o.delay || 0) + Math.random() * (o.jitter || 0), spin: (Math.random() - .5) * 1.5, fade: o.fade || 'out' });
    particles[particles.length - 1].max = particles[particles.length - 1].life;
  }
}
let fireLight = null, fireSrc = null, fireT = 0;
function explode(p) {
  const L = spec.len;
  emit(p, 1, { tex: 'spark', size: L * 3, speed: 0, life: 0.3, add: true, grow: 2, op: .8 }); // flash
  emit(p, 1, { tex: 'ring', size: L * 1.5, speed: 0, life: 0.7, add: true, grow: 12, op: .45 }); // onde de choc
  emit(p, 8, { tex: 'fire', size: L * 1.1, speed: L * .6, life: .7, add: true, grow: 1.5, drag: 3, up: true, op: .5, color: 0xff9a40 });
  emit(p, 34, { tex: 'fire', size: L * 0.8, speed: L * 1.3, life: 1.5, add: false, color: 0xff7a28, op: .95, grow: 2.2, drag: 3, rise: 4, up: true, spread: L * .2, jitter: .25 });
  emit(p, 45, { tex: 'smoke', size: L * 1.1, speed: L * .8, life: 7, grow: 1.6, drag: 1.2, rise: 9, up: true, spread: L * .3, delay: .35, jitter: .8, op: .9, fade: 'inout', color: 0x2e2c2a });
  emit(p, 90, { tex: 'spark', size: 1.2, speed: 70, life: 2.2, add: true, grow: 0, drag: .4, grav: 9.8, up: true });
  // débris physiques avec traînée de fumée
  const dm = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: .6, roughness: .6 });
  for (let i = 0; i < 16; i++) { const s = L * (0.03 + Math.random() * .08); const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * .2, s * 1.6), dm); m.position.copy(p); m.castShadow = true; scene.add(m); debris.push({ m, v: new THREE.Vector3().randomDirection().setY(0.4 + Math.random()).multiplyScalar(18 + Math.random() * 35), w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), smoke: Math.random() < .6, t: 0 }); }
  fireSrc = p.clone(); fireT = 0;
  fireLight = new THREE.PointLight(0xff7a30, 0, 300, 2); fireLight.position.copy(p).y += 8; scene.add(fireLight);
}
function dust() { const p = S.pos.clone(); p.y -= spec.gearH - 0.3; emit(p, 10, { tex: 'smoke', size: spec.len * .25, speed: 4, life: 1.6, grow: 2, drag: 2, color: 0xcfc7b6, op: .6 }); }
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const o = particles[i]; if (o.delay > 0) { o.delay -= dt; continue; }
    o.life -= dt; if (o.life <= 0) { scene.remove(o.m); o.m.material.dispose(); particles.splice(i, 1); continue; }
    const k = 1 - o.life / o.max;
    o.v.multiplyScalar(Math.max(0, 1 - dt * o.drag)); o.v.y -= o.grav * dt; o.m.position.addScaledVector(o.v, dt);
    const gh = world.height(o.m.position.x, o.m.position.z); if (o.m.position.y < gh + 0.3) { o.m.position.y = gh + 0.3; o.v.y *= -0.3; }
    o.m.scale.setScalar(o.sz * (1 + k * o.grow)); o.m.material.rotation += o.spin * dt;
    o.m.material.opacity = o.op * (o.fade === 'inout' ? Math.min(1, k * 6) * (1 - k) : (1 - k) ** 1.5);
  }
  for (const d of debris) {
    if (d.v.lengthSq() < 0.01) continue; d.t += dt; d.v.y -= 9.81 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt;
    const gh = world.height(d.m.position.x, d.m.position.z); if (d.m.position.y < gh + .2) { d.m.position.y = gh + .2; d.v.multiplyScalar(.35); d.v.y = Math.abs(d.v.y) * .4; d.w.multiplyScalar(.5); if (d.v.length() < 1) d.v.set(0, 0, 0); }
    if (d.smoke && d.t < 3 && Math.random() < dt * 25) emit(d.m.position, 1, { tex: d.t < 1 ? 'fire' : 'smoke', size: 2.5, speed: 1, life: 1.5, add: false, grow: 2, color: d.t < 1 ? 0xff8030 : 0x333333, op: .7 });
  }
  if (fireSrc) { // feu persistant + colonne de fumée
    fireT += dt; if (fireT < 25) { if (Math.random() < dt * 14) emit(fireSrc, 1, { tex: 'fire', size: spec.len * .35, speed: 2, life: 1.1, add: false, color: 0xff8030, rise: 6, grow: 1, spread: spec.len * .25 }); if (Math.random() < dt * 8) emit(fireSrc, 1, { tex: 'smoke', size: spec.len * .6, speed: 2, life: 8, rise: 10, grow: 3, drag: .3, color: 0x3a3a3a, op: .7, fade: 'inout' }); }
    if (fireLight) fireLight.intensity = Math.max(0, 1 - fireT / 25) * (120 + Math.random() * 120) + (fireT < .4 ? 1500 * (1 - fireT / .4) : 0);
  }
}

// ---------------------------------------------------------------- Caméras
const CAMS = ['Poursuite', 'Cockpit', 'Cinéma', 'Tour', 'Orbitale'];
let camMode = 0; const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(); let cineAnchor = new THREE.Vector3();
function cycleCam() { camMode = (camMode + 1) % CAMS.length; $('#camName').textContent = CAMS[camMode]; orbit.yaw = 0; orbit.pitch = 0; cineAnchor.set(0, -1e9, 0); plane.visible = !S.crashed; }
function updateCamera(dt) {
  axes(); const d = spec.cam * orbit.zoom; camera.fov = 62;
  const target = S.pos.clone();
  if (S.crashed) { const t = performance.now() / 4000; camPos.set(target.x + Math.cos(t) * 110, target.y + 40, target.z + Math.sin(t) * 110); if (camera.position.distanceTo(camPos) > 300) camera.position.copy(camPos); else camera.position.lerp(camPos, 0.05); camera.up.set(0, 1, 0); camera.lookAt(target); return; }
  if (camMode === 0 || camMode === 4) {
    const back = _f.clone().multiplyScalar(-1); if (camMode === 4) back.set(Math.sin(orbit.yaw), 0, Math.cos(orbit.yaw));
    back.applyAxisAngle(new THREE.Vector3(0, 1, 0), camMode === 0 ? orbit.yaw : 0);
    const upBlend = settings.assist ? new THREE.Vector3(0, 1, 0) : _u.clone().lerp(new THREE.Vector3(0, 1, 0), 0.7).normalize();
    if (camMode === 0 && _f.y > 0.85) back.set(-S.vel.x, 0, -S.vel.z).normalize().lerp(back, 0.3).normalize();
    camPos.copy(target).addScaledVector(back, d * Math.cos(orbit.pitch)).addScaledVector(upBlend, d * (0.22 + Math.sin(orbit.pitch)));
    const gh = world.height(camPos.x, camPos.z) + 2; if (camPos.y < gh) camPos.y = gh;
    if (camera.position.distanceTo(camPos) > d * 6) camera.position.copy(camPos); else camera.position.lerp(camPos, 1 - Math.exp(-dt * 7));
    camLook.copy(target).addScaledVector(_f, spec.len * 0.8).addScaledVector(upBlend, spec.len * 0.12);
    camera.up.lerp(upBlend, 0.1); camera.lookAt(camLook); plane.visible = true;
  } else if (camMode === 1) {
    const eye = { jet: [0, 1.05, -4.1], cargo: [-0.5, 1.4, -19.6], prop: [-0.3, 0.55, -0.9] }[cfg.type];
    camera.position.copy(new THREE.Vector3(...eye).applyQuaternion(S.quat).add(S.pos));
    camera.quaternion.copy(S.quat); camera.rotateY(orbit.yaw); camera.rotateX(-orbit.pitch * 0.6); camera.up.copy(_u); plane.visible = true; camera.fov = 72;
  } else if (camMode === 2) {
    if (cineAnchor.distanceTo(S.pos) > 900 || cineAnchor.y < -1e8) { cineAnchor.copy(S.pos).addScaledVector(S.vel.lengthSq() > 1 ? S.vel.clone().normalize() : _f, 500).add(new THREE.Vector3((Math.random() - 0.5) * 120, 0, (Math.random() - 0.5) * 120)); cineAnchor.y = Math.max(world.height(cineAnchor.x, cineAnchor.z) + 4, S.pos.y + (Math.random() - 0.3) * 40); }
    camera.position.copy(cineAnchor); camera.up.set(0, 1, 0); camera.lookAt(S.pos); camera.fov = THREE.MathUtils.clamp(2400 / cineAnchor.distanceTo(S.pos), 8, 60);
  } else {
    const tw = world.towers.reduce((b, t) => (t.distanceTo(S.pos) < b.distanceTo(S.pos) ? t : b)); if (tw.distanceTo(S.pos) > 9000) { camMode = 0; $('#camName').textContent = CAMS[0]; toast('TOUR HORS DE PORTÉE', 'rapprochez-vous d\'un aéroport', 1500); return; } camera.position.copy(tw); camera.up.set(0, 1, 0); camera.lookAt(S.pos); camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan((spec.len * 2.2) / camera.position.distanceTo(S.pos))), 2, 50); plane.visible = true;
  }
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- HUD vectoriel (style chasseur / GTA)
function drawHUD(fps) {
  const W = hud.width, H = hud.height; hx.clearRect(0, 0, W, H); if (S.crashed || camMode === 2 || camMode === 3) return;
  _e.setFromQuaternion(S.quat, 'YXZ'); const pitch = _e.x, roll = _e.z, hdg = (((-THREE.MathUtils.radToDeg(_e.y)) % 360) + 360) % 360;
  const spd = S.vel.length() * 1.944, alt = S.pos.y * 3.281, cx = W / 2, cy = H / 2 + 20, ppd = H / 60;
  const col = 'rgba(120,255,190,0.95)'; hx.strokeStyle = col; hx.fillStyle = col; hx.lineWidth = 1.6; hx.font = '600 12px ui-monospace,Consolas,monospace'; hx.shadowColor = 'rgba(0,0,0,.6)'; hx.shadowBlur = 4;
  // échelle de tangage
  hx.save(); hx.beginPath(); hx.rect(cx - 220, cy - 190, 440, 380); hx.clip(); hx.translate(cx, cy); hx.rotate(-roll); hx.translate(0, THREE.MathUtils.radToDeg(pitch) * ppd);
  for (let a = -90; a <= 90; a += 5) {
    if (a === 0) { hx.beginPath(); hx.moveTo(-200, 0); hx.lineTo(-40, 0); hx.moveTo(40, 0); hx.lineTo(200, 0); hx.stroke(); continue; }
    const y = -a * ppd, w = a % 10 === 0 ? 70 : 35; hx.setLineDash(a < 0 ? [8, 6] : []);
    hx.beginPath(); hx.moveTo(-40 - w, y); hx.lineTo(-40, y); hx.lineTo(-40, y + (a > 0 ? 8 : -8)); hx.moveTo(40 + w, y); hx.lineTo(40, y); hx.lineTo(40, y + (a > 0 ? 8 : -8)); hx.stroke();
    if (a % 10 === 0) { hx.fillText(Math.abs(a), -40 - w - 22, y + 4); hx.fillText(Math.abs(a), 40 + w + 6, y + 4); }
  }
  hx.setLineDash([]); hx.restore();
  // repère avion + vecteur vitesse
  hx.beginPath(); hx.moveTo(cx - 30, cy); hx.lineTo(cx - 10, cy); hx.lineTo(cx, cy + 8); hx.lineTo(cx + 10, cy); hx.lineTo(cx + 30, cy); hx.stroke();
  if (S.vel.length() > 5) { const vb = S.vel.clone().applyQuaternion(S.quat.clone().invert()); const fx = cx + Math.atan2(vb.x, -vb.z) * 57.3 * ppd, fy = cy - Math.atan2(vb.y, -vb.z) * 57.3 * ppd; hx.beginPath(); hx.arc(fx, fy, 7, 0, 7); hx.moveTo(fx - 18, fy); hx.lineTo(fx - 7, fy); hx.moveTo(fx + 7, fy); hx.lineTo(fx + 18, fy); hx.moveTo(fx, fy - 7); hx.lineTo(fx, fy - 14); hx.stroke(); }
  // bandes vitesse / altitude
  const tape = (x, val, step, lbl, right) => {
    hx.save(); hx.fillStyle = 'rgba(5,15,25,.18)'; hx.fillRect(x - 38, cy - 150, 76, 300); hx.beginPath(); hx.rect(x - 38, cy - 150, 76, 300); hx.clip(); hx.fillStyle = col;
    for (let v = Math.floor((val - step * 8) / step) * step; v < val + step * 8; v += step) { const y = cy - ((v - val) / step) * 20; hx.beginPath(); hx.moveTo(right ? x - 38 : x + 26, y); hx.lineTo(right ? x - 26 : x + 38, y); hx.stroke(); if (v % (step * 5) === 0) hx.fillText(v, right ? x - 20 : x - 30, y + 4); }
    hx.restore(); hx.fillStyle = 'rgba(0,0,0,.75)'; hx.fillRect(x - 42, cy - 14, 84, 28); hx.strokeRect(x - 42, cy - 14, 84, 28); hx.fillStyle = '#fff'; hx.font = '700 16px ui-monospace,Consolas,monospace'; hx.fillText(Math.round(val), x - 30, cy + 6); hx.font = '600 11px ui-monospace,Consolas,monospace'; hx.fillStyle = col; hx.fillText(lbl, x - 14, cy - 158);
  };
  tape(cx - 300, spd, 10, 'KT', false); tape(cx + 300, alt, 100, 'FT', true);
  // cap
  hx.save(); hx.beginPath(); hx.rect(cx - 180, 96, 360, 34); hx.clip();
  for (let h = Math.floor(hdg - 30); h <= hdg + 30; h++) { if (h % 5) continue; const x = cx + (h - hdg) * 6; const hh = ((h % 360) + 360) % 360; hx.beginPath(); hx.moveTo(x, 120); hx.lineTo(x, h % 10 ? 126 : 130); hx.stroke(); if (h % 10 === 0) { const lab = { 0: 'N', 90: 'E', 180: 'S', 270: 'O' }[hh] ?? String(hh / 10).padStart(2, '0'); hx.fillText(lab, x - 7, 114); } }
  hx.restore(); hx.beginPath(); hx.moveTo(cx, 131); hx.lineTo(cx - 6, 139); hx.lineTo(cx + 6, 139); hx.fill();
  // marqueur d'objectif de mission
  const tgt = missions.target();
  if (tgt) {
    const v = tgt.clone().project(camera), dist = (S.pos.distanceTo(tgt) / 1000).toFixed(1) + ' km';
    let sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H; const behind = v.z > 1;
    hx.save(); hx.strokeStyle = hx.fillStyle = '#fbbf24'; hx.lineWidth = 2;
    if (!behind && sx > 40 && sx < W - 40 && sy > 60 && sy < H - 40) { hx.beginPath(); hx.moveTo(sx, sy - 12); hx.lineTo(sx + 12, sy); hx.lineTo(sx, sy + 12); hx.lineTo(sx - 12, sy); hx.closePath(); hx.stroke(); hx.fillText(dist, sx + 16, sy + 4); }
    else { let dx = sx - W / 2, dy = sy - H / 2; if (behind) { dx = -dx; dy = -dy; } const a = Math.atan2(dy, dx), r = Math.min(W, H) * 0.38; const ex = W / 2 + Math.cos(a) * r, ey = H / 2 + Math.sin(a) * r; hx.translate(ex, ey); hx.rotate(a); hx.beginPath(); hx.moveTo(16, 0); hx.lineTo(-8, -10); hx.lineTo(-8, 10); hx.closePath(); hx.fill(); hx.rotate(-a); hx.fillText(dist, 14, 20); }
    hx.restore();
  }
  // infos
  const vs = S.vel.y * 196.85, agl = (S.pos.y - world.height(S.pos.x, S.pos.z) - spec.gearH) * 3.281;
  hx.fillText(`VS ${vs >= 0 ? '+' : ''}${vs.toFixed(0)}`, cx + 262, cy + 175); hx.fillText(`AGL ${Math.max(0, agl).toFixed(0)}`, cx + 262, cy + 191);
  hx.fillText(`G ${S.g.toFixed(1)}   AOA ${THREE.MathUtils.radToDeg(S.aoa).toFixed(1)}°`, cx - 338, cy + 175); hx.fillText(`THR ${(S.throttle * 100).toFixed(0)}%`, cx - 338, cy + 191);
  hx.fillStyle = 'rgba(255,255,255,.5)'; hx.fillText(`${fps} FPS`, W - 70, H - 180);
  if (!S.onGround && S.aoa > 0.25) { hx.fillStyle = (performance.now() % 500) < 250 ? '#ff4d4d' : '#fff'; hx.font = '800 22px system-ui'; hx.fillText('DÉCROCHAGE', cx - 70, cy - 210); }
  if (!S.onGround && !S.gear && agl < 500 && vs < -200) { hx.fillStyle = '#fbbf24'; hx.font = '800 18px system-ui'; hx.fillText('⚠ TRAIN RENTRÉ', cx - 70, cy + 230); }
  if (!S.onGround && agl < 1200 && vs < -1500) { hx.fillStyle = '#ff4d4d'; hx.font = '800 22px system-ui'; hx.fillText('PULL UP', cx - 45, cy + 260); }
}
// Minimap style GTA (rotation cap-haut)
const mm = $('#minimap'), mx = mm.getContext('2d');
function drawMinimap() {
  const W = 220, s = 256 / SIZE; mx.clearRect(0, 0, W, W); mx.save(); mx.beginPath(); mx.arc(110, 110, 110, 0, 7); mx.clip();
  mx.fillStyle = '#0b2433'; mx.fillRect(0, 0, W, W);
  _e.setFromQuaternion(S.quat, 'YXZ'); const zoom = 6;
  mx.translate(110, 110); mx.rotate(_e.y); mx.scale(zoom, zoom); mx.translate(-(S.pos.x + SIZE / 2) * s, -(S.pos.z + SIZE / 2) * s);
  mx.imageSmoothingEnabled = true; mx.drawImage(world.mapCanvas, 0, 0);
  // trace
  mx.strokeStyle = '#f472b6'; mx.lineWidth = 0.4; mx.beginPath(); telemetry.track.forEach(([x, z], i) => { const X = (x + SIZE / 2) * s, Z = (z + SIZE / 2) * s; i ? mx.lineTo(X, Z) : mx.moveTo(X, Z); }); mx.stroke();
  const mt = missions.target(); if (mt) { mx.fillStyle = '#fbbf24'; mx.beginPath(); mx.arc((mt.x + SIZE / 2) * s, (mt.z + SIZE / 2) * s, 1.4, 0, 7); mx.fill(); }
  for (const o of others.values()) { mx.fillStyle = '#fbbf24'; mx.beginPath(); mx.arc((o.pos.x + SIZE / 2) * s, (o.pos.z + SIZE / 2) * s, 0.9, 0, 7); mx.fill(); }
  mx.restore();
  mx.fillStyle = '#fff'; mx.beginPath(); mx.moveTo(110, 100); mx.lineTo(103, 118); mx.lineTo(110, 114); mx.lineTo(117, 118); mx.fill();
  mx.fillStyle = 'rgba(0,0,0,.55)'; mx.fillRect(60, 188, 100, 22); mx.fillStyle = '#34d399'; mx.font = '600 11px ui-monospace,Consolas'; mx.fillText(`${(S.vel.length() * 1.944).toFixed(0)} kt  ${(S.pos.y * 3.281).toFixed(0)} ft`, 66, 203);
  const n = -_e.y; mx.fillStyle = '#f87171'; mx.font = 'bold 13px system-ui'; mx.fillText('N', 106 + Math.sin(n) * -96, 114 - Math.cos(n) * 96);
}

// ---------------------------------------------------------------- UI helpers
let toastT = 0; function toast(big, small, ms = 2500) { const t = $('#toast'); if (!big) { t.classList.remove('show'); return; } t.innerHTML = `${big}<small>${small || ''}</small>`; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
function atc(msg) { $('#atc').textContent = 'ATC : ' + msg; }
function hhmm() { return new Date().toTimeString().slice(0, 5); }
function phaseName() {
  if (S.crashed) return 'CRASH'; const vs = S.vel.y * 196.85, agl = S.pos.y - world.height(S.pos.x, S.pos.z);
  if (S.onGround) return S.vel.length() > 20 ? (S.airborne && S.throttle < 0.6 ? 'ROULAGE ATTERRISSAGE' : 'COURSE DÉCOLLAGE') : 'AU SOL';
  if (agl < 300 && vs < -100 && S.gear) return 'APPROCHE'; if (vs > 400) return 'MONTÉE'; if (vs < -400) return 'DESCENTE'; return 'CROISIÈRE';
}
function updateUI(dt) {
  const set = (id, v) => ($(id).textContent = v);
  $('#ledGear').className = 'led ' + (S.gearAnim > 0.98 ? 'g' : S.gearAnim < 0.02 ? '' : 'a'); set('#txtGear', S.gearAnim > 0.98 ? 'SORTI' : S.gearAnim < 0.02 ? 'RENTRÉ' : 'TRANSIT');
  $('#ledFlaps').className = 'led ' + (S.flaps > 0 ? 'a' : ''); set('#txtFlaps', Math.round(S.flaps * 30) + '°');
  $('#ledBrake').className = 'led ' + (S.brake ? 'r' : ''); set('#txtBrake', S.brake ? 'ON' : 'OFF');
  $('#thrBar').style.width = S.throttle * 100 + '%'; set('#txtThr', Math.round(S.throttle * 100) + '%');
  $('#phase').textContent = phaseName() + (S.paused ? ' · PAUSE' : '');
}

// ---------------------------------------------------------------- Télémétrie + archivage
let sampleT = 0;
function flightXP(dt) {
  if (S.crashed || S.onGround) return; const spd = S.vel.length(), agl = S.pos.y - world.height(S.pos.x, S.pos.z), st = progress.p.stats;
  S.airT += dt; S.distAcc += spd * dt; st.time += dt; st.dist += spd * dt;
  S.xpAcc += dt * 1.2; if (S.xpAcc >= 60) { progress.add(S.xpAcc, 'Temps de vol'); S.xpAcc = 0; }
  if (S.distAcc > 5000) { S.distAcc -= 5000; progress.add(25, '5 km parcourus'); }
  if (S.pos.y * 3.281 > st.maxAlt) st.maxAlt = S.pos.y * 3.281; if (spd * 1.944 > st.maxSpd) st.maxSpd = spd * 1.944;
  if (S.pos.y * 3.281 > 10000) progress.unlock('alt10k'); if (spd * 1.944 > 450) progress.unlock('speed450');
  if (agl < 30 && spd > 103) { S.lowT += dt; if (S.lowT > 10) progress.unlock('lowpass'); } else S.lowT = 0;
}
function record(dt) {
  flightXP(dt);
  sampleT += dt; const ph = phaseName(); telemetry.phases[ph] = (telemetry.phases[ph] || 0) + dt;
  S.maxAlt = Math.max(S.maxAlt, S.pos.y * 3.281); S.maxSpd = Math.max(S.maxSpd, S.vel.length() * 1.944);
  if (sampleT < 0.5) return; sampleT = 0;
  telemetry.samples.push({ t: (performance.now() - S.t0) / 1000, alt: S.pos.y * 3.281, spd: S.vel.length() * 1.944, vs: S.vel.y * 196.85, g: S.g, thr: S.throttle });
  if (telemetry.samples.length > 1200) telemetry.samples.shift();
  const last = telemetry.track[telemetry.track.length - 1]; if (!last || Math.hypot(last[0] - S.pos.x, last[1] - S.pos.z) > 60) telemetry.track.push([S.pos.x, S.pos.z]);
}
async function archive(ok) {
  const f = { name: cfg.name, type: cfg.type, plane: spec.name, dur: Math.round((performance.now() - S.t0) / 1000), maxAlt: Math.round(S.maxAlt), maxSpd: Math.round(S.maxSpd), landed: ok, fpm: Math.round(S.touch?.fpm || 0), grade: S.touch?.grade || '-', score: S.touch?.pts || 0, at: new Date().toISOString() };
  const local = JSON.parse(localStorage.flights || '[]'); local.push(f); localStorage.flights = JSON.stringify(local.slice(-300));
  try { await fetch('/api/flights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); } catch {}
  dash.refresh();
}

// ---------------------------------------------------------------- Multijoueur LAN
const others = new Map(); const myId = Math.random().toString(36).slice(2, 10); let chatSince = 0;
function label(text) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgba(10,20,35,.7)'; g.beginPath(); g.roundRect(8, 10, 240, 44, 22); g.fill(); g.fillStyle = '#fbbf24'; g.font = 'bold 26px system-ui'; g.textAlign = 'center'; g.fillText(text, 128, 42); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.scale.set(24, 6, 1); return s; }
async function netTick() {
  if (cfg.mode !== 'lan') return;
  try {
    const r = await fetch('/api/mp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: myId, name: cfg.name, type: cfg.type, p: S.pos.toArray().map((v) => +v.toFixed(2)), q: S.quat.toArray().map((v) => +v.toFixed(4)), th: S.throttle, gear: S.gear, crashed: S.crashed, since: chatSince, msg: pendingMsg }) });
    pendingMsg = null; const d = await r.json(); const seen = new Set();
    for (const p of d.players) {
      seen.add(p.id); let o = others.get(p.id);
      if (!o || o.type !== p.type) { if (o) scene.remove(o.mesh); const mesh = buildAircraft(p.type, p.name); const lb = label(p.name); lb.position.y = SPECS[p.type].len * 0.5 + 4; mesh.add(lb); scene.add(mesh); o = { mesh, type: p.type, pos: new THREE.Vector3(...p.p), quat: new THREE.Quaternion(...p.q), st: { inRoll: 0, inPitch: 0, inYaw: 0, flaps: 0, gear: true, gearAnim: 1, throttle: 0 } }; o.mesh.position.copy(o.pos); others.set(p.id, o); atc(`${p.name} a rejoint la session.`); }
      o.pos.set(...p.p); o.quat.set(...p.q); o.st.throttle = p.th; o.st.gear = p.gear; o.mesh.visible = !p.crashed;
    }
    for (const [id, o] of others) if (!seen.has(id)) { scene.remove(o.mesh); others.delete(id); }
    for (const c of d.chat) { chatSince = Math.max(chatSince, c.t); addChat(`<b style="color:#fbbf24">${c.from}</b> : ${c.msg.replace(/</g, '&lt;')}`); }
    $('#netState').textContent = `● LAN · ${d.players.length + 1} pilote(s)`;
  } catch { $('#netState').textContent = '● LAN hors-ligne'; }
}
let pendingMsg = null;
function sendChat() { const v = $('#chatIn').value.trim(); if (v) pendingMsg = v; $('#chatIn').value = ''; $('#chatIn').blur(); $('#chatIn').classList.add('hidden'); }
function addChat(h) { const d = document.createElement('div'); d.innerHTML = h; $('#chatLog').append(d); setTimeout(() => d.remove(), 12000); }

// ---------------------------------------------------------------- Widgets live
const wHist = { spd: [], alt: [], vs: [], g: [] }; let wT = 0;
function updateWidgets(dt) {
  wT += dt; if (wT < 0.15) return; wT = 0; if ($('#widgets').classList.contains('hidden')) return;
  const spd = S.vel.length() * 1.944, alt = S.pos.y * 3.281, vs = S.vel.y * 196.85;
  for (const [k, v] of [['spd', spd], ['alt', alt], ['vs', vs], ['g', S.g]]) { wHist[k].push(v); if (wHist[k].length > 80) wHist[k].shift(); }
  $('#kSpd').textContent = spd.toFixed(0); $('#kAlt').textContent = alt.toFixed(0); $('#kVs').textContent = vs.toFixed(0); $('#kG').textContent = S.g.toFixed(2); $('#wScore').textContent = 'Score ' + S.score;
  spark($('#sSpd'), wHist.spd, '#38bdf8'); spark($('#sAlt'), wHist.alt, '#34d399'); spark($('#sVs'), wHist.vs, '#a78bfa'); spark($('#sG'), wHist.g, '#fbbf24');
  // indicateur ILS : écart latéral + plan de descente
  const c = $('#ils'), g = c.getContext('2d'); c.width = c.clientWidth * 2; c.height = 180; g.scale(2, 2); const W = c.clientWidth, H = 90;
  const thrZ = RWY.len / 2 - 320, dz = S.pos.z - thrZ, ideal = AIRPORT_H + Math.tan(0.0524) * Math.max(0, dz);
  const gsDev = THREE.MathUtils.clamp((S.pos.y - ideal) / Math.max(15, dz * 0.02), -1, 1), locDev = THREE.MathUtils.clamp((S.pos.x - RWY.x) / Math.max(20, dz * 0.03), -1, 1);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.roundRect(0, 0, W, H, 10); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.25)'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.arc(W / 2 + i * 30, H / 2, 3, 0, 7); g.stroke(); g.beginPath(); g.arc(W - 30, H / 2 + i * 16, 3, 0, 7); g.stroke(); }
  g.fillStyle = '#f472b6'; g.fillRect(W / 2 - locDev * 60 - 2, 8, 4, H - 16); g.fillStyle = '#38bdf8'; g.beginPath(); g.moveTo(W - 44, H / 2 + gsDev * 32); g.lineTo(W - 16, H / 2 + gsDev * 32 - 6); g.lineTo(W - 16, H / 2 + gsDev * 32 + 6); g.fill();
  g.fillStyle = '#cbd5e1'; g.font = '11px system-ui'; g.fillText(`Distance seuil : ${(Math.max(0, dz) / 1852).toFixed(1)} NM`, 10, 16); g.fillText(`LOC ${locDev > 0.1 ? '◀ corriger à gauche' : locDev < -0.1 ? 'corriger à droite ▶' : '✓ aligné'}`, 10, H - 22); g.fillText(`G/S ${gsDev > 0.15 ? 'trop haut ▼' : gsDev < -0.15 ? 'trop bas ▲' : '✓ sur le plan'}`, 10, H - 8);
}

// ---------------------------------------------------------------- Boucle
const clock = new THREE.Clock(); let frames = 0, fpsT = 0, fps = 0, netT = 0, uiT = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  if (garage?.open) { garage.render(); return; }
  if (!started) { // écran d'accueil : caméra cinématique autour de l'aéroport
    const a = t * 0.05; camera.position.set(Math.cos(a) * 420 + 150, AIRPORT_H + 70, Math.sin(a) * 420 + 1300); camera.lookAt(0, AIRPORT_H + 5, RWY.len / 2 - 60);
    world.update(t, camera.position); renderFrame(); return;
  }
  if (!S.paused) {
    readInput(dt);
    const sub = 4; for (let i = 0; i < sub; i++) physics(dt / sub);
    record(dt); updateParticles(dt); missions.update(dt, S);
  }
  plane.position.copy(S.pos); plane.quaternion.copy(S.quat);
  animateAircraft(plane, S, dt, t);
  for (const o of others.values()) { o.mesh.position.lerp(o.pos, Math.min(1, dt * 8)); o.mesh.quaternion.slerp(o.quat, Math.min(1, dt * 8)); animateAircraft(o.mesh, o.st, dt, t); }
  updateCamera(dt); if (shake > 0) { shake = Math.max(0, shake - dt * .8); camera.position.add(new THREE.Vector3().randomDirection().multiplyScalar(shake * shake * 3)); }
  world.update(t, S.pos); world.updatePapi(S.pos.x, S.pos.y, S.pos.z);
  audio.engine(S.crashed ? 0 : S.throttle, S.vel.length(), cfg.type);
  if (!S.onGround && !S.crashed && S.aoa > 0.25 && Math.floor(t * 4) !== Math.floor((t - dt) * 4)) audio.beep(1000, 0.08, 0.08);
  renderFrame(); drawHUD(fps);
  uiT += dt; if (uiT > 0.1) { uiT = 0; updateUI(); drawMinimap(); }
  updateWidgets(dt);
  netT += dt; if (netT > 0.1) { netT = 0; netTick(); }
  dash.live(telemetry, S, world);
}
function renderFrame() { if (composer) composer.render(); else renderer.render(scene, camera); }

// ---------------------------------------------------------------- Démarrage & menus
let started = false; const dash = new Dashboard();
const progress = new Progress((lv, rank) => { toast(`<span style="color:#fbbf24">NIVEAU ${lv}</span>`, rank + ' · nouvelles livrées au garage', 3500); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => audio.beep(f, 0.18, 0.07), i * 120)); });
progress.load(localStorage.lastName || 'ALPHA-1'); $('#pName').value = progress.name;
let missions = null, garage = null;
function openModal(id) { document.querySelector(id).classList.remove('hidden'); }
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('.modal').classList.add('hidden')));
$('#btnMissions').onclick = () => {
  $('#missionList').innerHTML = MISSIONS.map((x) => `<button class="mcard" data-m="${x.id}"><div class="ic">${x.icon}</div><b>${x.name}</b><small>${x.desc}</small><em>🏆 ${x.xp} XP</em></button>`).join('');
  $('#missionList').querySelectorAll('button').forEach((b) => (b.onclick = () => { $('#missionsModal').classList.add('hidden'); if (!started) $('#go').click(); missions.start(b.dataset.m, S); }));
  openModal('#missionsModal');
};
$('#btnCareer').onclick = () => {
  const p = progress.p, st = p.stats, lv = progress.level;
  $('#careerBody').innerHTML = `<div style="display:flex;gap:14px;align-items:center;margin-bottom:12px"><div style="width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font-size:28px;font-weight:800;background:linear-gradient(135deg,#fbbf24,#f472b6)">${lv}</div><div><h3>${progress.name}</h3><div style="color:#fde68a">${progress.rank} · ${p.xp} XP (prochain niveau : ${xpForLevel(lv + 1)})</div></div></div>
  <div class="cstats"><div><small>Vols</small><b>${st.flights}</b></div><div><small>Atterrissages</small><b>${st.landings}</b></div><div><small>Crashs</small><b>${st.crashes}</b></div><div><small>Heures</small><b>${(st.time / 3600).toFixed(2)}</b></div><div><small>Distance</small><b>${(st.dist / 1000).toFixed(0)} km</b></div><div><small>Alt. max</small><b>${Math.round(st.maxAlt)} ft</b></div><div><small>V max</small><b>${Math.round(st.maxSpd)} kt</b></div><div><small>Aéroports</small><b>${Object.keys(st.airports).length}/3</b></div></div>
  <h3 style="margin-top:14px">Succès ${Object.keys(p.ach).length}/${ACHIEVEMENTS.length}</h3><div class="achgrid">${ACHIEVEMENTS.map((a) => `<div class="ach ${p.ach[a.id] ? '' : 'off'}"><span>${a.icon}</span><div><b>${a.name}</b><small>${a.desc}</small></div></div>`).join('')}</div>`;
  openModal('#careerModal');
};
function setPlanePick(type) { cfg.type = type; document.querySelectorAll('#planePick button').forEach((b) => b.classList.toggle('on', b.dataset.p === type)); }
const openGarage = () => { audio.init(); garage.show(cfg.type); };
$('#btnGarage').onclick = openGarage; $('#goGarage').onclick = openGarage;
function pick(sel, key) { document.querySelectorAll(sel + ' button').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll(sel + ' button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); cfg[key] = b.dataset[key[0]]; })); }
pick('#planePick', 'p'); pick('#spawnPick', 's'); pick('#modePick', 'm');
// mapping cfg keys
document.querySelectorAll('#planePick button').forEach((b) => b.addEventListener('click', () => (cfg.type = b.dataset.p)));
document.querySelectorAll('#spawnPick button').forEach((b) => b.addEventListener('click', () => (cfg.spawn = b.dataset.s)));
document.querySelectorAll('#modePick button').forEach((b) => b.addEventListener('click', () => (cfg.mode = b.dataset.m)));
$('#go').addEventListener('click', () => {
  cfg.name = ($('#pName').value || 'ALPHA-1').toUpperCase(); localStorage.lastName = cfg.name; progress.load(cfg.name); $('#start').classList.add('hidden'); started = true;
  audio.init(); audio.setVolume(+$('#vol').value); spawn();
  if (cfg.mode === 'lan') { $('#netState').textContent = '● LAN connexion…'; addChat('Multijoueur LAN actif — appuyez sur <b>T</b> pour discuter.'); }
});
document.querySelectorAll('#viewTabs button').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('#viewTabs button').forEach((x) => x.classList.toggle('on', x === b)); const d = b.dataset.v === 'dash'; $('#dash').classList.toggle('hidden', !d); if (d) dash.refresh(true); }));
document.querySelectorAll('#todTabs button').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('#todTabs button').forEach((x) => x.classList.toggle('on', x === b)); world.setTime(b.dataset.t); }));
document.querySelectorAll('#qTabs button').forEach((b) => b.addEventListener('click', () => { quality = localStorage.quality = b.dataset.q; applyQuality(); }));
function nextTrack() { audio.init(); audio.track = (audio.track + 1) % 4; $('#trackName').textContent = Audio.TRACKS[audio.track]; audio.musicOn = true; }
$('#btnNextTrack').onclick = nextTrack;
$('#btnMusic').onclick = () => { audio.init(); audio.musicOn = !audio.musicOn; $('#btnMusic').style.opacity = audio.musicOn ? 1 : 0.5; };
$('#vol').oninput = (e) => audio.setVolume(+e.target.value);
$('#btnCam').onclick = cycleCam; $('#btnWidgets').onclick = () => $('#widgets').classList.toggle('hidden');
$('#btnCine').onclick = () => document.body.classList.toggle('cine');
function toggleFs() {
  const el = document.documentElement, fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  if (fsEl) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); document.body.classList.remove('immersive'); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  const fallback = () => { document.body.classList.toggle('immersive'); toast(document.body.classList.contains('immersive') ? 'MODE IMMERSIF' : 'MODE NORMAL', 'Plein écran bloqué par l\'aperçu : ouvrez le jeu dans un onglet ou appuyez sur F11 · Échap pour quitter', 3000); };
  try { const r = req && req.call(el, { navigationUI: 'hide' }); if (r && r.catch) r.catch(fallback); else if (!req) fallback(); } catch { fallback(); }
}
$('#btnFs').onclick = toggleFs;
addEventListener('keydown', (e) => { if (e.code === 'Escape') document.body.classList.remove('immersive'); if (e.code === 'KeyF' && e.altKey) toggleFs(); });
$('#rsRunway').onclick = () => { cfg.spawn = 'runway'; spawn(); }; $('#rsApproach').onclick = () => { cfg.spawn = 'approach'; spawn(); };
$('#rsMenu').onclick = () => location.reload();

$('#loadInfo').textContent = 'Génération du monde…';
setTimeout(() => {
  const t0 = performance.now();
  world = new World(renderer, scene, quality); world.setTime(params.get('tod') || 'day'); applyQuality();
  missions = new Missions(scene, world, progress, toast);
  garage = new Garage(renderer, progress, (type) => { setPlanePick(type); if (started) spawn(); });
  addEventListener('resize', () => garage.resize());
  $('#loadInfo').textContent = `Monde prêt (${((performance.now() - t0) / 1000).toFixed(1)} s) · 60 × 60 km · 3 aéroports · 5 villes`;
  window.__sim = { get garage() { return garage; }, get missions() { return missions; }, progress, simulate: (sec, inp = {}) => { const dt = 1 / 120; for (let i = 0; i < sec * 120; i++) { Object.assign(S, inp); physics(dt); } }, particles, camera, get plane() { return plane; }, S, cfg, spawn, get world() { return world; }, cycleCam, start: () => $('#go').click() };
  loop();
}, 30);
