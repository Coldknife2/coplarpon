import type { Action, CombatState, GameEvent } from './types'

export interface LobbyPlayer {
  id: string
  name: string
  classId: string
}

// client -> serveur
export type ClientMsg =
  | { t: 'join'; name: string; classId: string }
  | { t: 'start'; encounter: string }
  | { t: 'action'; action: Action }
  | { t: 'lobby' } // retour au lobby une fois le combat fini

// serveur -> client
export type ServerMsg =
  | { t: 'welcome'; you: string }
  | { t: 'lobby'; players: LobbyPlayer[] }
  | { t: 'combat'; state: CombatState; events: GameEvent[] }
  | { t: 'error'; msg: string }
