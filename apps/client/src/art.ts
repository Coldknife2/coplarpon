// Sprites des personnages : SVG dessinés à la main, rasterisés en canvas puis envoyés à Pixi.
// Chaque personnage regarde vers la DROITE. Viewbox 80x100, les pieds touchent y=96.

const eyes = (cx: number, cy: number, gap = 7, r = 2.4) => `
  <circle cx="${cx - gap}" cy="${cy}" r="${r + 1.6}" fill="#fff"/><circle cx="${cx + gap}" cy="${cy}" r="${r + 1.6}" fill="#fff"/>
  <circle cx="${cx - gap + 1}" cy="${cy}" r="${r}" fill="#1b1b2b"/><circle cx="${cx + gap + 1}" cy="${cy}" r="${r}" fill="#1b1b2b"/>`

const SVGS: Record<string, string> = {
  guerrier: `
    <ellipse cx="40" cy="95" rx="20" ry="4" fill="#0003"/>
    <rect x="28" y="76" width="9" height="18" rx="3" fill="#4a3b36"/><rect x="43" y="76" width="9" height="18" rx="3" fill="#4a3b36"/>
    <path d="M24 44 Q40 36 56 44 L58 80 Q40 86 22 80 Z" fill="#c0562f" stroke="#7d3419" stroke-width="2"/>
    <rect x="24" y="68" width="32" height="6" fill="#5b3a21"/><rect x="36" y="66" width="8" height="10" rx="1" fill="#e5c158"/>
    <circle cx="40" cy="30" r="15" fill="#f1c9a0" stroke="#a87a55" stroke-width="1.5"/>
    <path d="M24 28 Q24 10 40 10 Q56 10 56 28 L50 26 L30 26 Z" fill="#aab4c2" stroke="#6b7480" stroke-width="2"/>
    <path d="M40 10 Q46 0 54 6 Q48 8 46 14 Z" fill="#d83a3a"/>
    <rect x="38" y="14" width="4" height="14" fill="#8e98a6"/>
    ${eyes(44, 33, 6, 2)}
    <ellipse cx="22" cy="58" rx="10" ry="13" fill="#3a6fb5" stroke="#1f3f6e" stroke-width="2"/><ellipse cx="22" cy="58" rx="4" ry="5" fill="#e5c158"/>
    <rect x="58" y="22" width="5" height="46" rx="1" fill="#d9dee6" stroke="#8791a0" stroke-width="1.5" transform="rotate(14 60 50)"/>
    <rect x="52" y="62" width="17" height="4" rx="1" fill="#e5c158" transform="rotate(14 60 64)"/>
    <circle cx="57" cy="58" r="5" fill="#f1c9a0"/>`,
  pyromancien: `
    <ellipse cx="40" cy="95" rx="22" ry="4" fill="#0003"/>
    <path d="M22 92 L30 44 Q40 38 50 44 L58 92 Z" fill="#7b3fc4" stroke="#4a2380" stroke-width="2"/>
    <path d="M34 92 L40 56 L46 92 Z" fill="#9a62e0" opacity=".7"/>
    <rect x="29" y="62" width="22" height="5" fill="#e8a33a"/>
    <circle cx="40" cy="34" r="13" fill="#f1c9a0" stroke="#a87a55" stroke-width="1.5"/>
    <path d="M40 40 Q40 52 36 56 Q40 54 44 56 Q41 50 40 40Z" fill="#ddd" opacity=".9"/>
    <path d="M22 28 Q40 20 58 28 L52 18 L40 -2 L28 18 Z" fill="#7b3fc4" stroke="#4a2380" stroke-width="2"/>
    <path d="M22 28 Q40 34 58 28 Q40 24 22 28Z" fill="#5a2c99"/>
    <path d="M40 8 l2 4 4 .5 -3 3 .8 4 -3.8 -2 -3.8 2 .8 -4 -3 -3 4 -.5z" fill="#ffd54a"/>
    ${eyes(44, 34, 6, 2)}
    <rect x="62" y="22" width="4" height="72" rx="2" fill="#6b4a2b"/>
    <circle cx="64" cy="18" r="9" fill="#ff7a1a" stroke="#c43c00" stroke-width="2"/><circle cx="64" cy="18" r="4.5" fill="#ffd54a"/>
    <path d="M58 12 Q64 -2 70 12 Q64 8 58 12Z" fill="#ff9a2a"/>
    <circle cx="58" cy="56" r="5" fill="#f1c9a0"/>`,
  pretre: `
    <ellipse cx="40" cy="95" rx="21" ry="4" fill="#0003"/>
    <path d="M23 92 L28 46 Q40 38 52 46 L57 92 Z" fill="#f3efe0" stroke="#b9a96a" stroke-width="2"/>
    <path d="M36 46 L40 92 L44 46Z" fill="#e8c24a"/>
    <rect x="27" y="64" width="26" height="4" fill="#e8c24a"/>
    <circle cx="40" cy="32" r="14" fill="#f1c9a0" stroke="#a87a55" stroke-width="1.5"/>
    <path d="M25 34 Q24 14 40 14 Q56 14 55 34 Q50 24 40 24 Q30 24 25 34Z" fill="#e8dfc0" stroke="#b9a96a" stroke-width="2"/>
    <ellipse cx="40" cy="6" rx="14" ry="4" fill="none" stroke="#ffd54a" stroke-width="3"/>
    ${eyes(44, 34, 6, 2)}
    <path d="M36 42 Q40 46 44 42" fill="none" stroke="#a0603a" stroke-width="1.6" stroke-linecap="round"/>
    <rect x="62" y="20" width="4" height="74" rx="2" fill="#c9a23a"/>
    <path d="M58 24 L64 12 L70 24 L64 30Z" fill="#ffe27a" stroke="#c9a23a" stroke-width="2"/>
    <circle cx="58" cy="58" r="5" fill="#f1c9a0"/>`,
  gelee: `
    <ellipse cx="40" cy="93" rx="26" ry="5" fill="#0003"/>
    <path d="M12 90 Q8 56 28 44 Q40 24 52 44 Q72 56 68 90 Q40 98 12 90Z" fill="#4fb0e8" stroke="#1f78b4" stroke-width="2.5"/>
    <path d="M20 62 Q22 50 32 46" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>
    <circle cx="31" cy="66" r="3" fill="#fff" opacity=".5"/><circle cx="52" cy="80" r="2.5" fill="#fff" opacity=".4"/>
    ${eyes(44, 64, 9, 3)}
    <path d="M36 76 Q42 82 50 76" fill="none" stroke="#1b4f7a" stroke-width="2.5" stroke-linecap="round"/>`,
  gobelin: `
    <ellipse cx="40" cy="95" rx="18" ry="4" fill="#0003"/>
    <rect x="30" y="78" width="8" height="16" rx="3" fill="#5b4a2b"/><rect x="43" y="78" width="8" height="16" rx="3" fill="#5b4a2b"/>
    <path d="M26 50 Q40 44 54 50 L54 80 Q40 84 26 80Z" fill="#8a6a3a" stroke="#4e3a1c" stroke-width="2"/>
    <path d="M18 34 L4 26 L20 42Z" fill="#6fae3c" stroke="#3f7a1c" stroke-width="2"/><path d="M62 34 L76 26 L60 42Z" fill="#6fae3c" stroke="#3f7a1c" stroke-width="2"/>
    <circle cx="40" cy="36" r="16" fill="#7fc24a" stroke="#3f7a1c" stroke-width="2"/>
    <path d="M24 28 Q40 18 56 28 Q40 22 24 28Z" fill="#7a2a2a"/><path d="M26 30 Q40 14 54 30 L50 24 Q40 16 30 24Z" fill="#a33a3a" stroke="#6a1f1f" stroke-width="1.5"/>
    ${eyes(44, 38, 6, 2.4)}
    <path d="M34 47 Q40 51 46 47" fill="none" stroke="#2c4a14" stroke-width="2" stroke-linecap="round"/><path d="M36 47 l2 4 2 -4 M42 47 l2 4 2 -4" fill="#fff"/>
    <path d="M66 22 Q80 50 66 80" fill="none" stroke="#6b4a2b" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M66 22 L66 80" stroke="#ddd" stroke-width="1"/>
    <path d="M44 54 L70 52" stroke="#6b4a2b" stroke-width="3"/><path d="M70 52 l-6 -3 0 6z" fill="#cfd6df"/>
    <circle cx="54" cy="56" r="5" fill="#7fc24a"/>`,
  ogre: `
    <ellipse cx="40" cy="95" rx="30" ry="5" fill="#0003"/>
    <rect x="22" y="76" width="14" height="18" rx="4" fill="#6a5430"/><rect x="44" y="76" width="14" height="18" rx="4" fill="#6a5430"/>
    <path d="M10 56 Q14 40 40 38 Q66 40 70 56 Q74 82 40 84 Q6 82 10 56Z" fill="#a98a4a" stroke="#6a5430" stroke-width="2.5"/>
    <path d="M16 62 Q40 70 64 62 L64 70 Q40 78 16 70Z" fill="#6a5430"/>
    <ellipse cx="40" cy="62" rx="18" ry="14" fill="#c9ad6a" opacity=".6"/>
    <circle cx="40" cy="30" r="14" fill="#b6a35a" stroke="#6a5a2a" stroke-width="2"/>
    <path d="M28 22 Q40 12 52 22" fill="none" stroke="#5a4a1a" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 24 L34 30 M50 24 L46 30" stroke="#5a4a1a" stroke-width="3"/>
    <circle cx="34" cy="31" r="3" fill="#fff"/><circle cx="46" cy="31" r="3" fill="#fff"/><circle cx="35" cy="31" r="1.6" fill="#a01010"/><circle cx="47" cy="31" r="1.6" fill="#a01010"/>
    <path d="M30 40 Q40 36 50 40" fill="none" stroke="#3a2a0a" stroke-width="2.5"/><path d="M32 40 l2 -5 2 5 M44 40 l2 -5 2 5" fill="#fff"/>
    <rect x="62" y="14" width="9" height="66" rx="4" fill="#6b4a2b" stroke="#3e2a14" stroke-width="2" transform="rotate(10 66 50)"/>
    <ellipse cx="68" cy="14" rx="12" ry="14" fill="#7a5a34" stroke="#3e2a14" stroke-width="2" transform="rotate(10 68 14)"/>
    <circle cx="62" cy="52" r="7" fill="#b6a35a"/>`,
  chaman: `
    <ellipse cx="40" cy="95" rx="20" ry="4" fill="#0003"/>
    <path d="M24 92 L28 50 Q40 42 52 50 L56 92 Z" fill="#7a2a4a" stroke="#4a1530" stroke-width="2"/>
    <path d="M24 84 l4 8 4 -8 4 8 4 -8 4 8 4 -8 4 8 4 -8" fill="#3c7a2a" stroke="#254a14" stroke-width="1.5"/>
    <rect x="28" y="62" width="24" height="4" fill="#e8a33a"/>
    <circle cx="40" cy="34" r="14" fill="#e0a070" stroke="#8a5a3a" stroke-width="1.5"/>
    <path d="M28 28 Q40 22 52 28 L50 44 Q40 50 30 44Z" fill="#f4ecd8" stroke="#8a7a5a" stroke-width="2"/>
    <path d="M32 33 l5 3 -5 3z M48 33 l-5 3 5 3z" fill="#1b1b2b"/><path d="M34 44 L46 44" stroke="#1b1b2b" stroke-width="2"/>
    <path d="M24 26 Q22 6 30 2 Q32 14 36 20 Z" fill="#d44a6a"/><path d="M34 22 Q34 0 42 -2 Q42 12 44 20 Z" fill="#f2c040"/><path d="M46 22 Q50 2 58 4 Q54 14 54 26 Z" fill="#3c9ad4"/>
    <rect x="62" y="16" width="4" height="78" rx="2" fill="#6b4a2b"/>
    <circle cx="64" cy="12" r="8" fill="#f4ecd8" stroke="#8a7a5a" stroke-width="1.5"/><circle cx="61" cy="11" r="2" fill="#1b1b2b"/><circle cx="67" cy="11" r="2" fill="#1b1b2b"/>
    <path d="M60 20 l4 -3 4 3" fill="none" stroke="#8a7a5a" stroke-width="1.5"/>
    <circle cx="58" cy="58" r="5" fill="#e0a070"/>`,
}

export const SPRITE_W = 80
export const SPRITE_H = 100
const RENDER_SCALE = 2.5

async function rasterize(svgBody: string): Promise<HTMLCanvasElement> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -6 88 108" width="${88 * RENDER_SCALE}" height="${108 * RENDER_SCALE}">${svgBody}</svg>`
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await img.decode()
  const c = document.createElement('canvas')
  c.width = 88 * RENDER_SCALE
  c.height = 108 * RENDER_SCALE
  c.getContext('2d')!.drawImage(img, 0, 0)
  return c
}

/** Renvoie un canvas par id d'unité (classes et monstres). */
export async function loadSprites(): Promise<Record<string, HTMLCanvasElement>> {
  const out: Record<string, HTMLCanvasElement> = {}
  await Promise.all(Object.entries(SVGS).map(async ([id, body]) => (out[id] = await rasterize(body))))
  return out
}

/** Portrait (pour la timeline et le lobby) : URL data du SVG complet. */
export function portraitUrl(id: string): string {
  const body = SVGS[id] ?? ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -6 88 108">${body}</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
