# ✈ AeroFlux Pro — Simulateur de vol 3D + Dashboard Power BI

100 % hors-ligne (Three.js embarqué, aucune dépendance npm) + multijoueur LAN.

## Lancer
Prérequis : [Node.js](https://nodejs.org) ≥ 18.
- Windows : double-clic sur `start.bat`
- macOS / Linux : `./start.sh` (ou `node server.js`)

Ouvrez `http://localhost:8080`. Pour le **multijoueur LAN**, les autres joueurs ouvrent l'adresse `http://IP-DU-PC:8080` affichée dans la console et choisissent « Multijoueur LAN » (autoriser le port 8080 dans le pare-feu).

## Commandes
| Action | Touches |
|---|---|
| Tangage | ↑/↓ ou Z/S (W/S) |
| Roulis | ←/→ ou Q/D |
| Lacet / direction au sol | A / E |
| Poussée | Maj / Ctrl, R / F, 0-9 |
| Train · Volets · Freins | G · V · B |
| Caméra (poursuite, cockpit, cinéma, tour, orbitale) | C + clic-glisser + molette |
| Widgets · Pause · Musique · Chat | H · P · N · T |

Manette supportée (Gamepad API).

## Atterrir (vs crasher)
Le toucher est évalué : train sorti, taux de chute < 1100 ft/min, inclinaison < 16°, assiette −7°…20°, sol praticable.
Note : Butter < 180 ft/min, Doux < 400, Correct < 700, Dur sinon. Bonus d'alignement sur l'axe.
Aides : PAPI (4 feux blancs/rouges), widget ILS (H), départ « Finale 5 km ».

## Contenu
- Île de 30×30 km : relief 513², textures détail multi-échelle + normal map, océan réfléchissant, ciel physique, nuages, 28 000 arbres instanciés, ville instanciée éclairée la nuit, aéroport (piste texturée 3,2 km, taxiway, tarmac, hangars, tour, balisage lumineux, manche à air).
- 3 avions détaillés : gouvernes animées, train rentrant, hélice/réacteurs, postcombustion, feux nav/strobe, phare d'atterrissage, livrées.
- Jour / Sunset / Nuit, qualité Perf / Haute / Ultra (bloom), mode cinéma 21:9, plein écran.
- 4 musiques génératives + sons moteur/vent/effets (Web Audio, hors-ligne).
- Dashboard analytique : KPIs animés, profil de vol live, trajectoire satellite, jauge G, phases, scores, qualité d'atterrissage, journal (stocké dans `data/flights.json`).
