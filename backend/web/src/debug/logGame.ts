import { appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FALL,
  FALL_LAYOUT,
  defOf,
  toAscii,
  type Action,
  type GameState,
} from '@root/lib'

type Piece = GameState['clearings'][number]['pieces'][number]
type Card = GameState['players'][number]['hand'][number]

/** Repo root `./logs` (…/Root/logs), not cwd. */
const LOGS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../logs')

let currentLogFile: string | null = null

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** `dd-mm-yyyy-<hh>h<mm>m.log`; collide → append `-ss`. */
function newLogPath(now = new Date()): string {
  mkdirSync(LOGS_DIR, { recursive: true })
  const base =
    `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}` +
    `-${pad(now.getHours())}h${pad(now.getMinutes())}m`
  let path = join(LOGS_DIR, `${base}.log`)
  if (!existsSync(path)) return path
  path = join(LOGS_DIR, `${base}-${pad(now.getSeconds())}s.log`)
  if (!existsSync(path)) return path
  let i = 2
  while (existsSync(join(LOGS_DIR, `${base}-${pad(now.getSeconds())}s-${i}.log`))) i++
  return join(LOGS_DIR, `${base}-${pad(now.getSeconds())}s-${i}.log`)
}

/** Open fresh log file for a new game (call on CREATE). */
export function beginGameLog(): string {
  currentLogFile = newLogPath()
  appendFileSync(currentLogFile, `=== game log opened ${new Date().toISOString()} ===\n`, 'utf8')
  return currentLogFile
}

function cardLabel(card: Card): string {
  try {
    const d = defOf(card)
    const bits = [d.name, `[${d.suit}]`]
    if (d.type === 'item' && d.item) bits.push(`item:${d.item}`)
    if (d.vp != null && d.vp > 0) bits.push(`+${d.vp}vp`)
    if (d.type !== 'item') bits.push(`(${d.type})`)
    return bits.join(' ')
  } catch {
    return card.id
  }
}

function cardsBlock(indent: string, label: string, cards: Card[]): string[] {
  if (cards.length === 0) return [`${indent}${label}: (none)`]
  return [`${indent}${label}:`, ...cards.map((c) => `${indent}  - ${cardLabel(c)}`)]
}

function pieceShort(p: Piece): string {
  if (p.kind === 'warrior') return 'w'
  if (p.kind === 'pawn') return 'pawn'
  if (p.kind === 'building') return p.type
  return p.type
}

/** Clearing header + one line per seat. */
function clearingBlock(state: GameState, id: number): string[] {
  const c = state.clearings[id]!
  const meta = FALL.clearings[id]!
  const bySeat = new Map<number, string[]>()
  for (const p of c.pieces) {
    const list = bySeat.get(p.owner) ?? []
    list.push(pieceShort(p))
    bySeat.set(p.owner, list)
  }
  const ruin = c.ruin?.items?.length ? ` ruin=[${c.ruin.items.join(',')}]` : ''
  const lines: string[] = [`  C${id} ${meta.suit} slots=${meta.slots}${ruin}`]
  for (const player of state.players) {
    const parts = bySeat.get(player.seat) ?? []
    if (parts.length === 0) {
      lines.push(`    s${player.seat}: (none)`)
      continue
    }
    const w = parts.filter((x) => x === 'w').length
    const rest = parts.filter((x) => x !== 'w')
    const chunk: string[] = []
    if (w > 0) chunk.push(`${w}w`)
    chunk.push(...rest)
    lines.push(`    s${player.seat}: ${chunk.join('+')}`)
  }
  if (state.players.length === 0 && c.pieces.length === 0) {
    lines.push('    (empty)')
  }
  return lines
}

function boardLines(board: GameState['players'][number]['board']): string[] {
  if (board.kind === 'marquise') {
    const t = board.tracks
    return [
      `    supply: warriors=${board.supply.warriors} wood=${board.supply.wood}`,
      `    tracks: sawmill=${t.sawmill.placed} workshop=${t.workshop.placed} recruiter=${t.recruiter.placed}`,
    ]
  }
  return [`    board: ${JSON.stringify(board)}`]
}

function playerBlock(p: GameState['players'][number]): string[] {
  return [
    `  seat${p.seat} ${p.playerId} (${p.faction}) VP=${p.vp}`,
    ...cardsBlock('    ', 'hand', p.hand),
    ...cardsBlock('    ', 'play', p.playArea),
    `    items: ${p.craftedItems.length ? p.craftedItems.join(', ') : '(none)'}`,
    ...boardLines(p.board),
  ]
}

function describeAction(action: Action, state: GameState): string {
  const findCard = (id: string) => {
    for (const p of state.players) {
      const c = [...p.hand, ...p.playArea].find((x) => x.id === id)
      if (c) return cardLabel(c)
    }
    try {
      const defId = id.split('#')[0]!
      return cardLabel({ id, defId })
    } catch {
      return id
    }
  }

  switch (action.type) {
    case 'join':
      return `JOIN player="${action.playerId}"`
    case 'start':
      return 'START game'
    case 'endPhase':
      return `END PHASE (${state.phase}/${state.step})`
    case 'birdsongWood':
      return 'BIRDSONG place wood at sawmills'
    case 'eveningDraw':
      return 'EVENING draw cards'
    case 'march':
      return `MOVE ${action.moves.map((m) => `${m.count}w C${m.from}→C${m.to}`).join(', ')}`
    case 'battle':
      return `ATTACK C${action.clearing} vs seat${action.defender}`
    case 'build':
      return `BUILD ${action.building} at C${action.clearing}`
    case 'craft':
      return `CRAFT ${findCard(action.cardId)}`
    case 'overwork':
      return `OVERWORK C${action.clearing} spend ${findCard(action.cardId)}`
    case 'recruit':
      return 'RECRUIT warriors at recruiters'
    case 'spendBird':
      return `SPEND BIRD ${findCard(action.cardId)} (+1 action)`
    case 'discard':
      return `DISCARD ${action.cardIds.map(findCard).join('; ')}`
    case 'swapMeet':
      return `SWAP MEET give ${findCard(action.giveCardId)} ↔ seat${action.target}`
    case 'resolveEvent': {
      const bits: string[] = ['RESOLVE EVENT']
      if (action.decline) bits.push('decline')
      if (action.cardId) bits.push(`card=${findCard(action.cardId)}`)
      if (action.pieceIds?.length) bits.push(`pieces=[${action.pieceIds.join(',')}]`)
      if (action.order) bits.push(`order=[${action.order.join(',')}]`)
      if (action.useEffect !== undefined) bits.push(`useEffect=${action.useEffect}`)
      return bits.join(' ')
    }
    default:
      return JSON.stringify(action)
  }
}

function formatEvent(label: string, state: GameState, action?: Action): string {
  const lines: string[] = ['', '──────── game ────────']
  lines.push(`[${label}] turn=${state.turn} seat=${state.currentSeat} ${state.phase}/${state.step} (${state.status})`)
  if (state.winner !== undefined) lines.push(`winner: seat${state.winner}`)
  if (action) lines.push(`action: ${describeAction(action, state)}`)

  lines.push('players:')
  for (const p of state.players) lines.push(...playerBlock(p))

  lines.push('map (id+suit F=fox R=rabbit M=mouse):')
  lines.push(toAscii(FALL, FALL_LAYOUT, { width: 56, height: 22, showSuit: true }))

  lines.push('clearings:')
  for (let id = 0; id < state.clearings.length; id++) {
    lines.push(...clearingBlock(state, id))
  }

  if (state.pending.length > 0) {
    lines.push(`pending: ${JSON.stringify(state.pending)}`)
  }
  lines.push('──────────────────────', '')
  return lines.join('\n')
}

/** Console + file dump after each mutating game call. */
export function logGameEvent(label: string, state: GameState, action?: Action): void {
  if (label === 'CREATE') {
    const path = beginGameLog()
    console.log(`game log → ${path}`)
  }

  const text = formatEvent(label, state, action)
  console.log(text)

  if (!currentLogFile) beginGameLog()
  appendFileSync(currentLogFile!, text, 'utf8')
}
