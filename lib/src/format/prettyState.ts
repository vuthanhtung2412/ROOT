import { defOf } from '../cards/Deck.js'
import type { Card } from '../cards/types.js'
import type { Action } from '../actions/types.js'
import { FALL } from '../map/fall.js'
import { FALL_LAYOUT } from '../layout/fall.js'
import { toAscii } from '../layout/render/ascii.js'
import type { GameState } from '../state/types.js'

type Piece = GameState['clearings'][number]['pieces'][number]

export function cardLabel(card: Card): string {
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

/** Human-readable action line (no card ids). */
export function describeAction(action: Action, state: GameState): string {
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

export type PrettyGameOpts = {
  label?: string
  action?: Action
  historyLength?: number
}

/** Human-readable game dump for CLI / server logs. */
export function formatGameView(state: GameState, opts: PrettyGameOpts = {}): string {
  const lines: string[] = ['', '──────── game ────────']
  const head =
    (opts.label ? `[${opts.label}] ` : '') +
    `turn=${state.turn} seat=${state.currentSeat} ${state.phase}/${state.step} (${state.status})` +
    (opts.historyLength !== undefined ? ` history=${opts.historyLength}` : '')
  lines.push(head)
  lines.push(`id=${state.id} seed=${state.seed}`)
  if (state.winner !== undefined) lines.push(`winner: seat${state.winner}`)
  if (opts.action) lines.push(`action: ${describeAction(opts.action, state)}`)

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
