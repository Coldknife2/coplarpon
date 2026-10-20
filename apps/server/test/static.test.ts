import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { request, createServer } from 'node:http'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStaticHandler } from '../src/static'

let dir: string
let server: Server
let port: number

/** Requête HTTP brute : contrairement à un navigateur, node ne normalise PAS les ".." du chemin. */
function get(path: string, method = 'GET'): Promise<{ status: number; body: string; headers: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }))
    })
    req.on('error', reject)
    req.end()
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cpl-static-'))
  const dist = join(dir, 'dist')
  mkdirSync(join(dist, 'assets'), { recursive: true })
  writeFileSync(join(dist, 'index.html'), '<h1>jeu</h1>')
  writeFileSync(join(dist, 'assets', 'app-abc123.js'), 'console.log(1)')
  writeFileSync(join(dir, 'secret.txt'), 'TOP SECRET') // à côté de dist, hors du dossier servi
  writeFileSync(join(dir, 'dist-evil.txt'), 'préfixe voisin') // piège : même préfixe que "dist"
  symlinkSync(join(dir, 'secret.txt'), join(dist, 'lien.txt'))
  const serve = createStaticHandler(dist)
  server = createServer((req, res) => {
    if (!serve(req, res)) res.writeHead(404).end('Not found')
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as { port: number }).port
})

afterAll(() => {
  server.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('fichiers statiques', () => {
  it('sert index.html à la racine', async () => {
    const r = await get('/')
    expect(r.status).toBe(200)
    expect(r.body).toBe('<h1>jeu</h1>')
    expect(r.headers['cache-control']).toBe('no-cache')
  })
  it('met en cache longtemps les assets hachés', async () => {
    const r = await get('/assets/app-abc123.js')
    expect(r.status).toBe(200)
    expect(String(r.headers['content-type'])).toContain('javascript')
    expect(String(r.headers['cache-control'])).toContain('immutable')
  })
  it('ignore la query string', async () => {
    expect((await get('/?v=1')).status).toBe(200)
  })
  it('404 sur un fichier inexistant', async () => {
    expect((await get('/nope.js')).status).toBe(404)
  })
  it('HEAD ne renvoie pas de corps', async () => {
    const r = await get('/', 'HEAD')
    expect(r.status).toBe(200)
    expect(r.body).toBe('')
  })
})

describe('traversée de dossier : tout doit être refusé (404)', () => {
  const attacks = [
    '/../secret.txt',
    '/../../secret.txt',
    '/assets/../../secret.txt',
    '/%2e%2e/secret.txt',
    '/%2e%2e%2fsecret.txt',
    '/..%2fsecret.txt',
    '/..%5csecret.txt',
    '/../dist-evil.txt', // préfixe voisin : un startsWith naïf le laisserait passer
    '//etc/passwd',
    '/../../../../../../etc/passwd',
    '/%00',
    '/%E0%A4%A', // encodage invalide
    '/lien.txt', // lien symbolique qui pointe hors du dossier
  ]
  for (const path of attacks) {
    it(path, async () => {
      const r = await get(path)
      expect(r.status).toBe(404)
      expect(r.body).not.toContain('TOP SECRET')
      expect(r.body).not.toContain('root:')
    })
  }
})
