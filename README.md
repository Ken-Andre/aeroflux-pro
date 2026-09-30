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
| Piquer / cabrer | W (ou Z, ↑) / S (↓) — `I` pour inverser |
| Roulis | A / D (←/→) |
| Lacet / direction au sol | Q / E |
| Poussée | Shift / Ctrl (ou R / F / X, 0-9) |
| Freins | Espace (maintenir) · B frein de parc |
| Train · Volets | G · V |
| Caméra (poursuite, cockpit, cinéma, tour, orbitale) | C + clic-glisser + molette |
| Widgets · Chat · Pause · Musique | H · T · P · N |
| Assistance de vol ON/OFF | L |

> Chrome : Ctrl+W ferme l'onglet — pour réduire la poussée en piquant, utilisez F ou X.

**Assistance de vol (par défaut)** : ailes remises à plat automatiquement, tenue d'assiette, limites ±20°, protection décrochage et basse vitesse, compensation en virage. Désactivable avec `L` pour un vol libre.

**Décoller** : Shift jusqu'à 100 % → au message « ROTATION », maintenir S.
**Atterrir** : départ « Finale 5 km », train sorti, volets (V), réduire la poussée, suivre PAPI/ILS, taux de chute < 1100 ft/min.

## Monde
Île de 60 × 60 km : 3 aéroports, 5 villes, routes, lac, 3 parcs éoliens, cargos et bateaux, montagnes enneigées, couloirs d'approche dégagés.
