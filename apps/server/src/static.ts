// Service de fichiers statiques (le build du client) : lecture seule, confiné à un dossier.
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

const inside = (root: string, p: string): boolean => p === root || p.startsWith(root + sep)

/** Premier dossier contenant un index.html parmi les candidats (ou null : serveur WebSocket seul). */
export function findStaticDir(candidates: (string | undefined)[]): string | null {
  for (const c of candidates) {
    if (c && existsSync(resolve(c, 'index.html'))) return resolve(c)
  }
  return null
}

/**
 * Renvoie un handler (req, res) => boolean. `true` = la requête a reçu une réponse.
 * `false` = rien à servir : l'appelant répond 404.
 * Les chemins sont résolus puis vérifiés : aucune requête ne peut sortir de `root`
 * ("..", "%2e%2e", liens symboliques, octets nuls).
 */
export function createStaticHandler(root: string) {
  const base = realpathSync(resolve(root))

  return function serve(req: IncomingMessage, res: ServerResponse): boolean {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false

    let path: string
    try {
      path = decodeURIComponent((req.url ?? '/').split(/[?#]/)[0])
    } catch {
      return false
    }
    if (!path.startsWith('/') || path.includes('\0')) return false

    // '.' + path : le chemin reste relatif à base (un "/etc/passwd" n'est pas absolu ici)
    let file = resolve(base, '.' + path)
    if (!inside(base, file)) return false
    try {
      if (statSync(file).isDirectory()) file = resolve(file, 'index.html')
      file = realpathSync(file) // suit les liens symboliques, puis revérifie
    } catch {
      return false
    }
    if (!inside(base, file)) return false
    const st = statSync(file)
    if (!st.isFile()) return false

    const rel = file.slice(base.length + 1).split(sep).join('/')
    // assets hachés par Vite : immuables ; le reste (index.html…) : toujours revalidé
    const hashed = rel.startsWith('assets/')
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    })
    if (req.method === 'HEAD') res.end()
    else createReadStream(file).pipe(res)
    return true
  }
}
