import type { UnitDef } from '../types'


export const CLASSES: Record<string, UnitDef> = {
  guerrier: {
    id: 'guerrier', name: 'Guerrier', color: '#c0562f',
    stats: { maxHp: 130, ap: 6, mp: 3, init: 40, power: { earth: 15, fire: 10 }, res: { earth: 15 }, crit: 5 },
    spells: ['estoc', 'bond', 'tourbillon', 'garde'],
    ai: { role: 'melee', targeting: 'nearest' },
  },
  pyromancien: {
    id: 'pyromancien', name: 'Pyromancien', color: '#8a4fd6',
    stats: { maxHp: 85, ap: 7, mp: 3, init: 55, power: { fire: 35, water: 15 }, res: { fire: 15 }, crit: 8 },
    spells: ['boule_de_feu', 'lance_de_givre', 'embrasement', 'meteore', 'teleportation'],
    ai: { role: 'ranged', preferredRange: [4, 6], targeting: 'weakest' },
  },
  pretre: {
    id: 'pretre', name: 'Prêtre', color: '#e8c24a',
    stats: { maxHp: 100, ap: 6, mp: 3, init: 50, power: { air: 20, water: 15, heal: 25 }, res: { air: 10, water: 10 }, crit: 5 },
    spells: ['rayon_sacre', 'soin', 'benediction', 'chaine_aquatique', 'sanctuaire'],
    ai: { role: 'support', preferredRange: [3, 5], targeting: 'weakest' },
  },
}

export const MOBS: Record<string, UnitDef> = {
  gelee: {
    id: 'gelee', name: 'Gelée', color: '#4fb0e8',
    stats: { maxHp: 100, ap: 6, mp: 3, init: 20, power: { water: 25 }, res: { water: 30, fire: -20 }, crit: 3 },
    spells: ['eclaboussure', 'acide'],
    ai: { role: 'melee', targeting: 'nearest' },
  },
  gobelin: {
    id: 'gobelin', name: 'Gobelin archer', color: '#6fae3c',
    stats: { maxHp: 75, ap: 6, mp: 4, init: 65, power: { air: 30 }, res: { air: 15, earth: -10 }, crit: 10 },
    spells: ['tir_rapide', 'fleche_poison'],
    ai: { role: 'ranged', preferredRange: [4, 5], targeting: 'weakest' },
  },
  ogre: {
    id: 'ogre', name: 'Ogre', color: '#a0703a',
    stats: { maxHp: 280, ap: 7, mp: 3, init: 10, power: { earth: 35 }, res: { earth: 25, air: -15 }, crit: 5 },
    spells: ['massue', 'secousse', 'rugissement'],
    ai: { role: 'melee', targeting: 'weakest' },
  },
  chaman: {
    id: 'chaman', name: 'Chaman', color: '#d44a6a',
    stats: { maxHp: 110, ap: 7, mp: 3, init: 45, power: { air: 30, heal: 20 }, res: { fire: 10 }, crit: 5 },
    spells: ['soin_chaman', 'totem_rage', 'foudre'],
    ai: { role: 'support', preferredRange: [3, 5], targeting: 'weakest' },
  },
}

export interface Encounter {
  id: string
  name: string
  desc: string
  mobs: string[]
}

export const ENCOUNTERS: Encounter[] = [
  { id: 'clairiere', name: 'La clairière', desc: "2 gelées et un gobelin archer. Pour s'échauffer.", mobs: ['gelee', 'gelee', 'gobelin'] },
  { id: 'embuscade', name: 'Embuscade', desc: '2 gobelins archers et un chaman.', mobs: ['gobelin', 'gobelin', 'chaman'] },
  { id: 'antre', name: "L'antre de l'ogre", desc: 'Un ogre, son chaman et une gelée.', mobs: ['ogre', 'chaman', 'gelee'] },
  { id: 'horde', name: 'La horde', desc: 'Ogre, chaman, gobelin et gelée. Bon courage.', mobs: ['ogre', 'chaman', 'gobelin', 'gelee'] },
]

