import { DIRS, add, dirIndex, disk, dist, eq, hex, key, line, neighbors } from './hex'
import type { Hex } from './hex'
import { CLASSES, MOBS, SPELLS } from './content'
import type {
  Action, ActionResult, BaseStats, CombatState, Effect, EffectTarget, Element, GameEvent, SpellDef,
  StatKey, StatMap, StatusDef, Team, Unit,
} from './types'

// ======================================================================
//  Contexte d'exécution
//  avg = true : mode "prévision" (valeurs moyennes, pas de crit) utilisé
//  par l'IA et par l'aperçu du client. Même code que le vrai combat.
// ======================================================================

interface Ctx {
  s: CombatState
  ev: GameEvent[]
  avg: boolean
}

export const cloneState = (s: CombatState): CombatState => structuredClone(s)

function rand(s: CombatState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0
  let t = s.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const randInt = (c: Ctx, min: number, max: number): number =>
  c.avg ? (min + max) / 2 : min + Math.floor(rand(c.s) * (max - min + 1))

// ======================================================================
//  Accès
// ======================================================================

export const getUnit = (s: CombatState, id: string): Unit => {
  const u = s.units.find((x) => x.id === id)
  if (!u) throw new Error(`unité inconnue ${id}`)
  return u
}
export const activeUnit = (s: CombatState): Unit => getUnit(s, s.activeId)
export const aliveUnits = (s: CombatState): Unit[] => s.units.filter((u) => u.alive)
export const unitAt = (s: CombatState, h: Hex): Unit | undefined =>
  s.units.find((u) => u.alive && eq(u.pos, h))
export const inGrid = (s: CombatState, h: Hex): boolean => dist(h, hex(0, 0)) <= s.radius
export const isBlocked = (s: CombatState, h: Hex): boolean => s.blocked.includes(key(h))
export const isFree = (s: CombatState, h: Hex): boolean =>
  inGrid(s, h) && !isBlocked(s, h) && !unitAt(s, h)
export const allGridCells = (s: CombatState): Hex[] => disk(hex(0, 0), s.radius)

function modSum(u: Unit, field: 'power' | 'res', k: StatKey): number {
  let v = 0
  for (const st of u.statuses) v += st.mods?.[field]?.[k] ?? 0
  return v
}
/** Puissance effective (stat de base + statuts) pour un élément ou 'heal'. */
export function power(u: Unit, k: StatKey): number {
  const m = u.stats.power
  return (m[k] ?? 0) + (m.all ?? 0) + modSum(u, 'power', k) + modSum(u, 'power', 'all')
}
export function resist(u: Unit, el: Element): number {
  const m = u.stats.res
  const v = (m[el] ?? 0) + (m.all ?? 0) + modSum(u, 'res', el) + modSum(u, 'res', 'all')
  return Math.max(-100, Math.min(80, v))
}
function modSumTurn(u: Unit, f: 'ap' | 'mp'): number {
  let v = 0
  for (const st of u.statuses) v += st.mods?.[f] ?? 0
  return v
}

// ======================================================================
//  Déplacements
// ======================================================================

export interface Reach {
  cost: number
  prev: string | null
}

/** Cases atteignables par `unit` depuis `from` avec `mp` PM (on ne traverse ni obstacles ni unités). */
export function reachable(s: CombatState, unit: Unit, from: Hex = unit.pos, mp: number = unit.mp): Map<string, Reach> {
  const out = new Map<string, Reach>()
  out.set(key(from), { cost: 0, prev: null })
  let frontier: Hex[] = [from]
  for (let step = 1; step <= mp; step++) {
    const next: Hex[] = []
    for (const h of frontier) {
      for (const n of neighbors(h)) {
        const k = key(n)
        if (out.has(k)) continue
        if (!isFree(s, n) && !(eq(n, unit.pos) && !eq(from, unit.pos))) continue
        out.set(k, { cost: step, prev: key(h) })
        next.push(n)
      }
    }
    frontier = next
  }
  return out
}

export function pathFrom(reach: Map<string, Reach>, to: Hex): Hex[] | null {
  let k: string | null = key(to)
  if (!reach.has(k)) return null
  const rev: Hex[] = []
  while (k) {
    const [q, r] = k.split(',').map(Number)
    rev.push({ q, r })
    k = reach.get(k)!.prev
  }
  return rev.reverse() // inclut la case de départ
}

// ======================================================================
//  Sorts : portée, ligne de vue, zone
// ======================================================================

export function hasLineOfSight(s: CombatState, a: Hex, b: Hex): boolean {
  const cells = line(a, b)
  for (let i = 1; i < cells.length - 1; i++) if (isBlocked(s, cells[i])) return false
  return true
}

export function canCast(u: Unit, sp: SpellDef): boolean {
  if (!u.alive || u.ap < sp.cost) return false
  if ((u.cooldowns[sp.id] ?? 0) > 0) return false
  if (sp.perTurn && (u.casts[sp.id] ?? 0) >= sp.perTurn) return false
  return true
}

export function isValidTarget(s: CombatState, u: Unit, sp: SpellDef, cell: Hex, from: Hex = u.pos): boolean {
  if (!inGrid(s, cell)) return false
  if (sp.target === 'self') return eq(cell, from)
  const d = dist(from, cell)
  if (d < sp.rangeMin || d > sp.rangeMax) return false
  if (sp.los && !hasLineOfSight(s, from, cell)) return false
  const t = unitAt(s, cell)
  switch (sp.target) {
    case 'cell':
      return !t && !isBlocked(s, cell)
    case 'enemy':
      return !!t && t.team !== u.team
    case 'ally':
      return !!t && t.team === u.team
    case 'any':
      return !isBlocked(s, cell)
  }
}

export function castableCells(s: CombatState, u: Unit, sp: SpellDef, from: Hex = u.pos): Hex[] {
  if (sp.target === 'self') return [from]
  return disk(from, sp.rangeMax).filter((c) => isValidTarget(s, u, sp, c, from))
}

export function areaCells(s: CombatState, sp: SpellDef, casterPos: Hex, target: Hex): Hex[] {
  const center = sp.target === 'self' ? casterPos : target
  if (sp.area.shape === 'single') return [center]
  return disk(center, sp.area.radius).filter((c) => inGrid(s, c))
}

// ======================================================================
//  Dégâts / soins / mort
// ======================================================================

function pickTargets(c: Ctx, caster: Unit, to: EffectTarget, inArea: Unit[]): Unit[] {
  switch (to) {
    case 'self':
      return caster.alive ? [caster] : []
    case 'enemies':
      return inArea.filter((u) => u.alive && u.team !== caster.team)
    case 'allies':
      return inArea.filter((u) => u.alive && u.team === caster.team)
    case 'all':
      return inArea.filter((u) => u.alive)
  }
}

function dealDamage(c: Ctx, source: Unit | null, target: Unit, el: Element, base: number, mult = 1, fixed = false): number {
  if (!target.alive) return 0
  let amount = base
  let crit = false
  if (!fixed) {
    const p = source ? power(source, el) : 0
    const r = resist(target, el)
    amount = base * (1 + p / 100) * (1 - r / 100) * mult
    if (source && !c.avg && rand(c.s) * 100 < source.stats.crit) {
      crit = true
      amount *= 1.25
    }
    amount = Math.max(0, Math.floor(amount))
  } else amount = Math.floor(amount)
  const absorbed = Math.min(target.shield, amount)
  target.shield -= absorbed
  target.hp -= amount - absorbed
  c.ev.push({ t: 'damage', unit: target.id, amount, element: el, crit, hp: Math.max(0, target.hp), shield: target.shield, source: source?.id })
  if (target.hp <= 0) kill(c, target)
  return amount
}

function kill(c: Ctx, u: Unit): void {
  if (!u.alive) return
  u.alive = false
  u.hp = 0
  u.shield = 0
  c.ev.push({ t: 'death', unit: u.id })
}

function heal(c: Ctx, source: Unit | null, target: Unit, base: number): void {
  if (!target.alive) return
  const p = source ? power(source, 'heal') : 0
  const amount = Math.max(0, Math.floor(base * (1 + p / 100)))
  const real = Math.min(amount, target.stats.maxHp - target.hp)
  target.hp += real
  c.ev.push({ t: 'heal', unit: target.id, amount: real, hp: target.hp })
}

const COLLISION = 6 // dégâts par case restante lors d'une collision

function pushUnit(c: Ctx, caster: Unit, target: Unit, origin: Hex, n: number): void {
  if (!target.alive || n === 0) return
  const start = target.pos
  let o = origin
  if (eq(o, start)) o = caster.pos
  if (eq(o, start)) return
  let di = dirIndex(o, start)
  if (n < 0) di = (di + 3) % 6 // attirer = aller vers l'origine
  const d = DIRS[di]
  let cur = start
  const steps = Math.abs(n)
  for (let i = 0; i < steps; i++) {
    const nxt = add(cur, d)
    const other = unitAt(c.s, nxt)
    const wall = !inGrid(c.s, nxt) || isBlocked(c.s, nxt)
    if (wall || other) {
      if (n > 0) {
        const dmg = COLLISION * (steps - i)
        dealDamage(c, null, target, 'neutral', dmg, 1, true)
        if (other) dealDamage(c, null, other, 'neutral', dmg, 1, true)
      }
      break
    }
    cur = nxt
  }
  if (!eq(cur, start) && target.alive) {
    target.pos = cur
    c.ev.push({ t: 'push', unit: target.id, from: start, to: cur })
  }
}

function applyStatus(c: Ctx, source: Unit, target: Unit, def: StatusDef): void {
  if (!target.alive) return
  target.statuses = target.statuses.filter((x) => x.id !== def.id)
  target.statuses.push({ ...structuredClone(def), source: source.id })
  c.ev.push({ t: 'status', unit: target.id, status: def.id, name: def.name, kind: def.kind, applied: true })
}

// ======================================================================
//  Lancer un sort (sans validation : voir validateCast)
// ======================================================================

function runCast(c: Ctx, caster: Unit, sp: SpellDef, cell: Hex): void {
  c.ev.push({ t: 'cast', unit: caster.id, spell: sp.id, cell })
  const cells = areaCells(c.s, sp, caster.pos, cell)
  const center = sp.target === 'self' ? caster.pos : cell
  const originalPos = caster.pos
  const inArea = cells.map((h) => unitAt(c.s, h)).filter((u): u is Unit => !!u)
  const falloffOn = sp.area.shape === 'circle' && !!sp.area.falloff

  for (const e of sp.effects) {
    runEffect(c, caster, sp, e, inArea, center, cell, originalPos, falloffOn)
    if (!caster.alive) break
  }
}

function runEffect(
  c: Ctx, caster: Unit, sp: SpellDef, e: Effect, inArea: Unit[],
  center: Hex, cell: Hex, originalPos: Hex, falloffOn: boolean,
): void {
  if (e.type === 'teleport') {
    const from = caster.pos
    caster.pos = cell
    c.ev.push({ t: 'teleport', unit: caster.id, from, to: cell })
    return
  }
  const targets = pickTargets(c, caster, e.to, inArea)
  // ordre : les plus proches de l'origine d'abord (pour les poussées en file)
  const ref = sp.area.shape === 'circle' ? center : originalPos
  targets.sort((a, b) => dist(a.pos, ref) - dist(b.pos, ref))
  for (const t of targets) {
    const fall = falloffOn && e.to !== 'self' ? Math.max(0.4, 1 - 0.2 * dist(center, t.pos)) : 1
    switch (e.type) {
      case 'damage': {
        const dealt = dealDamage(c, caster, t, e.element, randInt(c, e.min, e.max), fall)
        if (e.lifesteal && dealt > 0 && caster.alive) heal(c, null, caster, (dealt * e.lifesteal) / 100)
        break
      }
      case 'heal':
        heal(c, caster, t, randInt(c, e.min, e.max) * fall)
        break
      case 'shield':
        t.shield += e.amount
        c.ev.push({ t: 'shield', unit: t.id, amount: e.amount, shield: t.shield })
        break
      case 'push': {
        const origin = sp.area.shape === 'circle' ? center : originalPos
        pushUnit(c, caster, t, origin, e.dist)
        break
      }
      case 'status':
        applyStatus(c, caster, t, e.status)
        break
    }
  }
}

// ======================================================================
//  Tours
// ======================================================================

function startTurn(c: Ctx, u: Unit): void {
  u.casts = {}
  for (const k of Object.keys(u.cooldowns)) {
    u.cooldowns[k] = Math.max(0, u.cooldowns[k] - 1)
    if (u.cooldowns[k] === 0) delete u.cooldowns[k]
  }
  // dégâts sur la durée
  for (const st of [...u.statuses]) {
    if (!st.dot || !u.alive) continue
    const src = c.s.units.find((x) => x.id === st.source) ?? null
    dealDamage(c, src && src.alive ? src : null, u, st.dot.element, randInt(c, st.dot.min, st.dot.max))
  }
  if (!u.alive) return
  u.ap = Math.max(0, u.stats.ap + modSumTurn(u, 'ap'))
  u.mp = Math.max(0, u.stats.mp + modSumTurn(u, 'mp'))
  // décompte et expiration (après avoir appliqué les modificateurs)
  for (const st of [...u.statuses]) {
    st.turns -= 1
    if (st.turns <= 0) {
      u.statuses = u.statuses.filter((x) => x !== st)
      c.ev.push({ t: 'status', unit: u.id, status: st.id, name: st.name, kind: st.kind, applied: false })
    }
  }
  c.ev.push({ t: 'turnStart', unit: u.id, round: c.s.round, ap: u.ap, mp: u.mp })
}

function checkOver(c: Ctx): boolean {
  if (c.s.phase === 'over') return true
  const p = c.s.units.some((u) => u.alive && u.team === 0)
  const m = c.s.units.some((u) => u.alive && u.team === 1)
  if (p && m) return false
  c.s.phase = 'over'
  c.s.winner = p ? 0 : 1
  c.ev.push({ t: 'gameOver', winner: c.s.winner })
  return true
}

function advanceTurn(c: Ctx): void {
  const s = c.s
  for (let guard = 0; guard < 1000; guard++) {
    if (checkOver(c)) return
    s.turnIdx += 1
    if (s.turnIdx >= s.order.length) {
      s.turnIdx = 0
      s.round += 1
    }
    s.activeId = s.order[s.turnIdx]
    const u = getUnit(s, s.activeId)
    if (!u.alive) continue
    startTurn(c, u)
    if (u.alive) {
      checkOver(c)
      return
    }
  }
}

// ======================================================================
//  API publique : validation + application
// ======================================================================

export function validateCast(s: CombatState, u: Unit, spellId: string, cell: Hex): string | null {
  const sp = SPELLS[spellId]
  if (!sp) return 'sort inconnu'
  if (!getDef(u).spells.includes(spellId)) return 'sort non possédé'
  if (!canCast(u, sp)) return 'sort indisponible (PA, délai ou limite par tour)'
  if (!isValidTarget(s, u, sp, cell)) return 'cible invalide'
  return null
}

function getDef(u: Unit) {
  return CLASSES[u.defId] ?? MOBS[u.defId]
}
export const spellsOf = (u: Unit): SpellDef[] => getDef(u).spells.map((id) => SPELLS[id])

/** Exécute le lancer sur l'état passé (muté). Utilisé par l'IA dans ses simulations. */
export function simulateCast(s: CombatState, unitId: string, spellId: string, cell: Hex, from?: Hex): GameEvent[] {
  const c: Ctx = { s, ev: [], avg: true }
  const u = getUnit(s, unitId)
  if (from) u.pos = from
  runCast(c, u, SPELLS[spellId], cell)
  return c.ev
}

export function applyAction(state: CombatState, action: Action): ActionResult {
  const s = cloneState(state)
  const c: Ctx = { s, ev: [], avg: false }
  if (s.phase !== 'fighting') return { state, events: [], error: 'combat terminé' }
  const u = activeUnit(s)

  switch (action.type) {
    case 'move': {
      const reach = reachable(s, u)
      const path = pathFrom(reach, action.to)
      if (!path || path.length < 2) return { state, events: [], error: 'déplacement impossible' }
      u.mp -= path.length - 1
      u.pos = path[path.length - 1]
      c.ev.push({ t: 'move', unit: u.id, path })
      break
    }
    case 'cast': {
      const err = validateCast(s, u, action.spell, action.cell)
      if (err) return { state, events: [], error: err }
      const sp = SPELLS[action.spell]
      u.ap -= sp.cost
      u.casts[sp.id] = (u.casts[sp.id] ?? 0) + 1
      if (sp.cooldown) u.cooldowns[sp.id] = sp.cooldown + 1 // +1 : décrémenté au début du prochain tour
      runCast(c, u, sp, action.cell)
      checkOver(c)
      if (s.phase === 'fighting' && !activeUnit(s).alive) advanceTurn(c)
      break
    }
    case 'endTurn':
      advanceTurn(c)
      break
  }
  return { state: s, events: c.ev }
}

// ======================================================================
//  Création du combat
// ======================================================================

export interface CombatSetup {
  seed: number
  radius?: number
  players: { id: string; name: string; classId: string }[]
  mobs: string[]
}

function makeUnit(id: string, defId: string, name: string, team: Team, owner: string | null, pos: Hex): Unit {
  const def = CLASSES[defId] ?? MOBS[defId]
  const stats: BaseStats = structuredClone(def.stats)
  return {
    id, defId, name, team, owner, pos, hp: stats.maxHp, shield: 0, alive: true, stats,
    ap: 0, mp: 0, statuses: [], cooldowns: {}, casts: {},
  }
}

export function createCombat(setup: CombatSetup): ActionResult {
  const radius = setup.radius ?? 5
  const s: CombatState = {
    phase: 'fighting', winner: null, rng: setup.seed | 0, radius, blocked: [], units: [],
    order: [], turnIdx: 0, round: 1, activeId: '',
  }
  const shuffle = <T,>(a: T[]): T[] => {
    const r = [...a]
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(rand(s) * (i + 1))
      ;[r[i], r[j]] = [r[j], r[i]]
    }
    return r
  }
  const cells = allGridCells(s)
  const left = shuffle(cells.filter((h) => h.q <= -3))
  const right = shuffle(cells.filter((h) => h.q >= 3))

  setup.players.forEach((p, i) => s.units.push(makeUnit(`p${i + 1}`, p.classId, p.name, 0, p.id, left[i])))
  setup.mobs.forEach((m, i) => {
    const def = MOBS[m]
    s.units.push(makeUnit(`m${i + 1}`, m, def.name, 1, null, right[i]))
  })

  // obstacles : environ 12% des cases libres, en gardant la grille connexe
  const occupied = new Set(s.units.map((u) => key(u.pos)))
  for (let attempt = 0; attempt < 50; attempt++) {
    const cand = shuffle(cells.filter((h) => !occupied.has(key(h)))).slice(0, Math.round(cells.length * 0.12))
    s.blocked = cand.map(key)
    if (isConnected(s)) break
    s.blocked = []
  }

  s.order = [...s.units]
    .sort((a, b) => b.stats.init - a.stats.init || a.id.localeCompare(b.id))
    .map((u) => u.id)
  s.turnIdx = 0
  s.activeId = s.order[0]
  const c: Ctx = { s, ev: [], avg: false }
  startTurn(c, activeUnit(s))
  return { state: s, events: c.ev }
}

function isConnected(s: CombatState): boolean {
  const free = allGridCells(s).filter((h) => !isBlocked(s, h))
  const seen = new Set<string>([key(free[0])])
  const stack = [free[0]]
  while (stack.length) {
    const h = stack.pop()!
    for (const n of neighbors(h)) {
      const k = key(n)
      if (!seen.has(k) && inGrid(s, n) && !isBlocked(s, n)) {
        seen.add(k)
        stack.push(n)
      }
    }
  }
  return seen.size === free.length
}

export type { StatMap }
