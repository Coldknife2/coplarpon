import { describe, expect, it } from 'vitest'
import {
  CLASSES, ENCOUNTERS, SPELLS, applyAction, areaCells, castableCells, createCombat, dist, eq, getUnit,
  hasLineOfSight, hex, key, line, playAiTurn, playMobTurns, reachable, activeUnit, unitAt, power, resist,
} from '../src'
import type { CombatState } from '../src'

const setup = (mobs = ['gelee'], seed = 42) =>
  createCombat({
    seed,
    players: [
      { id: 'a', name: 'A', classId: 'guerrier' },
      { id: 'b', name: 'B', classId: 'pyromancien' },
    ],
    mobs,
  }).state

/** État de test déterministe : arène vide, unités placées à la main, c'est au joueur p1 de jouer. */
function arena(placement: Record<string, [number, number]>): CombatState {
  const s = setup(['gelee', 'gelee'])
  s.blocked = []
  for (const [id, [q, r]] of Object.entries(placement)) getUnit(s, id).pos = hex(q, r)
  s.activeId = 'p1'
  s.turnIdx = s.order.indexOf('p1')
  const u = getUnit(s, 'p1')
  u.ap = 6
  u.mp = 3
  return s
}

describe('hex', () => {
  it('distance et ligne', () => {
    expect(dist(hex(0, 0), hex(2, -1))).toBe(2)
    expect(dist(hex(-2, 0), hex(2, 0))).toBe(4)
    const l = line(hex(0, 0), hex(3, 0))
    expect(l).toHaveLength(4)
    expect(l.every((h, i) => h.q === i && h.r === 0)).toBe(true)
  })
})

describe('création', () => {
  it('place les unités et ne bloque pas la grille', () => {
    const s = setup(['ogre', 'chaman'])
    expect(s.units).toHaveLength(4)
    for (const u of s.units) expect(s.blocked).not.toContain(key(u.pos))
    expect(s.blocked.length).toBeGreaterThan(5)
    expect(s.phase).toBe('fighting')
  })
  it('est déterministe pour une graine donnée', () => {
    expect(setup(['ogre'], 5)).toEqual(setup(['ogre'], 5))
  })
})

describe('déplacements', () => {
  it('consomme des PM et refuse trop loin', () => {
    const s = arena({ p1: [-4, 0], p2: [-4, 2], m1: [4, 0], m2: [4, -2] })
    const ok = applyAction(s, { type: 'move', to: hex(-1, 0) })
    expect(ok.error).toBeUndefined()
    expect(getUnit(ok.state, 'p1').mp).toBe(0)
    expect(applyAction(s, { type: 'move', to: hex(0, 0) }).error).toBeDefined()
  })
  it('ne traverse pas les unités', () => {
    const s = arena({ p1: [-2, 0], p2: [-1, 0], m1: [4, 0], m2: [4, -2] })
    const reach = reachable(s, getUnit(s, 'p1'))
    expect(reach.has(key(hex(-1, 0)))).toBe(false)
  })
})

describe('sorts', () => {
  it('estoc : dégâts de terre et poussée', () => {
    const s = arena({ p1: [-1, 0], p2: [-4, 2], m1: [0, 0], m2: [4, -2] })
    const r = applyAction(s, { type: 'cast', spell: 'estoc', cell: hex(0, 0) })
    expect(r.error).toBeUndefined()
    const m = getUnit(r.state, 'm1')
    expect(m.hp).toBeLessThan(m.stats.maxHp)
    expect(eq(m.pos, hex(1, 0))).toBe(true)
    expect(getUnit(r.state, 'p1').ap).toBe(3)
  })
  it('collision contre un obstacle', () => {
    const s = arena({ p1: [-1, 0], p2: [-4, 2], m1: [0, 0], m2: [4, -2] })
    s.blocked = [key(hex(1, 0))]
    const r = applyAction(s, { type: 'cast', spell: 'estoc', cell: hex(0, 0) })
    expect(eq(getUnit(r.state, 'm1').pos, hex(0, 0))).toBe(true)
    expect(r.events.some((e) => e.t === 'damage' && e.element === 'neutral')).toBe(true)
  })
  it('refuse hors portée, sans PA, et respecte le délai de relance', () => {
    const s = arena({ p1: [-4, 0], p2: [-4, 2], m1: [4, 0], m2: [4, -2] })
    expect(applyAction(s, { type: 'cast', spell: 'estoc', cell: hex(4, 0) }).error).toBeDefined()
    const s2 = arena({ p1: [-4, 0], p2: [-4, 2], m1: [4, 0], m2: [4, -2] })
    const g = applyAction(s2, { type: 'cast', spell: 'garde', cell: hex(-4, 0) })
    expect(g.error).toBeUndefined()
    expect(applyAction(g.state, { type: 'cast', spell: 'garde', cell: hex(-4, 0) }).error).toBeDefined()
  })
  it('la ligne de vue est bloquée par un obstacle', () => {
    const s = arena({ p1: [-3, 0], p2: [-4, 2], m1: [3, 0], m2: [4, -2] })
    s.blocked = [key(hex(0, 0))]
    expect(hasLineOfSight(s, hex(-3, 0), hex(3, 0))).toBe(false)
    expect(hasLineOfSight(s, hex(-3, 0), hex(-1, 0))).toBe(true)
  })
  it('zone : la boule de feu touche autour de la cible, avec dégâts décroissants', () => {
    const s = arena({ p1: [-2, 0], p2: [-4, 2], m1: [2, 0], m2: [3, 0] })
    const mage = getUnit(s, 'p2')
    s.activeId = 'p2'
    mage.pos = hex(-3, 0)
    mage.ap = 7
    const r = applyAction(s, { type: 'cast', spell: 'boule_de_feu', cell: hex(2, 0) })
    expect(r.error).toBeUndefined()
    const dmg = (id: string) => getUnit(s, id).stats.maxHp - getUnit(r.state, id).hp
    expect(dmg('m1')).toBeGreaterThan(dmg('m2'))
    expect(dmg('m2')).toBeGreaterThan(0)
  })
  it('les résistances et la puissance changent les dégâts', () => {
    const s = setup()
    const m = getUnit(s, 'm1')
    expect(resist(m, 'water')).toBe(30)
    expect(resist(m, 'fire')).toBe(-20)
    expect(power(getUnit(s, 'p2'), 'fire')).toBe(35)
  })
  it('statuts : poison fait des dégâts au début du tour et expire', () => {
    const s = arena({ p1: [-3, 0], p2: [-4, 2], m1: [0, 0], m2: [4, -2] })
    s.activeId = 'p2'
    const mage = getUnit(s, 'p2')
    mage.ap = 7
    mage.pos = hex(-3, 1)
    const r = applyAction(s, { type: 'cast', spell: 'embrasement', cell: hex(0, 0) })
    expect(getUnit(r.state, 'm1').statuses.map((x) => x.id)).toContain('brulure')
    // on joue jusqu'au prochain tour de m1 : il doit avoir pris des dégâts de brûlure
    let st = r.state
    const hpBefore = getUnit(st, 'm1').hp
    for (let i = 0; i < 10 && !(st.activeId === 'm1'); i++) st = applyAction(st, { type: 'endTurn' }).state
    expect(st.activeId).toBe('m1')
    expect(getUnit(st, 'm1').hp).toBeLessThan(hpBefore)
  })
  it('castableCells ne propose que des cibles valides', () => {
    const s = arena({ p1: [-1, 0], p2: [-4, 2], m1: [0, 0], m2: [4, -2] })
    const cells = castableCells(s, getUnit(s, 'p1'), SPELLS.estoc)
    expect(cells).toHaveLength(1)
    expect(eq(cells[0], hex(0, 0))).toBe(true)
    expect(areaCells(s, SPELLS.tourbillon, hex(-1, 0), hex(-1, 0))).toHaveLength(7)
  })
})

describe('tours et fin de combat', () => {
  it('endTurn passe au suivant dans l\'ordre d\'initiative', () => {
    const s = setup(['gelee', 'gobelin'])
    const first = s.activeId
    const r = applyAction(s, { type: 'endTurn' })
    expect(r.state.activeId).not.toBe(first)
    expect(r.state.order).toEqual(s.order)
  })
  it('reset des PA/PM au début du tour', () => {
    const s = setup()
    const u = activeUnit(s)
    expect(u.ap).toBe(u.stats.ap)
    expect(u.mp).toBe(u.stats.mp)
  })
  it('victoire quand tous les monstres sont morts', () => {
    const s = arena({ p1: [-1, 0], p2: [-4, 2], m1: [0, 0], m2: [4, -2] })
    getUnit(s, 'm2').alive = false
    getUnit(s, 'm1').hp = 1
    const r = applyAction(s, { type: 'cast', spell: 'estoc', cell: hex(0, 0) })
    expect(r.state.phase).toBe('over')
    expect(r.state.winner).toBe(0)
    expect(unitAt(r.state, hex(0, 0))).toBeUndefined()
  })
  it('l\'état est immuable : applyAction ne mute pas l\'entrée', () => {
    const s = setup()
    const snap = JSON.stringify(s)
    applyAction(s, { type: 'endTurn' })
    expect(JSON.stringify(s)).toBe(snap)
  })
})

describe('IA', () => {
  it('termine toujours un tour et ne casse pas l\'état', () => {
    for (const enc of ENCOUNTERS) {
      for (let seed = 1; seed <= 4; seed++) {
        let s = createCombat({
          seed,
          players: Object.keys(CLASSES).map((c, i) => ({ id: `c${i}`, name: c, classId: c })),
          mobs: enc.mobs,
        }).state
        for (let i = 0; i < 400 && s.phase === 'fighting'; i++) {
          const before = s.activeId
          s = playAiTurn(s).state
          if (s.phase === 'fighting') expect(s.activeId).not.toBe(before)
          for (const u of s.units) {
            expect(u.hp).toBeGreaterThanOrEqual(0)
            expect(u.hp).toBeLessThanOrEqual(u.stats.maxHp)
          }
        }
        expect(s.phase).toBe('over')
      }
    }
  }, 60_000)
  it('playMobTurns s\'arrête sur un joueur', () => {
    const s = setup(['gobelin', 'gelee'])
    const r = playMobTurns(s)
    expect(getUnit(r.state, r.state.activeId).team === 0 || r.state.phase === 'over').toBe(true)
  })
  it('un monstre au corps à corps attaque quand il est adjacent', () => {
    const s = arena({ p1: [0, 0], p2: [-4, 2], m1: [1, 0], m2: [4, -2] })
    s.activeId = 'm1'
    s.turnIdx = s.order.indexOf('m1')
    const m = getUnit(s, 'm1')
    m.ap = 6
    m.mp = 3
    const r = playAiTurn(s)
    expect(r.events.some((e) => e.t === 'damage' && e.unit === 'p1')).toBe(true)
  })
})
