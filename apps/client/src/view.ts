// Scène isométrique (PixiJS). Ne contient AUCUNE règle de jeu : elle dessine un état
// et anime des événements envoyés par le moteur.
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { SPELLS, allGridCells, dist, eq, hex, key } from '@coplarpon/engine'
import type { CombatState, Element, GameEvent, Hex, Unit } from '@coplarpon/engine'
import { loadSprites } from './art'

const S = 40 // rayon d'un hex (px, avant zoom)
const SQ = 0.56 // aplatissement vertical (vue isométrique)
const TILE_H = 9 // épaisseur du sol
const SQRT3 = Math.sqrt(3)

export const ELEMENT_COLORS: Record<Element, number> = {
  neutral: 0xdddddd, fire: 0xff7a2a, water: 0x4aa8ff, earth: 0xb98a4a, air: 0xb6f0ff,
}

export interface OverlayItem {
  h: Hex
  fill: number
  alpha: number
  stroke?: number
}
export interface Floater {
  unit: string
  text: string
  color: number
}

interface UnitView {
  id: string
  root: Container
  body: Container
  sprite: Sprite
  hpBar: Graphics
  label: Text
  hex: Hex
  hp: number
  maxHp: number
  shield: number
  alive: boolean
  team: number
  floating: number // décalage vertical d'animation
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class Scene {
  app!: Application
  private world = new Container()
  private tilesLayer = new Container()
  private overlay = new Graphics()
  private entities = new Container()
  private fx = new Container()
  private previews = new Container()
  private tiles = new Map<string, Graphics>()
  private units = new Map<string, UnitView>()
  private sprites: Record<string, HTMLCanvasElement> = {}
  private textures = new Map<string, Texture>()
  private radius = 5
  private activeId = ''
  private t = 0
  speed = 1

  async init(host: HTMLElement) {
    this.app = new Application()
    await this.app.init({
      resizeTo: window, background: 0x15161f, antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
    })
    host.appendChild(this.app.canvas)
    this.sprites = await loadSprites()
    this.world.addChild(this.tilesLayer, this.overlay, this.entities, this.previews, this.fx)
    this.entities.sortableChildren = true
    this.app.stage.addChild(this.world)
    window.addEventListener('resize', () => this.fit())
    this.app.ticker.add((tk) => {
      this.t += tk.deltaMS / 1000
      this.idle()
    })
  }

  // ---------- projection ----------
  project(h: Hex): { x: number; y: number } {
    return { x: S * 1.5 * h.q, y: S * SQRT3 * (h.r + h.q / 2) * SQ }
  }
  /** Pixel écran (client) -> hex. */
  pick(clientX: number, clientY: number): Hex {
    const rect = this.app.canvas.getBoundingClientRect()
    const x = ((clientX - rect.left - this.world.x) / this.world.scale.x) / S
    const y = ((clientY - rect.top - this.world.y) / this.world.scale.y) / (S * SQ)
    const q = (2 / 3) * x
    const r = y / SQRT3 - q / 2
    return cubeRound(q, r)
  }
  /** Position écran (client) d'une unité, pour placer des infobulles. */
  screenOf(h: Hex): { x: number; y: number } {
    const p = this.project(h)
    const rect = this.app.canvas.getBoundingClientRect()
    return { x: rect.left + this.world.x + p.x * this.world.scale.x, y: rect.top + this.world.y + p.y * this.world.scale.y }
  }

  fit() {
    const w = this.app.screen.width
    const h = this.app.screen.height
    const gw = (this.radius * 2 + 1.6) * 1.5 * S + S
    const gh = (this.radius * 2 + 2) * SQRT3 * S * SQ + 140
    const sc = Math.min(w / gw, (h - 230) / gh, 1.7)
    this.world.scale.set(sc)
    this.world.x = w / 2
    this.world.y = h / 2 - 20
  }

  // ---------- construction ----------
  private polyPoints(cx: number, cy: number, r = S): number[] {
    const pts: number[] = []
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i
      pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a) * SQ)
    }
    return pts
  }

  private drawTile(g: Graphics, h: Hex, blocked: boolean) {
    const { x, y } = this.project(h)
    const shade = ((h.q - h.r) % 3 + 3) % 3
    const top = [0x4f8a3c, 0x558f40, 0x4a8438][shade]
    const side = 0x2f5a27
    const pts = this.polyPoints(x, y)
    // flancs (sous les 3 arêtes basses)
    for (let i = 0; i < 3; i++) {
      const j = i
      const a = [pts[j * 2], pts[j * 2 + 1]]
      const b = [pts[((j + 1) % 6) * 2], pts[((j + 1) % 6) * 2 + 1]]
      g.poly([a[0], a[1], b[0], b[1], b[0], b[1] + TILE_H, a[0], a[1] + TILE_H]).fill(i === 1 ? side : 0x38682d)
    }
    g.poly(pts).fill(blocked ? 0x4a7a3a : top).stroke({ width: 1, color: 0x2c5a24, alpha: 0.6 })
  }

  private obstacle(h: Hex, variant: number): Container {
    const c = new Container()
    const g = new Graphics()
    const { x, y } = this.project(h)
    if (variant % 3 === 0) {
      // arbre
      g.ellipse(x, y + 4, 22, 9).fill({ color: 0, alpha: 0.25 })
      g.roundRect(x - 5, y - 30, 10, 36, 3).fill(0x6b4a2b)
      g.circle(x, y - 46, 24).fill(0x2f7a34)
      g.circle(x - 14, y - 36, 15).fill(0x3a8c3e)
      g.circle(x + 14, y - 38, 16).fill(0x2a6e2e)
      g.circle(x - 4, y - 56, 13).fill(0x4aa04c)
    } else {
      // rocher : prisme
      const H = 26 + (variant % 4) * 4
      const top = this.polyPoints(x, y - H, S * 0.78)
      const bot = this.polyPoints(x, y, S * 0.78)
      for (let i = 0; i < 3; i++) {
        const a = i
        const b = (i + 1) % 6
        g.poly([top[a * 2], top[a * 2 + 1], top[b * 2], top[b * 2 + 1], bot[b * 2], bot[b * 2 + 1], bot[a * 2], bot[a * 2 + 1]]).fill(i === 1 ? 0x5d6470 : 0x484e59)
      }
      g.poly(top).fill(0x8a919d).stroke({ width: 1.5, color: 0x3a3f48 })
      g.poly(this.polyPoints(x - 3, y - H - 1, S * 0.4)).fill({ color: 0xb3bac6, alpha: 0.7 })
    }
    c.addChild(g)
    c.zIndex = y + 1
    return c
  }

  private texture(defId: string): Texture {
    let t = this.textures.get(defId)
    if (!t) {
      t = Texture.from(this.sprites[defId])
      this.textures.set(defId, t)
    }
    return t
  }

  /** (Re)construit toute la scène depuis un état. */
  build(state: CombatState) {
    this.radius = state.radius
    this.tilesLayer.removeChildren()
    this.entities.removeChildren()
    this.tiles.clear()
    this.units.clear()
    const cells = allGridCells(state).sort((a, b) => this.project(a).y - this.project(b).y)
    cells.forEach((h) => {
      const g = new Graphics()
      this.drawTile(g, h, state.blocked.includes(key(h)))
      this.tilesLayer.addChild(g)
      this.tiles.set(key(h), g)
    })
    state.blocked.forEach((k, i) => {
      const [q, r] = k.split(',').map(Number)
      this.entities.addChild(this.obstacle(hex(q, r), (Math.abs(q * 7 + r * 3) + i) | 0))
    })
    state.units.forEach((u) => this.addUnit(u))
    this.sync(state)
    this.fit()
  }

  private addUnit(u: Unit) {
    const root = new Container()
    const body = new Container()
    const shadow = new Graphics().ellipse(0, 2, 22, 8).fill({ color: 0, alpha: 0.28 })
    const ring = new Graphics().ellipse(0, 2, 26, 10).stroke({ width: 3, color: u.team === 0 ? 0x4aa8ff : 0xff5a4a, alpha: 0.9 })
    const sprite = new Sprite(this.texture(u.defId))
    sprite.anchor.set(0.5, 0.93)
    sprite.scale.set(0.33) // canvas 220px de large -> ~72 px
    const hpBar = new Graphics()
    hpBar.y = -98
    const label = new Text({ text: '', style: { fontSize: 11, fill: 0xffffff, fontFamily: 'system-ui, sans-serif', fontWeight: '700', stroke: { color: 0x000000, width: 3 } } })
    label.anchor.set(0.5, 1)
    label.y = -102
    body.addChild(sprite)
    root.addChild(shadow, ring, body, hpBar, label)
    this.entities.addChild(root)
    this.units.set(u.id, {
      id: u.id, root, body, sprite, hpBar, label, hex: u.pos, hp: u.hp, maxHp: u.stats.maxHp,
      shield: u.shield, alive: u.alive, team: u.team, floating: 0,
    })
  }

  /** Cale la scène sur l'état autoritaire (fin d'animation). */
  sync(state: CombatState) {
    this.activeId = state.activeId
    for (const u of state.units) {
      const v = this.units.get(u.id)
      if (!v) continue
      v.hex = u.pos
      v.hp = u.hp
      v.shield = u.shield
      v.alive = u.alive
      v.root.visible = u.alive
      v.root.alpha = 1
      v.body.scale.set(1)
      const p = this.project(u.pos)
      v.root.position.set(p.x, p.y)
      v.root.zIndex = p.y
      this.drawHp(v)
    }
  }

  private drawHp(v: UnitView) {
    const w = 46
    const g = v.hpBar
    g.clear()
    g.roundRect(-w / 2 - 1.5, -1.5, w + 3, 9, 3).fill({ color: 0x000000, alpha: 0.7 })
    const ratio = Math.max(0, v.hp / v.maxHp)
    const color = v.team === 0 ? 0x4cd964 : 0xe5484d
    g.roundRect(-w / 2, 0, w * ratio, 6, 2).fill(color)
    if (v.shield > 0) g.roundRect(-w / 2, -3, Math.min(w, (v.shield / v.maxHp) * w), 3, 1).fill(0x6fc3ff)
  }

  private idle() {
    for (const v of this.units.values()) {
      if (!v.alive) continue
      const active = v.id === this.activeId
      v.body.y = v.floating - (active ? Math.abs(Math.sin(this.t * 4)) * 5 : Math.sin(this.t * 2 + v.id.charCodeAt(1)) * 0.8)
    }
  }

  // ---------- overlays ----------
  setOverlay(items: OverlayItem[]) {
    const g = this.overlay
    g.clear()
    for (const it of items) {
      const { x, y } = this.project(it.h)
      g.poly(this.polyPoints(x, y, S * 0.94)).fill({ color: it.fill, alpha: it.alpha })
      if (it.stroke !== undefined) g.poly(this.polyPoints(x, y, S * 0.94)).stroke({ width: 2, color: it.stroke, alpha: 0.95 })
    }
  }
  setFloaters(list: Floater[]) {
    this.previews.removeChildren().forEach((c) => c.destroy())
    for (const f of list) {
      const v = this.units.get(f.unit)
      if (!v) continue
      const t = new Text({ text: f.text, style: { fontSize: 17, fill: f.color, fontWeight: '800', fontFamily: 'system-ui, sans-serif', stroke: { color: 0x000000, width: 4 } } })
      t.anchor.set(0.5, 1)
      t.position.set(v.root.x, v.root.y - 108)
      this.previews.addChild(t)
    }
  }

  // ---------- animations ----------
  private tween(ms: number, fn: (t: number) => void): Promise<void> {
    ms /= this.speed
    return new Promise((res) => {
      const start = performance.now()
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / ms)
        fn(t)
        if (t < 1) requestAnimationFrame(step)
        else res()
      }
      requestAnimationFrame(step)
    })
  }

  private float(v: UnitView, text: string, color: number, size = 22, dy = 0) {
    const t = new Text({ text, style: { fontSize: size, fill: color, fontWeight: '900', fontFamily: 'system-ui, sans-serif', stroke: { color: 0x000000, width: 5 } } })
    t.anchor.set(0.5, 1)
    t.position.set(v.root.x + (Math.random() - 0.5) * 16, v.root.y - 100 + dy)
    this.fx.addChild(t)
    const y0 = t.y
    void this.tween(1100, (k) => {
      t.y = y0 - 38 * Math.sin(k * Math.PI * 0.5)
      t.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
      if (k >= 1) t.destroy()
    })
  }

  private flash(v: UnitView, tint: number) {
    v.sprite.tint = tint
    setTimeout(() => (v.sprite.tint = 0xffffff), 140 / this.speed)
  }

  private burst(h: Hex, color: number, radiusHexes = 1) {
    const { x, y } = this.project(h)
    const g = new Graphics()
    this.fx.addChild(g)
    void this.tween(380, (k) => {
      g.clear()
      const r = S * (0.4 + radiusHexes * 0.9 * k)
      g.ellipse(x, y, r, r * SQ).stroke({ width: 5 * (1 - k) + 1, color, alpha: 1 - k })
      g.ellipse(x, y, r * 0.7, r * 0.7 * SQ).fill({ color, alpha: 0.35 * (1 - k) })
      if (k >= 1) g.destroy()
    })
  }

  private async projectile(from: Hex, to: Hex, color: number) {
    const a = this.project(from)
    const b = this.project(to)
    const g = new Graphics().circle(0, 0, 8).fill(color).circle(0, 0, 14).fill({ color, alpha: 0.3 })
    this.fx.addChild(g)
    const d = dist(from, to)
    await this.tween(130 + d * 55, (k) => {
      g.x = a.x + (b.x - a.x) * k
      g.y = a.y + (b.y - a.y) * k - 40 - Math.sin(k * Math.PI) * 26
    })
    g.destroy()
  }

  /** Joue une liste d'événements en séquence. `nameOf` sert aux bandeaux de texte. */
  async play(events: GameEvent[], hooks: { onTurn?: (unit: string) => void; onEvent?: (e: GameEvent) => void } = {}) {
    for (const e of events) {
      hooks.onEvent?.(e)
      switch (e.t) {
        case 'turnStart': {
          this.activeId = e.unit
          hooks.onTurn?.(e.unit)
          await wait(180 / this.speed)
          break
        }
        case 'move': {
          const v = this.units.get(e.unit)
          if (!v) break
          for (let i = 1; i < e.path.length; i++) {
            const a = this.project(e.path[i - 1])
            const b = this.project(e.path[i])
            if (b.x !== a.x) v.sprite.scale.x = Math.abs(v.sprite.scale.x) * (b.x > a.x ? 1 : -1)
            await this.tween(135, (k) => {
              v.root.x = a.x + (b.x - a.x) * k
              v.root.y = a.y + (b.y - a.y) * k
              v.floating = -Math.sin(k * Math.PI) * 8
              v.root.zIndex = v.root.y
            })
            v.floating = 0
            v.hex = e.path[i]
          }
          break
        }
        case 'cast': {
          const v = this.units.get(e.unit)
          const sp = SPELLS[e.spell]
          if (!v) break
          const target = this.project(e.cell)
          if (target.x !== v.root.x) v.sprite.scale.x = Math.abs(v.sprite.scale.x) * (target.x > v.root.x ? 1 : -1)
          const dmg = sp.effects.find((x) => x.type === 'damage')
          const color = dmg && dmg.type === 'damage' ? ELEMENT_COLORS[dmg.element] : sp.effects.some((x) => x.type === 'heal') ? 0x6dff8a : 0xffe27a
          this.float(v, `${sp.icon} ${sp.name}`, 0xffffff, 15, -6)
          // petite impulsion vers la cible
          const dx = Math.sign(target.x - v.root.x) * 8
          await this.tween(120, (k) => (v.body.x = dx * Math.sin(k * Math.PI)))
          v.body.x = 0
          if (sp.target !== 'self' && dist(v.hex, e.cell) > 1) await this.projectile(v.hex, e.cell, color)
          const radius = sp.area.shape === 'circle' ? sp.area.radius : 0
          this.burst(sp.target === 'self' ? v.hex : e.cell, color, radius + 0.6)
          await wait(90 / this.speed)
          break
        }
        case 'damage': {
          const v = this.units.get(e.unit)
          if (!v) break
          v.hp = e.hp
          v.shield = e.shield
          this.drawHp(v)
          this.float(v, `-${e.amount}`, e.crit ? 0xffe14a : ELEMENT_COLORS[e.element], e.crit ? 30 : 22)
          this.flash(v, 0xff8a8a)
          await this.tween(160, (k) => (v.body.x = Math.sin(k * 30) * 4 * (1 - k)))
          v.body.x = 0
          await wait(120 / this.speed)
          break
        }
        case 'heal': {
          const v = this.units.get(e.unit)
          if (!v) break
          v.hp = e.hp
          this.drawHp(v)
          if (e.amount > 0) this.float(v, `+${e.amount}`, 0x6dff8a)
          this.flash(v, 0xb6ffc4)
          await wait(180 / this.speed)
          break
        }
        case 'shield': {
          const v = this.units.get(e.unit)
          if (!v) break
          v.shield = e.shield
          this.drawHp(v)
          this.float(v, `🛡 +${e.amount}`, 0x8fd0ff, 18)
          await wait(120 / this.speed)
          break
        }
        case 'push': {
          const v = this.units.get(e.unit)
          if (!v) break
          const a = this.project(e.from)
          const b = this.project(e.to)
          await this.tween(190, (k) => {
            v.root.x = a.x + (b.x - a.x) * k
            v.root.y = a.y + (b.y - a.y) * k
            v.root.zIndex = v.root.y
          })
          v.hex = e.to
          break
        }
        case 'teleport': {
          const v = this.units.get(e.unit)
          if (!v) break
          await this.tween(150, (k) => (v.root.alpha = 1 - k))
          const b = this.project(e.to)
          v.root.position.set(b.x, b.y)
          v.root.zIndex = b.y
          v.hex = e.to
          await this.tween(150, (k) => (v.root.alpha = k))
          break
        }
        case 'status': {
          const v = this.units.get(e.unit)
          if (!v || !e.applied) break
          this.float(v, e.name, e.kind === 'buff' ? 0xffe27a : 0xc58bff, 15, -4)
          break
        }
        case 'death': {
          const v = this.units.get(e.unit)
          if (!v) break
          await this.tween(420, (k) => {
            v.root.alpha = 1 - k
            v.body.scale.set(1 - 0.3 * k)
            v.body.y = v.floating + 14 * k
          })
          v.alive = false
          v.root.visible = false
          break
        }
        case 'gameOver':
          break
      }
    }
  }

  unitHexOf(id: string): Hex | undefined {
    return this.units.get(id)?.hex
  }
}

function cubeRound(q: number, r: number): Hex {
  const s = -q - r
  let rq = Math.round(q)
  let rr = Math.round(r)
  const rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds) rr = -rq - rs
  return hex(rq, rr)
}

export { eq }
