import {
  CLASSES, ENCOUNTERS, MOBS, SPELLS, activeUnit, canCast, castableCells, areaCells, cloneState, eq, getUnit,
  key, pathFrom, power, reachable, resist, simulateCast, spellsOf, unitAt,
} from '@coplarpon/engine'
import type { Action, CombatState, GameEvent, Hex, LobbyPlayer, ServerMsg, SpellDef } from '@coplarpon/engine'
import { portraitUrl } from './art'
import { LocalTransport, WsTransport } from './net'
import type { Transport } from './net'
import { Scene } from './view'
import type { Floater, OverlayItem } from './view'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const params = new URLSearchParams(location.search)

const ELEMENT_ICON: Record<string, string> = { fire: '🔥', water: '💧', earth: '🪨', air: '🌪️', neutral: '⚪' }
const defOf = (id: string) => CLASSES[id] ?? MOBS[id]

// ------------------------------------------------------------------ état
const scene = new Scene()
let transport: Transport | null = null
let auth: CombatState | null = null
let busy = false
let selected: string | null = null
let hover: Hex | null = null
let reachCache: ReturnType<typeof reachable> | null = null
const queue: { state: CombatState; events: GameEvent[] }[] = []
let pumping = false

/**
 * Adresse du serveur de jeu par défaut. Jamais de chemin absolu : tout dérive de location,
 * pour que l'appli marche à la racine, sous un sous-chemin, en HTTPS, derrière un proxy.
 * Ordre : ?server= (debug) > VITE_SERVER_URL (build, serveur séparé) > ce défaut.
 */
function defaultServerUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined
  if (fromEnv) return fromEnv
  if (!location.protocol.startsWith('http')) return 'ws://localhost:3001'
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  // Serveur de dev Vite : le serveur de jeu tourne à part, sur le port 3001.
  if (location.port === '5173') return `${proto}://${location.hostname}:3001`
  // Sinon le serveur de jeu sert aussi la page : même hôte, même dossier.
  return `${proto}://${location.host}${location.pathname.replace(/[^/]*$/, '')}`
}

const menu = {
  mode: 'solo' as 'solo' | 'multi',
  party: ['guerrier', 'pyromancien', 'pretre'],
  myClass: 'guerrier',
  name: 'Joueur' + Math.floor(Math.random() * 90 + 10),
  url: params.get('server') ?? defaultServerUrl(),
  encounter: ENCOUNTERS[0].id,
  players: [] as LobbyPlayer[],
  connected: false,
  err: '',
}

// ------------------------------------------------------------------ réseau
function onMessage(m: ServerMsg) {
  switch (m.t) {
    case 'welcome':
      break
    case 'lobby':
      menu.players = m.players
      if (auth?.phase === 'over' && !queue.length && !pumping) showMenu()
      else if (!auth) renderMenu()
      break
    case 'combat':
      queue.push({ state: m.state, events: m.events })
      void pump()
      break
    case 'error':
      busy = false
      menu.err = m.msg
      toast(m.msg)
      renderMenu()
      refreshHud()
      break
  }
}

function connect() {
  transport?.close()
  menu.err = ''
  if (menu.mode === 'solo') {
    const t = new LocalTransport()
    t.party = menu.party.map((c) => ({ id: t.me, name: defOf(c).name, classId: c }))
    transport = t
    transport.onMessage = onMessage
    menu.connected = true
    return
  }
  menu.connected = false
  renderMenu()
  const t = new WsTransport(
    menu.url,
    () => {
      menu.connected = true
      t.send({ t: 'join', name: menu.name, classId: menu.myClass })
      renderMenu()
    },
    () => {
      menu.err = `Connexion impossible à ${menu.url}. Le serveur tourne-t-il ? (npm run dev:server)`
      menu.connected = false
      renderMenu()
    },
  )
  t.onMessage = onMessage
  t.onClose = () => {
    menu.connected = false
    menu.err = 'Déconnecté du serveur.'
    renderMenu()
  }
  transport = t
}

function startFight() {
  if (menu.mode === 'solo') {
    connect()
    ;(transport as LocalTransport).party = menu.party.map((c) => ({ id: 'local', name: defOf(c).name, classId: c }))
  }
  transport!.send({ t: 'start', encounter: menu.encounter })
}

function sendAction(a: Action) {
  if (busy || !transport) return
  busy = true
  selected = null
  transport.send({ t: 'action', action: a })
  refreshHud()
}

// ------------------------------------------------------------------ file d'événements
async function pump() {
  if (pumping) return
  pumping = true
  while (queue.length) {
    const { state, events } = queue.shift()!
    if (!auth) {
      scene.build(state)
      auth = state
      hideMenu()
      $('hud').classList.remove('hidden')
      $('log').innerHTML = ''
      logTurn(state, activeUnit(state).id)
    } else {
      busy = true
      refreshHud()
      await scene.play(events, {
        onEvent: (e) => logEvent(state, e),
        onTurn: () => {},
      })
      scene.sync(state)
      auth = state
    }
    busy = false
    reachCache = null
    selected = null
    refreshHud()
    if (state.phase === 'over') {
      await endScreen(state)
    } else if (activeUnit(state).owner === transport?.me) {
      flashBanner('À toi de jouer !', 800)
    }
  }
  pumping = false
}

async function endScreen(state: CombatState) {
  flashBanner(state.winner === 0 ? '🏆 Victoire !' : '💀 Défaite…', 1800)
  await new Promise((r) => setTimeout(r, 2000))
  auth = null
  $('hud').classList.add('hidden')
  transport?.send({ t: 'lobby' })
  menu.players = []
  if (menu.mode === 'solo') connect()
  showMenu()
}

// ------------------------------------------------------------------ log & bannière
function nameOf(s: CombatState, id: string) {
  const u = s.units.find((x) => x.id === id)
  return u ? `<b style="color:${u.team === 0 ? '#7cc4ff' : '#ff8a80'}">${u.name}</b>` : id
}
function logLine(html: string, cls = '') {
  const log = $('log')
  const p = document.createElement('p')
  if (cls) p.className = cls
  p.innerHTML = html
  log.appendChild(p)
  while (log.children.length > 40) log.firstChild?.remove()
}
const logTurn = (s: CombatState, id: string) => logLine(`Tour de ${nameOf(s, id)}`, 'turn')
function logEvent(s: CombatState, e: GameEvent) {
  switch (e.t) {
    case 'turnStart':
      return logTurn(s, e.unit)
    case 'cast':
      return logLine(`${nameOf(s, e.unit)} lance ${SPELLS[e.spell].icon} ${SPELLS[e.spell].name}`)
    case 'damage':
      return logLine(`&nbsp;&nbsp;${nameOf(s, e.unit)} perd <b>${e.amount}</b> PV ${ELEMENT_ICON[e.element]}${e.crit ? ' (critique !)' : ''}`)
    case 'heal':
      return e.amount > 0 ? logLine(`&nbsp;&nbsp;${nameOf(s, e.unit)} récupère <b>${e.amount}</b> PV 💚`) : undefined
    case 'death':
      return logLine(`💀 ${nameOf(s, e.unit)} est vaincu`)
    case 'status':
      return e.applied ? logLine(`&nbsp;&nbsp;${nameOf(s, e.unit)} : ${e.name}`) : undefined
  }
}
let bannerTimer = 0
function flashBanner(text: string, ms: number) {
  const b = $('banner')
  b.textContent = text
  b.classList.add('show')
  clearTimeout(bannerTimer)
  bannerTimer = window.setTimeout(() => b.classList.remove('show'), ms)
}
function toast(text: string) {
  flashBanner(text, 1600)
}

// ------------------------------------------------------------------ HUD
const mine = () =>
  !!auth && auth.phase === 'fighting' && !busy && activeUnit(auth).owner === transport?.me

function refreshHud() {
  if (!auth) return
  renderTimeline()
  renderCard()
  renderBottom()
  updateOverlay()
}

function renderTimeline() {
  const s = auth!
  const n = s.order.length
  const html: string[] = []
  for (let i = 0; i < n; i++) {
    const u = getUnit(s, s.order[(s.turnIdx + i) % n])
    if (!u.alive) continue
    html.push(
      `<div class="chip ${u.team ? 'mob' : ''} ${u.id === s.activeId ? 'active' : ''}" title="${u.name}">
        <img src="${portraitUrl(u.defId)}"/><i style="width:${(u.hp / u.stats.maxHp) * 100}%"></i></div>`,
    )
  }
  $('timeline').innerHTML = html.join('')
}

function renderCard() {
  const s = auth!
  const hu = hover ? unitAt(s, hover) : undefined
  const u = hu ?? activeUnit(s)
  const pct = (u.hp / u.stats.maxHp) * 100
  const sts = u.statuses
    .map((st) => `<span class="st ${st.kind}" title="${st.turns} tour(s)">${st.name} ${st.turns}</span>`)
    .join('')
  const els = (['fire', 'water', 'earth', 'air'] as const)
    .map((e) => `<div>${ELEMENT_ICON[e]}<br>${resist(u, e)}%<br><span style="color:#ffcb47">+${power(u, e)}</span></div>`)
    .join('')
  $('unit-card').innerHTML = `
    <h3><img src="${portraitUrl(u.defId)}" width="34" height="40"/> ${u.name}${u.id === s.activeId ? ' <small style="color:#ffcb47">(joue)</small>' : ''}</h3>
    <div class="bar"><b class="${u.team ? 'mob' : ''}" style="width:${pct}%"></b><span>${u.hp} / ${u.stats.maxHp}${u.shield ? ` (+${u.shield} 🛡)` : ''}</span></div>
    <div>⚡ ${u.ap} PA &nbsp; 👟 ${u.mp} PM</div>
    <div class="res" title="Résistance / puissance par élément">${els}</div>
    <div class="sts">${sts}</div>`
}

function renderBottom() {
  const s = auth!
  const u = activeUnit(s)
  const my = mine()
  $('resources').innerHTML = `<div class="res-chip ap">⚡ ${u.ap} PA</div><div class="res-chip mp">👟 ${u.mp} PM</div>`
  const spells = u.owner === transport?.me ? spellsOf(u) : []
  const el = $('spells')
  el.innerHTML = ''
  spells.forEach((sp, i) => {
    const cd = u.cooldowns[sp.id] ?? 0
    const b = document.createElement('button')
    b.className = 'spell' + (selected === sp.id ? ' sel' : '')
    b.disabled = !my || !canCast(u, sp)
    b.innerHTML = `<span class="key">${i + 1}</span><span class="cost">${sp.cost}</span>${sp.icon}<small>${sp.name}</small>${cd ? `<div class="cd">${cd}</div>` : ''}`
    b.onclick = () => selectSpell(sp.id)
    b.onmouseenter = () => showSpellTip(b, sp, cd)
    b.onmouseleave = hideTip
    el.appendChild(b)
  })
  ;($('end-turn') as HTMLButtonElement).disabled = !my
}

function selectSpell(id: string | null) {
  if (!mine()) return
  selected = selected === id ? null : id
  renderBottom()
  updateOverlay()
}

function showSpellTip(anchor: HTMLElement, sp: SpellDef, cd: number) {
  const t = $('tooltip')
  const range = sp.target === 'self' ? 'Sur soi' : `Portée ${sp.rangeMin}-${sp.rangeMax}${sp.los ? '' : ' (sans ligne de vue)'}`
  t.innerHTML = `<h4>${sp.icon} ${sp.name}</h4><div class="meta">${sp.cost} PA · ${range}${sp.cooldown ? ` · relance ${sp.cooldown}` : ''}${sp.perTurn ? ` · ${sp.perTurn}/tour` : ''}${cd ? ` · <b>dispo dans ${cd}</b>` : ''}</div>${sp.desc}`
  t.classList.remove('hidden')
  const r = anchor.getBoundingClientRect()
  t.style.left = Math.max(8, Math.min(innerWidth - 270, r.left - 100)) + 'px'
  t.style.top = r.top - t.offsetHeight - 12 + 'px'
}
const hideTip = () => $('tooltip').classList.add('hidden')

// ------------------------------------------------------------------ plateau : survol, surbrillances
function updateOverlay() {
  if (!auth || auth.phase !== 'fighting') {
    scene.setOverlay([])
    scene.setFloaters([])
    return
  }
  const s = auth
  const u = activeUnit(s)
  const items: OverlayItem[] = []
  const floaters: Floater[] = []
  if (hover) items.push({ h: hover, fill: 0xffffff, alpha: 0.12 })

  if (mine()) {
    if (selected) {
      const sp = SPELLS[selected]
      const cells = castableCells(s, u, sp)
      const set = new Set(cells.map(key))
      cells.forEach((h) => items.push({ h, fill: 0x4aa8ff, alpha: 0.28, stroke: 0x4aa8ff }))
      if (hover && set.has(key(hover))) {
        const good = sp.effects.every((e) => e.type === 'heal' || e.type === 'shield' || (e.type === 'status' && e.status.kind === 'buff'))
        const area = areaCells(s, sp, u.pos, hover)
        area.forEach((h) => items.push({ h, fill: good ? 0x4cd964 : 0xff4a4a, alpha: 0.42, stroke: good ? 0x9dffb0 : 0xff9a9a }))
        // aperçu des dégâts : on simule avec le vrai moteur (valeurs moyennes)
        const sim = cloneState(s)
        simulateCast(sim, u.id, sp.id, hover)
        for (const x of sim.units) {
          const before = getUnit(s, x.id)
          const d = x.hp + x.shield - (before.hp + before.shield)
          if (!x.alive && before.alive) floaters.push({ unit: x.id, text: `☠ ${d}`, color: 0xff6a6a })
          else if (d < 0) floaters.push({ unit: x.id, text: `${d}`, color: 0xff8a8a })
          else if (d > 0) floaters.push({ unit: x.id, text: `+${d}`, color: 0x6dff8a })
          else if (x.statuses.length > before.statuses.length) floaters.push({ unit: x.id, text: x.statuses[x.statuses.length - 1].name, color: 0xc58bff })
        }
      }
    } else {
      reachCache ??= reachable(s, u)
      for (const [k, r] of reachCache) {
        if (r.cost === 0) continue
        const [q, rr] = k.split(',').map(Number)
        items.push({ h: { q, r: rr }, fill: 0x6dff8a, alpha: 0.16 })
      }
      if (hover) {
        const path = pathFrom(reachCache, hover)
        if (path && path.length > 1) path.slice(1).forEach((h) => items.push({ h, fill: 0xffe27a, alpha: 0.5, stroke: 0xffe27a }))
      }
    }
  }
  scene.setOverlay(items)
  scene.setFloaters(floaters)
}

function bindBoard() {
  const cv = scene.app.canvas
  cv.addEventListener('pointermove', (e) => {
    const h = scene.pick(e.clientX, e.clientY)
    if (!hover || !eq(h, hover)) {
      hover = h
      if (auth) {
        renderCard()
        updateOverlay()
      }
    }
  })
  cv.addEventListener('pointerleave', () => {
    hover = null
    if (auth) {
      renderCard()
      updateOverlay()
    }
  })
  cv.addEventListener('pointerdown', (e) => {
    if (!auth || !mine() || e.button !== 0) return
    const h = scene.pick(e.clientX, e.clientY)
    const u = activeUnit(auth)
    if (selected) {
      const ok = castableCells(auth, u, SPELLS[selected]).some((c) => eq(c, h))
      if (ok) sendAction({ type: 'cast', spell: selected, cell: h })
      else selectSpell(null)
    } else {
      reachCache ??= reachable(auth, u)
      const r = reachCache.get(key(h))
      if (r && r.cost > 0) sendAction({ type: 'move', to: h })
    }
  })
  cv.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    if (selected) selectSpell(null)
  })
  window.addEventListener('keydown', (e) => {
    if (!auth) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (mine()) sendAction({ type: 'endTurn' })
    } else if (e.key === 'Escape') selectSpell(null)
    else if (/^[1-9]$/.test(e.key)) {
      const sp = spellsOf(activeUnit(auth))[Number(e.key) - 1]
      if (sp && mine() && canCast(activeUnit(auth), sp)) selectSpell(sp.id)
    }
  })
  $('end-turn').onclick = () => mine() && sendAction({ type: 'endTurn' })
}

// ------------------------------------------------------------------ menu
function hideMenu() {
  $('menu').classList.add('hidden')
}
function showMenu() {
  $('menu').classList.remove('hidden')
  renderMenu()
}

function classCard(id: string, selectedId: string, attr: string) {
  const d = CLASSES[id]
  return `<button class="btn cls ${selectedId === id ? 'sel' : ''}" ${attr}="${id}">
    <img src="${portraitUrl(id)}"/><div><b>${d.name}</b><small>${d.stats.maxHp} PV · ${d.stats.ap} PA · ${d.stats.mp} PM</small>
    <small>${d.spells.map((s) => SPELLS[s].icon).join(' ')}</small></div></button>`
}

function miniCard(id: string, selectedId: string, attr: string) {
  return `<button class="btn mini ${selectedId === id ? 'sel' : ''}" ${attr}="${id}" title="${CLASSES[id].name}">
    <img src="${portraitUrl(id)}"/><span>${CLASSES[id].name}</span></button>`
}

function renderMenu() {
  const el = $('menu')
  if (el.classList.contains('hidden')) return
  const solo = menu.mode === 'solo'
  const spellList = (cid: string) =>
    CLASSES[cid].spells
      .map((s) => `<div class="spellrow"><span>${SPELLS[s].icon}</span><b style="color:#e8eaf4">${SPELLS[s].name}</b> <span>${SPELLS[s].cost} PA</span> — ${SPELLS[s].desc}</div>`)
      .join('')
  el.innerHTML = `
  <div class="card">
    <h1>⬡ Coplarpon</h1>
    <div class="sub">Prototype de combat tactique au tour par tour sur grille hexagonale.</div>
    <div class="row">
      <button class="btn ${solo ? 'sel' : ''}" data-mode="solo">🧑 Solo (dans le navigateur)</button>
      <button class="btn ${!solo ? 'sel' : ''}" data-mode="multi">🌐 Multijoueur (serveur)</button>
    </div>
    ${
      solo
        ? `<h2>Ton groupe (3 héros)</h2>
           <div class="row">${menu.party.map((c, i) => `<div class="slot"><div style="font-size:11px;color:var(--dim);margin-bottom:4px">Héros ${i + 1}</div>${Object.keys(CLASSES)
             .map((id) => miniCard(id, c, `data-slot="${i}" data-cls`))
             .join('')}</div>`).join('')}</div>`
        : `<h2>Serveur</h2>
           <div class="row"><input type="text" id="url" value="${menu.url}" size="26"/><input type="text" id="pname" value="${menu.name}" size="14"/>
           <button class="btn" id="connect">${menu.connected ? '✅ Connecté — rejoindre à nouveau' : 'Se connecter'}</button></div>
           <h2>Ta classe</h2><div class="row">${Object.keys(CLASSES).map((id) => classCard(id, menu.myClass, 'data-my')).join('')}</div>
           <h2>Joueurs dans le salon</h2><div class="lobby-list">${
             menu.players.length ? menu.players.map((p) => `<p>• <b>${p.name}</b> — ${CLASSES[p.classId].name}</p>`).join('') : `<p style="color:var(--dim)">Personne pour l'instant.</p>`
           }</div>`
    }
    <h2>Rencontre</h2>
    <div class="row">${ENCOUNTERS.map((e) => `<button class="btn enc ${menu.encounter === e.id ? 'sel' : ''}" data-enc="${e.id}"><b>${e.name}</b><small>${e.desc}</small></button>`).join('')}</div>
    <h2>Sorts</h2>
    <details><summary style="cursor:pointer;color:var(--dim)">Voir les sorts des classes</summary>
      ${Object.keys(CLASSES).map((c) => `<div style="margin-top:8px"><b>${CLASSES[c].name}</b>${spellList(c)}</div>`).join('')}
    </details>
    <div class="err">${menu.err}</div>
    <div class="row" style="justify-content:flex-end;margin-top:8px">
      <button class="btn primary" id="start" ${!solo && (!menu.connected || !menu.players.length) ? 'disabled' : ''}>⚔️ Lancer le combat</button>
    </div>
  </div>`
  el.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => (b.onclick = () => {
    menu.mode = b.dataset.mode as 'solo' | 'multi'
    menu.err = ''
    if (menu.mode === 'solo') connect()
    renderMenu()
  }))
  el.querySelectorAll<HTMLElement>('[data-slot]').forEach((b) => (b.onclick = () => {
    menu.party[Number(b.dataset.slot)] = b.getAttribute('data-cls')!
    renderMenu()
  }))
  el.querySelectorAll<HTMLElement>('[data-my]').forEach((b) => (b.onclick = () => {
    menu.myClass = b.getAttribute('data-my')!
    if (menu.connected) transport?.send({ t: 'join', name: menu.name, classId: menu.myClass })
    renderMenu()
  }))
  el.querySelectorAll<HTMLElement>('[data-enc]').forEach((b) => (b.onclick = () => {
    menu.encounter = b.dataset.enc!
    renderMenu()
  }))
  const url = el.querySelector<HTMLInputElement>('#url')
  if (url) url.oninput = () => (menu.url = url.value)
  const pn = el.querySelector<HTMLInputElement>('#pname')
  if (pn) pn.oninput = () => (menu.name = pn.value)
  const c = el.querySelector<HTMLElement>('#connect')
  if (c) c.onclick = () => connect()
  ;($('menu').querySelector('#start') as HTMLElement).onclick = startFight
}

// ------------------------------------------------------------------ démarrage
async function main() {
  await scene.init($('game'))
  scene.speed = Number(params.get('speed') ?? 1)
  bindBoard()
  connect()
  showMenu()
  ;(window as unknown as { __game: unknown }).__game = {
    start: (enc?: string) => { if (enc) menu.encounter = enc; startFight() },
    state: () => auth,
    screenOf: (h: Hex) => scene.screenOf(h),
    castable: (spell: string) => (auth ? castableCells(auth, activeUnit(auth), SPELLS[spell]) : []),
  }
}
void main()
