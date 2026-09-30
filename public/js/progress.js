// Progression : XP, niveaux, succès, statistiques de carrière (sauvegardé localement par pilote)
const $ = (s) => document.querySelector(s);

export const ACHIEVEMENTS = [
  { id: 'takeoff', icon: '🛫', name: 'Premier envol', desc: 'Décoller pour la première fois', xp: 100 },
  { id: 'landing', icon: '🛬', name: 'Retour sur terre', desc: 'Réussir un atterrissage', xp: 150 },
  { id: 'butter', icon: '🧈', name: 'Butter !', desc: 'Toucher à moins de 180 ft/min', xp: 300 },
  { id: 'alt10k', icon: '⛰️', name: 'Haute altitude', desc: 'Dépasser 10 000 ft', xp: 150 },
  { id: 'speed450', icon: '⚡', name: 'Supersonique… presque', desc: 'Dépasser 450 kt', xp: 200 },
  { id: 'lowpass', icon: '🌾', name: 'Rase-mottes', desc: 'Voler 10 s sous 100 ft à plus de 200 kt', xp: 250 },
  { id: 'airports3', icon: '🗺️', name: 'Globe-trotter', desc: 'Atterrir sur les 3 aéroports', xp: 600 },
  { id: 'rings', icon: '💍', name: 'Voltigeur', desc: 'Terminer un parcours d\'anneaux', xp: 300 },
  { id: 'delivery', icon: '📦', name: 'Livreur', desc: 'Terminer une mission de livraison', xp: 300 },
  { id: 'night', icon: '🌙', name: 'Pilote de nuit', desc: 'Atterrir de nuit', xp: 250 },
  { id: 'allplanes', icon: '✈️', name: 'Qualifié multi-types', desc: 'Atterrir avec les 3 appareils', xp: 500 },
  { id: 'lvl5', icon: '⭐', name: 'Commandant', desc: 'Atteindre le niveau 5', xp: 0 },
  { id: 'lvl10', icon: '🏆', name: 'As des as', desc: 'Atteindre le niveau 10', xp: 0 },
];
export const RANKS = ['Élève pilote', 'Pilote privé', 'Pilote de ligne', 'Copilote', 'Commandant', 'Chef pilote', 'Pilote d\'essai', 'Instructeur', 'As', 'Légende', 'Top Gun'];
export const xpForLevel = (n) => Math.round(300 * Math.pow(n - 1, 1.55)); // XP cumulée pour atteindre le niveau n

export class Progress {
  constructor(onLevel) {
    this.onLevel = onLevel; this.name = 'ALPHA-1'; this.load();
    this.queue = [];
  }
  load(name = this.name) {
    this.name = name; const d = JSON.parse(localStorage['profile_' + name] || '{}');
    this.p = Object.assign({ xp: 0, ach: {}, stats: { flights: 0, landings: 0, crashes: 0, time: 0, dist: 0, maxAlt: 0, maxSpd: 0, airports: {}, planes: {} }, livery: { jet: 'default', cargo: 'default', prop: 'default' } }, d);
    this.render();
  }
  save() { localStorage['profile_' + this.name] = JSON.stringify(this.p); }
  get level() { let n = 1; while (this.p.xp >= xpForLevel(n + 1)) n++; return n; }
  get rank() { return RANKS[Math.min(RANKS.length - 1, this.level - 1)]; }
  add(xp, reason) {
    if (xp <= 0) return; const before = this.level; this.p.xp += Math.round(xp); this.save();
    if (reason) this.popup(`+${Math.round(xp)} XP`, reason);
    const after = this.level; if (after > before) { this.onLevel?.(after, this.rank); if (after >= 5) this.unlock('lvl5'); if (after >= 10) this.unlock('lvl10'); }
    this.render();
  }
  unlock(id) {
    if (this.p.ach[id]) return false; const a = ACHIEVEMENTS.find((x) => x.id === id); if (!a) return false;
    this.p.ach[id] = Date.now(); this.save();
    const el = document.createElement('div'); el.className = 'glass achv'; el.innerHTML = `<span>${a.icon}</span><div><small>SUCCÈS DÉBLOQUÉ</small><b>${a.name}</b><em>${a.desc}${a.xp ? ' · +' + a.xp + ' XP' : ''}</em></div>`;
    $('#achvStack').append(el); setTimeout(() => el.classList.add('out'), 4200); setTimeout(() => el.remove(), 4800);
    if (a.xp) setTimeout(() => this.add(a.xp), 300);
    return true;
  }
  popup(big, small) {
    const el = document.createElement('div'); el.className = 'xpPop'; el.innerHTML = `<b>${big}</b> ${small}`;
    $('#xpPops').append(el); setTimeout(() => el.remove(), 2600);
  }
  render() {
    const lv = this.level, a = xpForLevel(lv), b = xpForLevel(lv + 1), f = (this.p.xp - a) / (b - a);
    if ($('#xpLvl')) { $('#xpLvl').textContent = lv; $('#xpRank').textContent = this.rank; $('#xpFill').style.width = (f * 100).toFixed(1) + '%'; $('#xpTxt').textContent = `${this.p.xp - a} / ${b - a} XP`; }
  }
}
