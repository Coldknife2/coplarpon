// Deux transports derrière la même interface :
//  - LocalTransport : le "serveur" tourne dans le navigateur (mode solo, aucune installation)
//  - WsTransport    : vrai serveur autoritaire
import {
  ENCOUNTERS, applyAction, createCombat, getUnit, playMobTurns,
} from '@coplarpon/engine'
import type { ClientMsg, CombatState, LobbyPlayer, ServerMsg } from '@coplarpon/engine'

export interface Transport {
  readonly me: string
  send(m: ClientMsg): void
  onMessage: (m: ServerMsg) => void
  onClose: () => void
  close(): void
}

export class LocalTransport implements Transport {
  readonly me = 'local'
  onMessage: (m: ServerMsg) => void = () => {}
  onClose = () => {}
  party: LobbyPlayer[] = []
  private state: CombatState | null = null

  constructor() {
    setTimeout(() => this.onMessage({ t: 'welcome', you: this.me }))
  }
  private emit(m: ServerMsg) {
    queueMicrotask(() => this.onMessage(m))
  }
  send(m: ClientMsg): void {
    switch (m.t) {
      case 'join':
        break // en solo, le groupe est donné via `party`
      case 'start': {
        const enc = ENCOUNTERS.find((e) => e.id === m.encounter)
        if (!enc || !this.party.length) return
        const res = createCombat({ seed: (Math.random() * 2 ** 31) | 0, players: this.party, mobs: enc.mobs })
        const played = playMobTurns(res.state)
        this.state = played.state
        this.emit({ t: 'combat', state: this.state, events: [...res.events, ...played.events] })
        break
      }
      case 'action': {
        if (!this.state || this.state.phase !== 'fighting') return
        if (getUnit(this.state, this.state.activeId).owner !== this.me) return
        const res = applyAction(this.state, m.action)
        if (res.error) return this.emit({ t: 'error', msg: res.error })
        const played = playMobTurns(res.state)
        this.state = played.state
        this.emit({ t: 'combat', state: this.state, events: [...res.events, ...played.events] })
        break
      }
      case 'lobby':
        this.state = null
        break
    }
  }
  close(): void {}
}

export class WsTransport implements Transport {
  me = ''
  onMessage: (m: ServerMsg) => void = () => {}
  onClose = () => {}
  private ws: WebSocket
  private queue: string[] = []

  constructor(url: string, onOpen: () => void, onFail: () => void) {
    this.ws = new WebSocket(url)
    this.ws.onopen = () => {
      this.queue.forEach((q) => this.ws.send(q))
      this.queue = []
      onOpen()
    }
    this.ws.onerror = () => onFail()
    this.ws.onclose = () => this.onClose()
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data) as ServerMsg
      if (m.t === 'welcome') this.me = m.you
      this.onMessage(m)
    }
  }
  send(m: ClientMsg): void {
    const s = JSON.stringify(m)
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(s)
    else this.queue.push(s)
  }
  close(): void {
    this.ws.close()
  }
}
