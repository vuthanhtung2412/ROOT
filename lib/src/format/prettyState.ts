import { defOf } from '../cards/Deck.js'
import type { Card, CardSuit } from '../cards/types.js'
import type { Action } from '../actions/types.js'
import type { Event } from '../events/types.js'
import { FALL } from '../map/fall.js'
import { FALL_LAYOUT } from '../layout/fall.js'
import { toAscii } from '../layout/render/ascii.js'
import type { LogEntry } from '../log/types.js'
import type { Seat } from '../pieces/types.js'
import { DECREE_COLUMNS } from '../state/boards.js'
import type { GameState, PlayerState } from '../state/types.js'

/** Stable suit order for decree tallies. */
const DECREE_SUIT_ORDER: CardSuit[] = ['fox', 'mouse', 'rabbit', 'bird']

type Piece = GameState['clearings'][number]['pieces'][number]

const EFFECT_MAX = 72

/** Faction + player name (not seat). */
export function playerRef(player: PlayerState): string {
  return `${player.faction}/${player.playerId}`
}

function playerRefBySeat(state: GameState, seat: Seat): string {
  const player = state.players.find((p) => p.seat === seat)
  return player ? playerRef(player) : `unknown/${seat}`
}

export type CardLabelOpts = {
  /** Append short card effect (for crafted / in-play cards). */
  effect?: boolean
}

export function cardLabel(card: Card, opts: CardLabelOpts = {}): string {
  try {
    const d = defOf(card)
    const bits = [d.name, `[${d.suit}]`]
    if (d.type === 'item' && d.item) bits.push(`item:${d.item}`)
    if (d.vp != null && d.vp > 0) bits.push(`+${d.vp}vp`)
    if (d.type !== 'item') bits.push(`(${d.type})`)
    let label = bits.join(' ')
    if (opts.effect && d.description) {
      const desc =
        d.description.length > EFFECT_MAX
          ? `${d.description.slice(0, EFFECT_MAX - 1)}…`
          : d.description
      label += ` — ${desc}`
    }
    return label
  } catch {
    return card.id
  }
}

function cardsBlock(
  indent: string,
  label: string,
  cards: Card[],
  opts: CardLabelOpts = {},
): string[] {
  if (cards.length === 0) return [`${indent}${label}: (none)`]
  return [
    `${indent}${label}:`,
    ...cards.map((c) => `${indent}  - ${cardLabel(c, opts)}`),
  ]
}

function pieceShort(p: Piece): string {
  if (p.kind === 'warrior') return 'w'
  if (p.kind === 'pawn') return 'pawn'
  if (p.kind === 'building') return p.type
  return p.type
}

/** Collapse duplicate non-warrior pieces: wood+wood → wood x2. Warriors stay as Nw. */
export function formatPieceChunk(parts: string[]): string {
  const warriors = parts.filter((x) => x === 'w').length
  const rest = parts.filter((x) => x !== 'w')
  const counts = new Map<string, number>()
  for (const p of rest) counts.set(p, (counts.get(p) ?? 0) + 1)
  const chunk: string[] = []
  if (warriors > 0) chunk.push(`${warriors}w`)
  for (const [name, n] of counts) {
    chunk.push(n > 1 ? `${name} x${n}` : name)
  }
  return chunk.join('+')
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
    const who = playerRef(player)
    if (parts.length === 0) {
      lines.push(`    ${who}: (none)`)
      continue
    }
    lines.push(`    ${who}: ${formatPieceChunk(parts)}`)
  }
  if (state.players.length === 0 && c.pieces.length === 0) {
    lines.push('    (empty)')
  }
  return lines
}

/** Suit counts for one decree column: `fox x2 bird x1` or `(none)`. */
export function formatDecreeColumn(cards: Card[]): string {
  if (cards.length === 0) return '(none)'
  const counts = new Map<CardSuit, number>()
  for (const c of cards) {
    const suit = defOf(c).suit
    counts.set(suit, (counts.get(suit) ?? 0) + 1)
  }
  return DECREE_SUIT_ORDER.filter((s) => counts.has(s))
    .map((s) => `${s} x${counts.get(s)!}`)
    .join(', ')
}

function boardLines(board: GameState['players'][number]['board']): string[] {
  if (board.kind === 'marquise') {
    const t = board.tracks
    return [
      `    supply: warriors=${board.supply.warriors} wood=${board.supply.wood}`,
      `    tracks: sawmill=${t.sawmill.placed} workshop=${t.workshop.placed} recruiter=${t.recruiter.placed}`,
    ]
  }
  if (board.kind === 'eyrie') {
    const d = board.decree
    return [
      `    supply: warriors=${board.supply.warriors} leader=${board.leader} roostTrack=${board.roostTrack.placed}`,
      '    decree:',
      ...DECREE_COLUMNS.map((col) => `      ${col}: ${formatDecreeColumn(d[col])}`),
    ]
  }
  return [`    board: ${JSON.stringify(board)}`]
}

function playerBlock(p: GameState['players'][number]): string[] {
  return [
    `  ${playerRef(p)} VP=${p.vp}`,
    ...cardsBlock('    ', 'hand', p.hand),
    ...cardsBlock('    ', 'crafted', p.playArea, { effect: true }),
    `    items: ${p.craftedItems.length ? p.craftedItems.map((item) => `${item.type}${item.exhausted ? ' (exhausted)' : ''}`).join(', ') : '(none)'}`,
    ...boardLines(p.board),
  ]
}

/** Human-readable action line (no card ids). */
export function describeAction(action: Action, state: GameState): string {
  const findCard = (id: string): string => {
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
      return `ATTACK C${action.clearing} vs ${playerRefBySeat(state, action.defender)}`
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
      return `SWAP MEET give ${findCard(action.giveCardId)} ↔ ${playerRefBySeat(state, action.target)}`
    case 'charmOffensive':
      return `CHARM OFFENSIVE draw + 1 VP to ${playerRefBySeat(state, action.target)}`
    case 'informantsTakeAmbush':
      return `INFORMANTS take ${findCard(action.cardId)} from discard`
    case 'leagueMove':
      return `LEAGUE MOVE ${action.from}→${action.to} x${action.count} (item ${action.itemIndex})`
    case 'leagueBattle':
      return `LEAGUE BATTLE c${action.clearing} vs ${playerRefBySeat(state, action.defender)} (item ${action.itemIndex})`
    case 'emergencyOrders':
      return 'EMERGENCY ORDERS draw 1'
    case 'eveningScore':
      return 'EVENING score roosts'
    case 'addToDecree':
      return `ADD TO DECREE ${action.cards.map((c) => `${findCard(c.cardId)}→${c.column}`).join(', ')}`
    case 'newRoost':
      return `NEW ROOST at C${action.clearing}`
    case 'turmoil':
      return 'TURMOIL'
    case 'decree': {
      const bits = [`DECREE ${action.column} ${findCard(action.cardId)}`]
      if (action.clearing !== undefined) bits.push(`C${action.clearing}`)
      if (action.defender !== undefined) {
        bits.push(`vs ${playerRefBySeat(state, action.defender)}`)
      }
      if (action.moves?.length) {
        bits.push(action.moves.map((m) => `${m.count}w C${m.from}→C${m.to}`).join(', '))
      }
      return bits.join(' ')
    }
    case 'resolveEvent': {
      const bits: string[] = ['RESOLVE EVENT']
      if (action.decline) bits.push('decline')
      if (action.cardId) bits.push(`card=${findCard(action.cardId)}`)
      if (action.pieceIds?.length) bits.push(`pieces=[${action.pieceIds.join(',')}]`)
      if (action.order) {
        bits.push(`order=[${action.order.map((seat) => playerRefBySeat(state, seat)).join(',')}]`)
      }
      if (action.useEffect !== undefined) bits.push(`useEffect=${action.useEffect}`)
      return bits.join(' ')
    }
    default:
      return JSON.stringify(action)
  }
}

function pieceSide(pieces: Piece[]): string {
  const bySeat = new Map<number, string[]>()
  for (const p of pieces) {
    const list = bySeat.get(p.owner) ?? []
    list.push(pieceShort(p))
    bySeat.set(p.owner, list)
  }
  return [...bySeat.entries()]
    .sort(([a], [b]) => a - b)
    .map(([seat, parts]) => `s${seat}:${formatPieceChunk(parts)}`)
    .join(' ')
}

function describeEvent(event: Event): string {
  switch (event.type) {
    case 'battle': {
      const bits = [
        `BATTLE C${event.clearing} s${event.attacker}→s${event.defender}`,
        `stage=${event.stage}`,
      ]
      if (event.rolls) bits.push(`roll=${event.rolls[0]}/${event.rolls[1]}`)
      if (event.hits.attacker || event.hits.defender) {
        bits.push(`hits a${event.hits.attacker}/d${event.hits.defender}`)
      }
      return bits.join(' ')
    }
    case 'fieldHospital':
      return `FIELD HOSPITAL s${event.victim} C${event.clearing} x${event.count}`
    case 'outrage':
      return `OUTRAGE s${event.offender} C${event.clearing}`
    case 'vagabondDamage':
      return `VAGABOND DAMAGE x${event.count}`
    default:
      return JSON.stringify(event)
  }
}

/** One human-readable line per turn-log entry (same voice as server action lines). */
export function describeLogEntry(entry: LogEntry, state: GameState): string {
  switch (entry.t) {
    case 'join':
      return `JOIN ${entry.playerId} (${entry.faction})`
    case 'start':
      return 'START game'
    case 'action':
      return `s${entry.actor} ${describeAction(entry.action, state)}`
    case 'vp':
      return `s${entry.actor} ${entry.delta >= 0 ? '+' : ''}${entry.delta}vp (${entry.reason})`
    case 'pieces': {
      const bits: string[] = [`pieces C${entry.clearing}`]
      if (entry.placed?.length) bits.push(`+${pieceSide(entry.placed)}`)
      if (entry.removed?.length) bits.push(`-${pieceSide(entry.removed)}`)
      return bits.join(' ')
    }
    case 'phase':
      return `s${entry.actor} → ${entry.phase}/${entry.step}`
    case 'event':
      return describeEvent(entry.event)
    case 'win':
      return `WIN seat${entry.winner}`
    default:
      return JSON.stringify(entry)
  }
}

/** Multi-line turn log for CLI. */
export function formatTurnLog(log: LogEntry[], state: GameState): string {
  if (log.length === 0) return '(empty log)'
  return log.map((e) => describeLogEntry(e, state)).join('\n')
}

function playersSection(state: GameState): string[] {
  return ['players:', ...state.players.flatMap((p) => playerBlock(p))]
}

function clearingsSection(state: GameState): string[] {
  const lines: string[] = ['clearings:']
  for (let id = 0; id < state.clearings.length; id++) {
    lines.push(...clearingBlock(state, id))
  }
  return lines
}

/** Classic line LCS → markdown diff body lines (` `/`-`/`+`). */
export function diffLines(before: string[], after: string[]): string[] {
  const n = before.length
  const m = after.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        before[i] === after[j]
          ? dp[i + 1]![j + 1]! + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }
  const out: string[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      out.push(`  ${before[i]}`)
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push(`- ${before[i]}`)
      i++
    } else {
      out.push(`+ ${after[j]}`)
      j++
    }
  }
  while (i < n) {
    out.push(`- ${before[i++]}`)
  }
  while (j < m) {
    out.push(`+ ${after[j++]}`)
  }
  return out
}

function fenceDiff(before: string[] | null, after: string[]): string[] {
  const body = before === null ? after.map((l) => `  ${l}`) : diffLines(before, after)
  return ['```diff', ...body, '```']
}

/**
 * Markdown ```diff``` of hierarchical players + clearings blocks
 * (same layout as formatGameView, with -/+ on changed lines).
 */
export function formatPlayersClearingsDiff(
  before: GameState | null,
  after: GameState,
): { players: string; clearings: string } {
  return {
    players: fenceDiff(
      before ? playersSection(before) : null,
      playersSection(after),
    ).join('\n'),
    clearings: fenceDiff(
      before ? clearingsSection(before) : null,
      clearingsSection(after),
    ).join('\n'),
  }
}

/** @deprecated keyed fact diff — prefer formatPlayersClearingsDiff */
export function formatStateDiff(before: GameState | null, after: GameState): string {
  const { players, clearings } = formatPlayersClearingsDiff(before, after)
  return `${players}\n${clearings}`
}

export type PrettyGameOpts = {
  label?: string
  action?: Action
  historyLength?: number
}

export type FormatGameLogOpts = PrettyGameOpts & {
  /** Prior state; when set, players/clearings render as markdown diff. */
  prev?: GameState | null
  /** Force plain players/clearings (no ```diff), e.g. CREATE / LOAD / START. */
  full?: boolean
}

function gameHeader(state: GameState, opts: PrettyGameOpts): string[] {
  const lines: string[] = ['', '──────── game ────────']
  const current = playerRefBySeat(state, state.currentSeat)
  const head =
    (opts.label ? `[${opts.label}] ` : '') +
    `turn=${state.turn} ${current} ${state.phase}/${state.step} (${state.status})` +
    (opts.historyLength !== undefined ? ` history=${opts.historyLength}` : '')
  lines.push(head)
  if (state.winner !== undefined) {
    lines.push(`winner: ${playerRefBySeat(state, state.winner)}`)
  }
  if (opts.action) lines.push(`action: ${describeAction(opts.action, state)}`)
  return lines
}

/**
 * Full frame every time: header + action + players + map + clearings.
 * When `prev` set (and not full), players/clearings are ```diff``` blocks.
 */
export function formatGameLogEntry(state: GameState, opts: FormatGameLogOpts = {}): string {
  const lines = gameHeader(state, opts)
  const useDiff = !opts.full && opts.prev !== undefined

  if (useDiff) {
    const { players, clearings } = formatPlayersClearingsDiff(opts.prev ?? null, state)
    lines.push(players)
    lines.push('map (id+suit F=fox R=rabbit M=mouse):')
    lines.push(toAscii(FALL, FALL_LAYOUT, { width: 56, height: 22, showSuit: true }))
    lines.push(clearings)
  } else {
    lines.push(...playersSection(state))
    lines.push('map (id+suit F=fox R=rabbit M=mouse):')
    lines.push(toAscii(FALL, FALL_LAYOUT, { width: 56, height: 22, showSuit: true }))
    lines.push(...clearingsSection(state))
  }

  if (state.pending.length > 0) {
    lines.push(`pending: ${JSON.stringify(state.pending)}`)
  }
  lines.push('──────────────────────', '')
  return lines.join('\n')
}

/** Human-readable game dump for CLI / server logs. */
export function formatGameView(state: GameState, opts: PrettyGameOpts = {}): string {
  return formatGameLogEntry(state, { ...opts, full: true })
}
