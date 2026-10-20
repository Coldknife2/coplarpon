import type { SpellDef } from '../types'

const S = (s: SpellDef): [string, SpellDef] => [s.id, s]

export const SPELLS: Record<string, SpellDef> = Object.fromEntries([
  // ---------- Guerrier ----------
  S({
    id: 'estoc', name: 'Estoc', icon: '🗡️', cost: 3, rangeMin: 1, rangeMax: 1, los: false,
    target: 'enemy', area: { shape: 'single' },
    desc: "Coup d'épée puissant. Dégâts de terre, repousse de 1 case.",
    effects: [
      { type: 'damage', element: 'earth', min: 16, max: 20, to: 'enemies' },
      { type: 'push', dist: 1, to: 'enemies' },
    ],
  }),
  S({
    id: 'bond', name: 'Bond', icon: '🦘', cost: 2, rangeMin: 2, rangeMax: 4, los: false,
    target: 'cell', area: { shape: 'single' }, cooldown: 2,
    desc: 'Saute sur une case libre.',
    effects: [{ type: 'teleport' }],
  }),
  S({
    id: 'tourbillon', name: 'Tourbillon', icon: '🌀', cost: 4, rangeMin: 0, rangeMax: 0, los: false,
    target: 'self', area: { shape: 'circle', radius: 1 }, perTurn: 1,
    desc: 'Frappe tous les ennemis adjacents (feu) et les repousse.',
    effects: [
      { type: 'damage', element: 'fire', min: 12, max: 16, to: 'enemies' },
      { type: 'push', dist: 1, to: 'enemies' },
    ],
  }),
  S({
    id: 'garde', name: 'Garde', icon: '🛡️', cost: 2, rangeMin: 0, rangeMax: 0, los: false,
    target: 'self', area: { shape: 'single' }, cooldown: 3,
    desc: 'Bouclier de 25 PV et +20% de résistance à tout pendant 2 tours.',
    effects: [
      { type: 'shield', amount: 25, to: 'self' },
      {
        type: 'status', to: 'self',
        status: { id: 'garde', name: 'Garde', kind: 'buff', turns: 2, mods: { res: { all: 20 } } },
      },
    ],
  }),

  // ---------- Pyromancien ----------
  S({
    id: 'boule_de_feu', name: 'Boule de feu', icon: '🔥', cost: 4, rangeMin: 2, rangeMax: 7, los: true,
    target: 'any', area: { shape: 'circle', radius: 1, falloff: true },
    desc: 'Explosion de feu (zone 1, dégâts décroissants).',
    effects: [{ type: 'damage', element: 'fire', min: 17, max: 23, to: 'enemies' }],
  }),
  S({
    id: 'lance_de_givre', name: 'Lance de givre', icon: '❄️', cost: 3, rangeMin: 2, rangeMax: 6, los: true,
    target: 'enemy', area: { shape: 'single' },
    desc: "Dégâts d'eau et -1 PM au prochain tour.",
    effects: [
      { type: 'damage', element: 'water', min: 12, max: 16, to: 'enemies' },
      {
        type: 'status', to: 'enemies',
        status: { id: 'givre', name: 'Givre', kind: 'debuff', turns: 1, mods: { mp: -1 } },
      },
    ],
  }),
  S({
    id: 'embrasement', name: 'Embrasement', icon: '♨️', cost: 3, rangeMin: 1, rangeMax: 5, los: true,
    target: 'enemy', area: { shape: 'single' }, cooldown: 2,
    desc: 'Brûle la cible : 6-8 dégâts de feu par tour pendant 3 tours.',
    effects: [
      { type: 'damage', element: 'fire', min: 6, max: 8, to: 'enemies' },
      {
        type: 'status', to: 'enemies',
        status: { id: 'brulure', name: 'Brûlure', kind: 'debuff', turns: 3, dot: { element: 'fire', min: 6, max: 8 } },
      },
    ],
  }),
  S({
    id: 'meteore', name: 'Météore', icon: '☄️', cost: 6, rangeMin: 3, rangeMax: 7, los: false,
    target: 'any', area: { shape: 'circle', radius: 2, falloff: true }, cooldown: 4,
    desc: 'Bombardement massif (zone 2). Frappe aussi les alliés !',
    effects: [{ type: 'damage', element: 'fire', min: 32, max: 40, to: 'all' }],
  }),
  S({
    id: 'teleportation', name: 'Téléportation', icon: '✨', cost: 2, rangeMin: 1, rangeMax: 4, los: false,
    target: 'cell', area: { shape: 'single' }, cooldown: 2,
    desc: 'Se téléporte sur une case libre.',
    effects: [{ type: 'teleport' }],
  }),

  // ---------- Prêtre ----------
  S({
    id: 'rayon_sacre', name: 'Rayon sacré', icon: '☀️', cost: 3, rangeMin: 1, rangeMax: 6, los: true,
    target: 'enemy', area: { shape: 'single' },
    desc: "Dégâts d'air à distance.",
    effects: [{ type: 'damage', element: 'air', min: 12, max: 16, to: 'enemies' }],
  }),
  S({
    id: 'soin', name: 'Soin', icon: '💚', cost: 3, rangeMin: 0, rangeMax: 5, los: true,
    target: 'ally', area: { shape: 'single' },
    desc: 'Rend 20-26 PV à un allié (ou à soi).',
    effects: [{ type: 'heal', min: 20, max: 26, to: 'allies' }],
  }),
  S({
    id: 'benediction', name: 'Bénédiction', icon: '🙏', cost: 3, rangeMin: 0, rangeMax: 4, los: false,
    target: 'ally', area: { shape: 'single' }, cooldown: 3,
    desc: '+25% de dégâts et +15% de résistance pendant 3 tours.',
    effects: [
      {
        type: 'status', to: 'allies',
        status: { id: 'benediction', name: 'Bénédiction', kind: 'buff', turns: 3, mods: { power: { all: 25 }, res: { all: 15 } } },
      },
    ],
  }),
  S({
    id: 'chaine_aquatique', name: 'Chaîne aquatique', icon: '💧', cost: 3, rangeMin: 1, rangeMax: 5, los: true,
    target: 'enemy', area: { shape: 'single' }, cooldown: 2,
    desc: 'Eau : dégâts et -2 PA au prochain tour.',
    effects: [
      { type: 'damage', element: 'water', min: 8, max: 11, to: 'enemies' },
      {
        type: 'status', to: 'enemies',
        status: { id: 'entrave', name: 'Entravé', kind: 'debuff', turns: 1, mods: { ap: -2 } },
      },
    ],
  }),
  S({
    id: 'sanctuaire', name: 'Sanctuaire', icon: '⛪', cost: 5, rangeMin: 0, rangeMax: 0, los: false,
    target: 'self', area: { shape: 'circle', radius: 2 }, cooldown: 4,
    desc: 'Soigne les alliés proches de 14-18 PV et leur donne 10 PV de bouclier.',
    effects: [
      { type: 'heal', min: 14, max: 18, to: 'allies' },
      { type: 'shield', amount: 10, to: 'allies' },
    ],
  }),

  // ---------- Monstres ----------
  S({
    id: 'eclaboussure', name: 'Éclaboussure', icon: '💦', cost: 3, rangeMin: 1, rangeMax: 1, los: false,
    target: 'enemy', area: { shape: 'single' },
    desc: "Attaque d'eau au corps à corps.",
    effects: [{ type: 'damage', element: 'water', min: 9, max: 13, to: 'enemies' }],
  }),
  S({
    id: 'acide', name: 'Crachat acide', icon: '🧪', cost: 3, rangeMin: 1, rangeMax: 3, los: true,
    target: 'enemy', area: { shape: 'single' }, cooldown: 2,
    desc: 'Terre + poison (5 par tour, 2 tours).',
    effects: [
      { type: 'damage', element: 'earth', min: 4, max: 6, to: 'enemies' },
      {
        type: 'status', to: 'enemies',
        status: { id: 'poison', name: 'Poison', kind: 'debuff', turns: 2, dot: { element: 'earth', min: 5, max: 5 } },
      },
    ],
  }),
  S({
    id: 'tir_rapide', name: 'Tir rapide', icon: '🏹', cost: 3, rangeMin: 2, rangeMax: 6, los: true,
    target: 'enemy', area: { shape: 'single' },
    desc: "Flèche d'air.",
    effects: [{ type: 'damage', element: 'air', min: 11, max: 15, to: 'enemies' }],
  }),
  S({
    id: 'fleche_poison', name: 'Flèche empoisonnée', icon: '☠️', cost: 4, rangeMin: 2, rangeMax: 5, los: true,
    target: 'enemy', area: { shape: 'single' }, cooldown: 2,
    desc: 'Flèche + poison (4 par tour, 3 tours).',
    effects: [
      { type: 'damage', element: 'air', min: 6, max: 8, to: 'enemies' },
      {
        type: 'status', to: 'enemies',
        status: { id: 'poison', name: 'Poison', kind: 'debuff', turns: 3, dot: { element: 'earth', min: 4, max: 4 } },
      },
    ],
  }),
  S({
    id: 'massue', name: 'Coup de massue', icon: '🔨', cost: 4, rangeMin: 1, rangeMax: 1, los: false,
    target: 'enemy', area: { shape: 'single' },
    desc: 'Écrasant. Terre, repousse de 2 cases (dégâts de collision).',
    effects: [
      { type: 'damage', element: 'earth', min: 22, max: 28, to: 'enemies' },
      { type: 'push', dist: 2, to: 'enemies' },
    ],
  }),
  S({
    id: 'rugissement', name: 'Rugissement', icon: '😡', cost: 3, rangeMin: 0, rangeMax: 0, los: false,
    target: 'self', area: { shape: 'single' }, cooldown: 4,
    desc: '+30% de dégâts pendant 3 tours.',
    effects: [
      {
        type: 'status', to: 'self',
        status: { id: 'rage', name: 'Rage', kind: 'buff', turns: 3, mods: { power: { all: 30 } } },
      },
    ],
  }),
  S({
    id: 'secousse', name: 'Secousse', icon: '💥', cost: 5, rangeMin: 0, rangeMax: 0, los: false,
    target: 'self', area: { shape: 'circle', radius: 2 }, cooldown: 3,
    desc: 'Frappe le sol : terre (zone 2) et repousse de 1.',
    effects: [
      { type: 'damage', element: 'earth', min: 10, max: 14, to: 'enemies' },
      { type: 'push', dist: 1, to: 'enemies' },
    ],
  }),
  S({
    id: 'foudre', name: 'Foudre', icon: '⚡', cost: 4, rangeMin: 2, rangeMax: 5, los: true,
    target: 'enemy', area: { shape: 'single' },
    desc: "Éclair d'air.",
    effects: [{ type: 'damage', element: 'air', min: 14, max: 18, to: 'enemies' }],
  }),
  S({
    id: 'soin_chaman', name: 'Soin tribal', icon: '🌿', cost: 3, rangeMin: 0, rangeMax: 5, los: true,
    target: 'ally', area: { shape: 'single' },
    desc: 'Rend 12-16 PV.',
    effects: [{ type: 'heal', min: 12, max: 16, to: 'allies' }],
  }),
  S({
    id: 'totem_rage', name: 'Totem de rage', icon: '🪶', cost: 3, rangeMin: 0, rangeMax: 4, los: false,
    target: 'ally', area: { shape: 'single' }, cooldown: 3,
    desc: '+25% de dégâts de feu et de terre pendant 3 tours.',
    effects: [
      {
        type: 'status', to: 'allies',
        status: { id: 'totem', name: 'Totem', kind: 'buff', turns: 3, mods: { power: { fire: 25, earth: 25 } } },
      },
    ],
  }),
].map((s) => s as [string, SpellDef]))
