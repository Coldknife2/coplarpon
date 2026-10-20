import type { Hex } from './hex'

export type Element = 'neutral' | 'fire' | 'water' | 'earth' | 'air'
export const ELEMENTS: Element[] = ['fire', 'water', 'earth', 'air']
export type Team = 0 | 1 // 0 = joueurs, 1 = monstres

/** Clés pour power / res : un élément, 'all' (tous), 'heal' (soins uniquement, power). */
export type StatKey = Element | 'all' | 'heal'
export type StatMap = Partial<Record<StatKey, number>>

export interface BaseStats {
  maxHp: number
  ap: number // PA
  mp: number // PM
  init: number
  power: StatMap // % de dégâts en plus
  res: StatMap // % de résistance (plafonnée à 80)
  crit: number // % de chance de coup critique
}

export interface StatusMods {
  ap?: number
  mp?: number
  power?: StatMap
  res?: StatMap
}

export interface StatusDef {
  id: string
  name: string
  kind: 'buff' | 'debuff'
  turns: number // nombre de débuts de tour du porteur pendant lesquels il agit
  dot?: { element: Element; min: number; max: number }
  mods?: StatusMods
}

export interface Status extends StatusDef {
  source: string
}

// ---------- Sorts ----------

export type EffectTarget = 'enemies' | 'allies' | 'all' | 'self'

export type Effect =
  | { type: 'damage'; element: Element; min: number; max: number; to: EffectTarget; lifesteal?: number }
  | { type: 'heal'; min: number; max: number; to: EffectTarget }
  | { type: 'shield'; amount: number; to: EffectTarget }
  /** n > 0 : repousse (loin de l'origine) ; n < 0 : attire. */
  | { type: 'push'; dist: number; to: EffectTarget }
  | { type: 'status'; status: StatusDef; to: EffectTarget }
  /** Le lanceur se déplace sur la case ciblée. */
  | { type: 'teleport' }

export interface SpellDef {
  id: string
  name: string
  icon: string
  desc: string
  cost: number
  rangeMin: number
  rangeMax: number
  los: boolean
  /** Ce que la case ciblée doit contenir. 'self' = le lanceur lui-même. */
  target: 'enemy' | 'ally' | 'any' | 'cell' | 'self'
  area: { shape: 'single' } | { shape: 'circle'; radius: number; falloff?: boolean }
  cooldown?: number
  perTurn?: number
  effects: Effect[]
}

// ---------- Contenu ----------

export interface AiProfile {
  role: 'melee' | 'ranged' | 'support'
  preferredRange?: [number, number]
  targeting: 'nearest' | 'weakest'
}

export interface UnitDef {
  id: string
  name: string
  color: string
  stats: BaseStats
  spells: string[]
  ai: AiProfile
}

// ---------- État du combat ----------

export interface Unit {
  id: string
  defId: string
  name: string
  team: Team
  /** id du client qui contrôle l'unité (null = IA). */
  owner: string | null
  pos: Hex
  hp: number
  shield: number
  alive: boolean
  stats: BaseStats
  ap: number
  mp: number
  statuses: Status[]
  cooldowns: Record<string, number>
  casts: Record<string, number>
}

export interface CombatState {
  phase: 'fighting' | 'over'
  winner: Team | null
  rng: number
  radius: number
  blocked: string[] // clés des cases obstacles
  units: Unit[]
  order: string[]
  turnIdx: number
  round: number
  activeId: string
}

export type Action =
  | { type: 'move'; to: Hex }
  | { type: 'cast'; spell: string; cell: Hex }
  | { type: 'endTurn' }

export type GameEvent =
  | { t: 'turnStart'; unit: string; round: number; ap: number; mp: number }
  | { t: 'move'; unit: string; path: Hex[] }
  | { t: 'cast'; unit: string; spell: string; cell: Hex }
  | { t: 'damage'; unit: string; amount: number; element: Element; crit: boolean; hp: number; shield: number; source?: string }
  | { t: 'heal'; unit: string; amount: number; hp: number }
  | { t: 'shield'; unit: string; amount: number; shield: number }
  | { t: 'push'; unit: string; from: Hex; to: Hex }
  | { t: 'teleport'; unit: string; from: Hex; to: Hex }
  | { t: 'status'; unit: string; status: string; name: string; kind: 'buff' | 'debuff'; applied: boolean }
  | { t: 'death'; unit: string }
  | { t: 'gameOver'; winner: Team }

export interface ActionResult {
  state: CombatState
  events: GameEvent[]
  error?: string
}
