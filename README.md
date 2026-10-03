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

## Nouveautés v2.3

### 🛠 Garage 3D
Bouton **Garage** (menu de départ ou barre du haut).
- Rotation (clic gauche), zoom (molette), déplacement (clic droit), ← → pour changer d'appareil, Échap pour fermer.
- Fiche technique : masse, poussée, surface alaire, V rotation, décrochage, longueur.
- Animations : train, volets, gouvernes, moteurs (hélice / postcombustion), plateau tournant.
- Points de vue : ensemble, nez, cockpit, aile, moteurs, train, empennage, dessus.
- Mode fil de fer + compteur maillages/triangles (utile pour améliorer les modèles).
- 8 livrées débloquées du niveau 1 au niveau 12.

### ⭐ Progression
- XP : décollage (+50), atterrissage (selon la note), temps de vol, +25 tous les 5 km, +300 en atterrissant sur un autre aéroport.
- Niveaux et grades, barre d'XP, succès (10 000 ft, 450 kt, butter, nuit, rase-mottes, 3 aéroports, 3 avions…).
- Fenêtre **Carrière** : statistiques et succès. Profil sauvegardé par indicatif (localStorage).

### 🎯 Missions
Anneaux, livraison, tour de piste, rase-vagues — objectif signalé sur le HUD (losange / flèche) et la mini-carte.

### Corrections
- Protection basse vitesse : impossible de cabrer près du décrochage.
- Vue tour : retour automatique en poursuite si la tour est à plus de 9 km.

## v2.4 — Aéroport international complet
- Piste 18/36 de 3 800 × 60 m avec accotements, feux d'axe, de bord, de seuil et rampes d'approche aux deux extrémités.
- Taxiway parallèle balisé (bleu/vert), 5 bretelles (A–E) avec panneaux et marquages de point d'attente, bretelles rapides.
- Tarmac béton de 3,5 km, terminal vitré au toit courbe, 4 jetées avec passerelles et avions de ligne stationnés (4 compagnies).
- Tour de contrôle de 72 m, radar tournant, hangars de maintenance, terminal fret et conteneurs, dépôt carburant, parking voitures, route d'accès, clôture.
- Les aéroports régionaux reçoivent une version plus compacte.
- Correction : la piste n'est plus recouverte par le sol (herbe) près de l'avion.
