# ⬡ Coplarpon

Prototype de jeu tactique au tour par tour sur **grille hexagonale** (rendu isométrique), dans l'esprit de Dofus / Wakfu, principalement PvE, multijoueur.

## Lancer

```bash
npm install

# Solo, tout dans le navigateur (aucun serveur nécessaire)
npm run dev:client          # http://localhost:5173

# Multijoueur : serveur autoritaire + clients
npm run dev:server          # ws://localhost:3001
npm run dev:client          # puis "Multijoueur" dans le menu

npm test                    # tests du moteur
npm run sim                 # l'IA joue les deux camps (équilibrage / détection de bugs)
npm run typecheck
```

## Architecture

```
packages/engine   Règles du jeu. TypeScript pur, sans I/O, déterministe. Partagé client + serveur.
  hex.ts          grille hex (axial/cube), distance, ligne, voisins
  combat.ts       état, tours, déplacements, sorts, effets, dégâts, statuts, victoire
  ai.ts           IA des monstres (IA d'utilité qui simule chaque coup avec le moteur)
  content/        DONNÉES : sorts, classes, monstres, rencontres (à étendre ici en priorité)
  protocol.ts     messages client <-> serveur
apps/server       WebSocket (ws) : valide les actions avec le moteur, fait jouer les monstres, diffuse
apps/client       Vite + PixiJS : rendu iso, HUD, aperçu des sorts, animations des événements
```

Principes :

- **Le moteur est une fonction pure** : `applyAction(state, action) -> { state, events }`.
  Le serveur est autoritaire ; le client réutilise le même code pour ses aperçus (portée, zone, dégâts prévus).
- **Événements** : le moteur émet des événements (`move`, `cast`, `damage`, `push`, `death`…).
  Le client les anime en séquence puis se recale sur l'état autoritaire.
- **Aléatoire avec graine** (`state.rng`) → combats rejouables, tests déterministes.
- **Mode prévision** : l'IA et l'aperçu au survol exécutent le *vrai* code de sorts en mode « valeurs moyennes ». Aucune règle n'est dupliquée.

## Règles du proto

- 4 éléments (🔥 feu, 💧 eau, 🪨 terre, 🌪️ air) + neutre (collisions).
  `dégâts = base × (1 + puissance%) × (1 − résistance%)`, résistance plafonnée à 80 %, coups critiques.
- PA (sorts) et PM (déplacement) par tour, ordre d'initiative, délais de relance, limite de lancers par tour.
- Effets : dégâts, soins, bouclier, poussée / attraction (+ dégâts de collision), téléportation, statuts (poison/brûlure = dégâts sur la durée, buffs/debuffs de stats, retrait PA/PM).
- Zones (cercle) avec dégâts décroissants, ligne de vue bloquée par les obstacles.
- 3 classes : Guerrier, Pyromancien, Prêtre. 4 monstres : Gelée, Gobelin archer, Ogre, Chaman. 4 rencontres.

## Commandes

Clic : se déplacer / cibler · `1-9` : sorts · `Espace` : fin du tour · clic droit / `Échap` : annuler.
