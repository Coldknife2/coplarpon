// Serveur de combat autoritaire : un seul "salon" pour ce proto.
// Il valide chaque action avec le moteur, fait jouer les monstres, et diffuse état + événements.

import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'
import {
  CLASSES, ENCOUNTERS, applyAction, createCombat, getUnit, playMobTurns,
} from '@coplarpon/engine'
import type { ClientMsg, CombatState, LobbyPlayer, ServerMsg } from '@coplarpon/engine'

const PORT = Number(process.env.PORT ?? 3001)
const MAX_PLAYERS = 4

interface Client {
  id: string
  ws: WebSocket
  player?: LobbyPlayer
}

const clients = new Map<WebSocket, Client>()
let combat: CombatState | null = null

const send = (ws: WebSocket, m: ServerMsg): void => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m))
}
const broadcast = (m: ServerMsg) => clients.forEach((c) => send(c.ws, m))
const lobbyPlayers = () => [...clients.values()].flatMap((c) => (c.player ? [c.player] : []))
const broadcastLobby = () => broadcast({ t: 'lobby', players: lobbyPlayers() })

const wss = new WebSocketServer({ port: PORT })
console.log(`[coplarpon] serveur en écoute sur ws://localhost:${PORT}`)

wss.on('connection', (ws) => {
  const client: Client = { id: randomUUID().slice(0, 8), ws }
  clients.set(ws, client)
  send(ws, { t: 'welcome', you: client.id })
  if (combat) send(ws, { t: 'error', msg: 'Un combat est en cours, tu pourras rejoindre le prochain.' })
  send(ws, { t: 'lobby', players: lobbyPlayers() })

  ws.on('message', (raw) => {
    let msg: ClientMsg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    handle(client, msg)
  })
  ws.on('close', () => {
    clients.delete(ws)
    if (!combat) broadcastLobby()
    else if (!lobbyPlayers().length) combat = null // plus personne : on libère le salon
  })
})

function handle(c: Client, msg: ClientMsg): void {
  switch (msg.t) {
    case 'join': {
      if (combat) return send(c.ws, { t: 'error', msg: 'Combat en cours.' })
      if (!CLASSES[msg.classId]) return send(c.ws, { t: 'error', msg: 'Classe inconnue.' })
      if (!c.player && lobbyPlayers().length >= MAX_PLAYERS) return send(c.ws, { t: 'error', msg: 'Salon plein.' })
      c.player = { id: c.id, name: String(msg.name).slice(0, 16) || 'Anonyme', classId: msg.classId }
      broadcastLobby()
      break
    }
    case 'start': {
      if (combat || !c.player) return
      const enc = ENCOUNTERS.find((e) => e.id === msg.encounter)
      if (!enc) return send(c.ws, { t: 'error', msg: 'Rencontre inconnue.' })
      const res = createCombat({ seed: (Math.random() * 2 ** 31) | 0, players: lobbyPlayers(), mobs: enc.mobs })
      const played = playMobTurns(res.state)
      combat = played.state
      broadcast({ t: 'combat', state: combat, events: [...res.events, ...played.events] })
      break
    }
    case 'action': {
      if (!combat || combat.phase !== 'fighting') return
      const active = getUnit(combat, combat.activeId)
      if (active.owner !== c.id) return send(c.ws, { t: 'error', msg: "Ce n'est pas ton tour." })
      const res = applyAction(combat, msg.action)
      if (res.error) return send(c.ws, { t: 'error', msg: res.error })
      const played = playMobTurns(res.state)
      combat = played.state
      broadcast({ t: 'combat', state: combat, events: [...res.events, ...played.events] })
      break
    }
    case 'lobby': {
      if (combat?.phase === 'over') {
        combat = null
        broadcastLobby()
      }
      break
    }
  }
}
