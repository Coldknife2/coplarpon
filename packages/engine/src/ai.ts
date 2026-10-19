// IA d'utilité : à chaque étape, on énumère (case de départ atteignable) x (sort) x (cible),
// on SIMULE le lancer avec le moteur (mode prévision) et on note le résultat.
// Aucune règle n'est dupliquée : l'IA voit exactement ce que verrait le vrai combat.

import { dist } from './hex'
import type { Hex } from './hex'
import { CLASSES, MOBS } from './content'
import {
  activeUnit, aliveUnits, applyAction, areaCells, canCast, castableCells, cloneState, getUnit,
  reachable, simulateCast, spellsOf, unitAt,
} from './combat'
import type { Action, AiProfile, CombatState, GameEvent, SpellDef, Unit } from './types'

const profileOf = (u: Unit): AiProfile => (MOBS[u.defId] ?? CLASSES[u.defId]).ai

/** Valeur d'un lancer = ce que gagne mon camp - ce qu'il perd (pv, morts, statuts). */
function scoreCast(s: CombatState, u: Unit, sp: SpellDef, cell: Hex, from: Hex): number {
  const sim = cloneState(s)
  const before = new Map(sim.units.map((x) => [x.id, { hp: x.hp + x.shield, alive: x.alive, st: x.statuses.length }]))
  simulateCast(sim, u.id, sp.id, cell, from)
  let score = 0
  for (const x of sim.units) {
    const b = before.get(x.id)!
    const delta = x.hp + x.shield - b.hp // < 0 : dégâts
    const isEnemy = x.team !== u.team
    if (isEnemy) {
      score += -delta // dégâts infligés
      if (b.alive && !x.alive) score += 25 + x.stats.maxHp * 0.1
      score += statusValue(x, b.st, true)
    } else {
      score += delta >= 0 ? delta * 0.9 : delta * 1.6 // soins vs tir ami
      if (b.alive && !x.alive) score -= x.id === u.id ? 120 : 40
      score += statusValue(x, b.st, false)
    }
  }
  return score
}

function statusValue(x: Unit, statusCountBefore: number, enemy: boolean): number {
  if (x.statuses.length <= statusCountBefore) return 0
  const st = x.statuses[x.statuses.length - 1]
  let v = 6
  if (st.dot) v += ((st.dot.min + st.dot.max) / 2) * st.turns * 0.7
  if (st.mods) {
    v += Math.abs(st.mods.ap ?? 0) * 5 + Math.abs(st.mods.mp ?? 0) * 4
    const p = Object.values(st.mods.power ?? {}).reduce((a, b) => a + b, 0)
    const r = Object.values(st.mods.res ?? {}).reduce((a, b) => a + b, 0)
    v += (p + r) * 0.15
  }
  return enemy === (st.kind === 'debuff') ? v : -v
}

/** Qualité d'une position selon le rôle du monstre (corps à corps, distance, soutien). */
function scorePosition(s: CombatState, u: Unit, at: Hex): number {
  const prof = profileOf(u)
  const enemies = aliveUnits(s).filter((x) => x.team !== u.team)
  if (!enemies.length) return 0
  const target =
    prof.targeting === 'weakest'
      ? enemies.reduce((a, b) => (a.hp < b.hp ? a : b))
      : enemies.reduce((a, b) => (dist(at, a.pos) <= dist(at, b.pos) ? a : b))
  const d = dist(at, target.pos)
  let sc = 0
  if (prof.role === 'melee') {
    sc = -2 * d + (d === 1 ? 3 : 0)
  } else {
    const [lo, hi] = prof.preferredRange ?? [3, 5]
    if (d < lo) sc = -(lo - d) * 3
    else if (d > hi) sc = -(d - hi) * 3
    else sc = 4
    const adjacent = enemies.filter((e) => dist(at, e.pos) <= 1).length
    sc -= adjacent * 3
    if (prof.role === 'support') {
      const allies = aliveUnits(s).filter((x) => x.team === u.team && x.id !== u.id)
      if (allies.length) {
        const avg = allies.reduce((a, x) => a + dist(at, x.pos), 0) / allies.length
        sc -= Math.max(0, avg - 3) * 1.5
      }
    }
  }
  return sc
}

interface Plan {
  score: number
  moveTo: Hex | null
  spell: string
  cell: Hex
}

function bestCast(s: CombatState, u: Unit): Plan | null {
  const reach = reachable(s, u)
  const spells = spellsOf(u).filter((sp) => canCast(u, sp) && sp.target !== 'cell')
  let best: Plan | null = null
  for (const [k, r] of reach) {
    const [q, rr] = k.split(',').map(Number)
    const from = { q, r: rr }
    const posBonus = scorePosition(s, u, from) * 0.6 - r.cost * 0.4
    for (const sp of spells) {
      for (const cell of castableCells(s, u, sp, from)) {
        // on ne simule que si une unité est dans la zone
        if (!areaCells(s, sp, from, cell).some((h) => unitAt(s, h))) continue
        const v = scoreCast(s, u, sp, cell, from)
        if (v <= 1) continue
        const total = v + posBonus
        if (!best || total > best.score) best = { score: total, moveTo: r.cost ? from : null, spell: sp.id, cell }
      }
    }
  }
  return best
}

function bestReposition(s: CombatState, u: Unit): Hex | null {
  const reach = reachable(s, u)
  let best: Hex | null = null
  let bestScore = scorePosition(s, u, u.pos) + 0.5
  for (const [k, r] of reach) {
    if (!r.cost) continue
    const [q, rr] = k.split(',').map(Number)
    const h = { q, r: rr }
    const sc = scorePosition(s, u, h) - r.cost * 0.1
    if (sc > bestScore) {
      bestScore = sc
      best = h
    }
  }
  return best
}

/** Prochaine action de l'unité active (suppose que c'est à elle de jouer). */
export function nextAiAction(s: CombatState, repositioned: { done: boolean }): Action {
  const u = activeUnit(s)
  const plan = bestCast(s, u)
  if (plan) {
    if (plan.moveTo) return { type: 'move', to: plan.moveTo }
    return { type: 'cast', spell: plan.spell, cell: plan.cell }
  }
  if (!repositioned.done) {
    repositioned.done = true
    const to = bestReposition(s, u)
    if (to) return { type: 'move', to }
  }
  return { type: 'endTurn' }
}

/** Joue un tour complet pour l'unité active. Renvoie l'état final et tous les événements. */
export function playAiTurn(state: CombatState): { state: CombatState; events: GameEvent[] } {
  let s = state
  const events: GameEvent[] = []
  const id = s.activeId
  const flag = { done: false }
  for (let i = 0; i < 25 && s.phase === 'fighting' && s.activeId === id; i++) {
    const action = nextAiAction(s, flag)
    const res = applyAction(s, action)
    if (res.error) {
      const end = applyAction(s, { type: 'endTurn' })
      s = end.state
      events.push(...end.events)
      break
    }
    s = res.state
    events.push(...res.events)
    if (action.type === 'endTurn') break
  }
  if (s.activeId === id && s.phase === 'fighting') {
    const end = applyAction(s, { type: 'endTurn' })
    s = end.state
    events.push(...end.events)
  }
  return { state: s, events }
}

/** Enchaîne les tours des monstres jusqu'à ce que ce soit à un joueur (ou fin du combat). */
export function playMobTurns(state: CombatState): { state: CombatState; events: GameEvent[] } {
  let s = state
  const events: GameEvent[] = []
  for (let i = 0; i < 50 && s.phase === 'fighting' && getUnit(s, s.activeId).team === 1; i++) {
    const r = playAiTurn(s)
    s = r.state
    events.push(...r.events)
  }
  return { state: s, events }
}
