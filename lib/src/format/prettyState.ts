import { defOf } from '#cards/Deck.js'
import type { Card, CardSuit } from '#cards/types.js'
import type { Action } from '#actions/types.js'
import type { Event } from '#events/types.js'
import { FALL } from '#map/fall.js'
import { FALL_LAYOUT } from '#layout/fall.js'
import { toAscii } from '#layout/render/ascii.js'
import { fallForestDisplayId } from '#public/fallMetadata.js'
import type { LogEntry } from '#log/types.js'
import type { Seat } from '#pieces/types.js'
import { DECREE_COLUMNS } from '#state/boards.js'
import {
  ELECTRIC_EYRIE_DECREE_COLUMNS,
  type AutomatedAllianceBoard,
  type ElectricEyrieBoard,
  type MechanicalMarquiseBoard,
  type VagabotBoard,
  type VagabotItem,
} from '#state/botBoards.js'
import type { GameState, PlayerState } from '#state/types.js'

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
  /** Hand cards: card id, craft cost and the whole effect text. */
  detail?: boolean
}

export function cardLabel(card: Card, opts: CardLabelOpts = {}): string {
  try {
    const d = defOf(card)
    const bits = [d.name, `[${d.suit}]`]
    if (d.type === 'item' && d.item) bits.push(`item:${d.item}`)
    if (d.vp != null && d.vp > 0) bits.push(`+${d.vp}vp`)
    if (d.type !== 'item') bits.push(`(${d.type})`)
    if (opts.detail) {
      if (d.cost.length > 0) bits.push(`cost=${d.cost.join('+')}`)
      bits.push(`id=${card.id}`)
    }
    let label = bits.join(' ')
    if (opts.detail && d.description) return `${label} — ${d.description}`
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

function boardLines(
  state: GameState,
  player: GameState['players'][number],
): string[] {
  const board = player.board
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
  if (board.kind === 'vagabond') {
    let pawn = 'pawn: (missing)'
    if (board.forest !== null) {
      pawn = `pawn: FOREST ${fallForestDisplayId(board.forest)}`
    } else {
      for (let clearingId = 0; clearingId < state.clearings.length; clearingId++) {
        const hasPawn = state.clearings[clearingId]?.pieces.some(
          (piece) => piece.kind === 'pawn' && piece.owner === player.seat,
        )
        if (hasPawn === true) {
          pawn = `pawn: C${clearingId}`
          break
        }
      }
    }
    return [
      `    ${pawn}`,
      `    satchel: ${board.satchel.length} damaged=${board.damaged.length}`,
      `    tracks: tea=${board.tracks.tea.length} coin=${board.tracks.coin.length} bag=${board.tracks.bag.length}`,
    ]
  }
  if (board.kind === 'mechanicalMarquise' || board.kind === 'electricEyrie') {
    return botBoardLines(board)
  }
  if (board.kind === 'automatedAlliance') {
    return automatedAllianceLines(board)
  }
  if (board.kind === 'vagabot') {
    return vagabotLines(board)
  }
  return [`    board: ${JSON.stringify(board)}`]
}

function orderCardText(board: AutomatedAllianceBoard | VagabotBoard): string {
  return board.orderCard === null ? '(none)' : formatDecreeColumn([board.orderCard])
}

/** Rule: Rootbotics 6 — order card, Bases box, Sympathy track. */
function automatedAllianceLines(board: AutomatedAllianceBoard): string[] {
  return [
    `    bot: warriors=${board.supply.warriors} order=${orderCardText(board)}`,
    `    bases on board: ${board.bases.join(',') || '(none)'} sympathyTrack=${board.sympathyTrack.placed}`,
  ]
}

/** Rule: Rootbotics 7 — order card, character, pawn, items, quest. */
function vagabotLines(board: VagabotBoard): string[] {
  const count = (matches: (item: VagabotItem) => boolean): number =>
    board.items.filter(matches).length
  const forest = board.forest === null ? 'clearing' : `F${fallForestDisplayId(board.forest)}`
  return [
    `    bot: ${board.character} order=${orderCardText(board)} pawn=${forest} quest=${board.quest?.defId ?? '(none)'}`,
    `    items: faceUp=${count((item: VagabotItem): boolean => !item.damaged && !item.exhausted)} exhausted=${count((item: VagabotItem): boolean => !item.damaged && item.exhausted)} damaged=${count((item: VagabotItem): boolean => item.damaged)}`,
  ]
}

/** Rule: Rootbotics 4–5 — order card, then tracks or Decree by suit. */
function botBoardLines(board: MechanicalMarquiseBoard | ElectricEyrieBoard): string[] {
  const order = board.orderCard === null ? '(none)' : formatDecreeColumn([board.orderCard])
  if (board.kind === 'mechanicalMarquise') {
    const tracks = board.tracks
    return [
      `    bot: warriors=${board.supply.warriors} order=${order}`,
      `    tracks: sawmill=${tracks.sawmill.placed} workshop=${tracks.workshop.placed} recruiter=${tracks.recruiter.placed}`,
    ]
  }
  return [
    `    bot: warriors=${board.supply.warriors} order=${order} roostTrack=${board.roostTrack.placed}`,
    '    decree:',
    ...ELECTRIC_EYRIE_DECREE_COLUMNS.map(
      (column: CardSuit): string => `      ${column}: ${formatDecreeColumn(board.decree[column])}`,
    ),
  ]
}

function playerBlock(
  state: GameState,
  p: GameState['players'][number],
  handDetail: boolean,
): string[] {
  return [
    `  ${playerRef(p)} VP=${p.vp}`,
    ...cardsBlock('    ', 'hand', p.hand, { detail: handDetail }),
    ...cardsBlock('    ', 'crafted', p.playArea, { effect: true }),
    `    items: ${p.craftedItems.length ? p.craftedItems.map((item) => `${item.type}${item.exhausted ? ' (exhausted)' : ''}`).join(', ') : '(none)'}`,
    ...boardLines(state, p),
  ]
}

function describePawnDestination(
  to: number | `forest:${number}`,
): string {
  if (typeof to === 'string' && to.startsWith('forest:')) {
    const forestIndex = Number(to.slice('forest:'.length))
    return `FOREST ${fallForestDisplayId(forestIndex)}`
  }
  return `C${to}`
}

/** Human-readable action line (no card ids). */
export function describeAction(action: Action, state: GameState): string {
  /** Card of an action as `name … (card id)`: readable, and exact for a replay. */
  const findCard = (id: string): string => {
    for (const p of state.players) {
      const c = [...p.hand, ...p.playArea].find((x) => x.id === id)
      if (c) return `${cardLabel(c)} (${id})`
    }
    const label: string = cardLabel({ id, defId: id.split('#')[0]! })
    // `cardLabel` falls back to the id for a card it does not know.
    return label === id ? id : `${label} (${id})`
  }

  switch (action.type) {
    case 'join':
      return `JOIN player="${action.playerId}"`
    case 'expel':
      return `EXPEL s${action.seat}`
    case 'start':
      return 'START game'
    case 'endPhase':
      return `END PHASE (${state.phase}/${state.step})`
    case 'birdsongWood':
      return 'BIRDSONG place wood at sawmills'
    case 'botStep':
      return `BOT STEP (${state.phase}/${state.step})`
    case 'revealOrder':
      return `BOT REVEAL ORDER ${findCard(action.cardId)}`
    case 'botCraft':
      return `BOT CRAFT ${findCard(action.cardId)}`
    case 'botRecruit':
      return `BOT RECRUIT ${action.count}w C${action.clearing}`
    case 'botBuild':
      return `BOT BUILD ${action.building} C${action.clearing}`
    case 'botMove':
      return `BOT MOVE ${action.count}w C${action.from}→C${action.to}`
    case 'botBattle':
      return `BOT BATTLE s${action.defender} C${action.clearing}`
    case 'botTurmoil':
      return 'BOT TURMOIL'
    case 'botRevolt':
      return `BOT REVOLT C${action.clearing}`
    case 'botSpreadSympathy':
      return `BOT SPREAD SYMPATHY C${action.clearing}`
    case 'botOrganize':
      return `BOT ORGANIZE C${action.clearing}`
    case 'eveningDraw':
      return 'EVENING draw cards'
    case 'march':
      return `MOVE ${action.moves.map((m) => `${m.count}w C${m.from}→C${m.to}`).join(', ')}`
    case 'battle':
      return `ATTACK C${action.clearing} vs ${playerRefBySeat(state, action.defender)}`
    case 'build': {
      const woodSpent =
        action.woodClearings.length === 0
          ? ''
          : ` wood[${action.woodClearings.map((clearing) => `C${clearing}`).join(',')}]`
      return `BUILD ${action.building} at C${action.clearing}${woodSpent}`
    }
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
      return `SWAP MEET take a random card from ${playerRefBySeat(state, action.target)}`
    case 'charmOffensive':
      return `CHARM OFFENSIVE draw + 1 VP to ${playerRefBySeat(state, action.target)}`
    case 'informantsTakeAmbush':
      return `INFORMANTS take ${findCard(action.cardId)} from discard`
    case 'leagueMove':
      return `LEAGUE MOVE ${action.from}→${action.to} x${action.count} (item ${action.itemIndex})`
    case 'leagueBattle':
      return `LEAGUE BATTLE c${action.clearing} vs ${playerRefBySeat(state, action.defender)} (item ${action.itemIndex})`
    case 'propagandaBureau':
      return `PROPAGANDA spend ${findCard(action.cardId)} → replace ${action.pieceId} @c${action.clearing}`
    case 'saboteurs':
      return `SABOTEURS discard self → discard ${findCard(action.cardId)} from ${playerRefBySeat(state, action.target)}`
    case 'falseOrders':
      return `FALSE ORDERS force ${playerRefBySeat(state, action.target)} ${action.from}→${action.to}`
    case 'eyrieEmigre':
      return action.defender === undefined
        ? `ÉMIGRE move ${action.from}→${action.to} x${action.count}, no enemy to battle → card discarded`
        : `ÉMIGRE move ${action.from}→${action.to} x${action.count} then battle vs ${playerRefBySeat(state, action.defender)}`
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
    case 'slip':
      return `SLIP → ${describePawnDestination(action.to)}`
    case 'vbMove':
      return `VB MOVE → C${action.to}`
    case 'vbBattle':
      return `VB BATTLE vs ${playerRefBySeat(state, action.defender)}`
    case 'explore':
      return 'EXPLORE ruin'
    case 'aid':
      return `AID ${playerRefBySeat(state, action.target)} ${findCard(action.cardId)}`
    case 'strike':
      return `STRIKE vs ${playerRefBySeat(state, action.defender)}`
    case 'repair':
      return `REPAIR item#${action.itemIndex}`
    case 'vbCraft':
      return `VB CRAFT ${findCard(action.cardId)}`
    case 'steal':
      return `STEAL from ${playerRefBySeat(state, action.target)}`
    case 'dayLabor':
      return `DAY LABOR take ${findCard(action.cardId)}`
    case 'hideout':
      return `HIDEOUT repair ${action.items.map((item) => item.type).join(', ')}`
    case 'refresh':
      return 'REFRESH items'
    case 'rest':
      return 'REST (forest repair damaged)'
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
    case 'expel':
      return `EXPEL ${entry.playerId} (${entry.faction})`
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

function playersSection(state: GameState, handDetail = false): string[] {
  return [
    'players:',
    ...state.players.flatMap((p) => playerBlock(state, p, handDetail)),
  ]
}

function clearingsSection(state: GameState): string[] {
  const lines: string[] = ['clearings:']
  for (let id = 0; id < state.clearings.length; id++) {
    lines.push(...clearingBlock(state, id))
  }
  return lines
}

/**
 * Where each Vagabond pawn sits (forest only — skip empty forest catalog).
 * Rule: Board > Forests (2.4); Vagabond pawn may be in a forest.
 */
function forestsSection(state: GameState): string[] {
  const lines: string[] = ['forests:']
  let any = false
  for (const player of state.players) {
    if (player.board.kind !== 'vagabond' && player.board.kind !== 'vagabot') continue
    if (player.board.forest === null) continue
    any = true
    lines.push(
      `  ${playerRef(player)} @ F${fallForestDisplayId(player.board.forest)}`,
    )
  }
  if (!any) {
    lines.push('  (no vagabond in forest)')
  }
  return lines
}

function asciiMapBlock(_state: GameState): string[] {
  return [
    'map (clearing=id+suit; path=·; river=~; forest=[fN]):',
    toAscii(FALL, FALL_LAYOUT, {
      width: 64,
      height: 26,
      showSuit: true,
      showForests: true,
      showRivers: true,
    }),
  ]
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
 * Markdown ```diff``` of hierarchical players + forests + clearings blocks
 * (same layout as formatGameView, with -/+ on changed lines).
 */
export function formatPlayersClearingsDiff(
  before: GameState | null,
  after: GameState,
): { players: string; forests: string; clearings: string } {
  return {
    players: fenceDiff(
      before ? playersSection(before) : null,
      playersSection(after),
    ).join('\n'),
    forests: fenceDiff(
      before ? forestsSection(before) : null,
      forestsSection(after),
    ).join('\n'),
    clearings: fenceDiff(
      before ? clearingsSection(before) : null,
      clearingsSection(after),
    ).join('\n'),
  }
}

/** @deprecated keyed fact diff — prefer formatPlayersClearingsDiff */
export function formatStateDiff(before: GameState | null, after: GameState): string {
  const { players, forests, clearings } = formatPlayersClearingsDiff(before, after)
  return `${players}\n${forests}\n${clearings}`
}

export type PrettyGameOpts = {
  label?: string
  action?: Action
  historyLength?: number
  /** Hand cards with id, craft cost and whole text: the view of one player. */
  handDetail?: boolean
}

export type FormatGameLogOpts = PrettyGameOpts & {
  /** Prior state; when set, players/clearings render as markdown diff. */
  prev?: GameState | null
  /** Force plain players/clearings (no ```diff), e.g. CREATE / LOAD / START. */
  full?: boolean
  /** Turn-log entries from this apply (includes autoActions). */
  turnLog?: LogEntry[]
}

function gameHeader(state: GameState, opts: PrettyGameOpts & { turnLog?: LogEntry[] }): string[] {
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
  if (opts.turnLog !== undefined && opts.turnLog.length > 0) {
    lines.push('log:')
    for (const entry of opts.turnLog) {
      lines.push(`  ${describeLogEntry(entry, state)}`)
    }
  }
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
    const { players, forests, clearings } = formatPlayersClearingsDiff(
      opts.prev ?? null,
      state,
    )
    lines.push(players)
    lines.push(...asciiMapBlock(state))
    lines.push(forests)
    lines.push(clearings)
  } else {
    lines.push(...playersSection(state, opts.handDetail))
    lines.push(...asciiMapBlock(state))
    lines.push(...forestsSection(state))
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
