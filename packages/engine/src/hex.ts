// Grille hexagonale en coordonnées axiales (q, r), orientation "flat-top".
// Réf : https://www.redblobgames.com/grids/hexagons/

export interface Hex {
  q: number
  r: number
}

/** Les 6 directions, dans l'ordre trigonométrique à l'écran (E, NE, NO, O, SO, SE). */
export const DIRS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export const hex = (q: number, r: number): Hex => ({ q, r })
export const key = (h: Hex): string => `${h.q},${h.r}`
export const parseKey = (k: string): Hex => {
  const [q, r] = k.split(',').map(Number)
  return { q, r }
}
export const eq = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r
export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r })

export function dist(a: Hex, b: Hex): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

export const neighbors = (h: Hex): Hex[] => DIRS.map((d) => add(h, d))

/** Tous les hex à distance <= radius de center (disque plein). */
export function disk(center: Hex, radius: number): Hex[] {
  const out: Hex[] = []
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      out.push({ q: center.q + dq, r: center.r + dr })
    }
  }
  return out
}

/** Coordonnées cartésiennes d'un hex de rayon 1 (pour les produits scalaires / le rendu). */
export function toCart(h: Hex): { x: number; y: number } {
  return { x: 1.5 * h.q, y: Math.sqrt(3) * (h.r + h.q / 2) }
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
  return { q: rq, r: rr }
}

/** Ligne de a à b (inclus), pour la ligne de vue. */
export function line(a: Hex, b: Hex): Hex[] {
  const n = dist(a, b)
  const out: Hex[] = []
  // petit décalage pour éviter les ambiguïtés sur les arêtes
  const e = 1e-6
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n
    out.push(cubeRound(a.q + e + (b.q - a.q) * t, a.r + 2 * e + (b.r - a.r) * t))
  }
  return out
}

/** Index de la direction qui s'éloigne le mieux de `from` en allant vers `to`. */
export function dirIndex(from: Hex, to: Hex): number {
  const f = toCart(from)
  const t = toCart(to)
  const vx = t.x - f.x
  const vy = t.y - f.y
  let best = 0
  let bestDot = -Infinity
  DIRS.forEach((d, i) => {
    const c = toCart(d)
    const dot = c.x * vx + c.y * vy
    if (dot > bestDot) {
      bestDot = dot
      best = i
    }
  })
  return best
}
