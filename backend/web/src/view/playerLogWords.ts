import {
  describeAction,
  describeLogEntry,
  type GameState,
  type PlayerState,
} from '@root/lib'
import type { ViewerLogEntry } from '#view/redactLogForViewer.js'

type Piece = GameState['clearings'][number]['pieces'][number]
type PiecesEntry = Extract<ViewerLogEntry, { t: 'pieces' }>
type EventEntry = Extract<ViewerLogEntry, { t: 'event' }>
type BattleEvent = Extract<EventEntry['event'], { type: 'battle' }>

const CLAUSE_SEPARATOR = '; '
const LIST_SEPARATOR = ', '

/** Faction with its seat code, e.g. `eyrie (s1)`. */
function factionRef(state: GameState, seat: number): string {
  const faction: string | undefined = state.players.find(
    (player: PlayerState): boolean => player.seat === seat,
  )?.faction
  return faction === undefined
    ? `s${String(seat)}`
    : `${faction} (s${String(seat)})`
}

function pieceName(piece: Piece): string {
  return piece.kind === 'building' || piece.kind === 'token'
    ? piece.type
    : piece.kind
}

/** `eyrie (s1) lost 2 warrior, 1 roost` for every owner among `pieces`. */
function describePieceChange(
  state: GameState,
  pieces: readonly Piece[],
  verb: string,
): string[] {
  const ownerSeats = [...new Set<number>(pieces.map((piece: Piece): number => piece.owner))]
  return ownerSeats.map((seat: number): string => {
    const names: string[] = pieces
      .filter((piece: Piece): boolean => piece.owner === seat)
      .map(pieceName)
    const counted: string[] = [...new Set<string>(names)].map(
      (name: string): string =>
        `${String(names.filter((candidate: string): boolean => candidate === name).length)} ${name}`,
    )
    return `${factionRef(state, seat)} ${verb} ${counted.join(LIST_SEPARATOR)}`
  })
}

function describePieces(entry: PiecesEntry, state: GameState): string {
  const clauses: string[] = [
    ...describePieceChange(state, entry.placed ?? [], 'placed'),
    ...describePieceChange(state, entry.removed ?? [], 'lost'),
  ]
  return `C${String(entry.clearing)}: ${clauses.join(CLAUSE_SEPARATOR)}`
}

function describeBattle(event: BattleEvent, state: GameState): string {
  const attacker = factionRef(state, event.attacker)
  const defender = factionRef(state, event.defender)
  const clauses: string[] = [
    `BATTLE at C${String(event.clearing)}: ${attacker} attacks ${defender} (stage ${event.stage})`,
  ]
  if (event.rolls !== undefined) {
    clauses.push(
      `dice rolled ${String(event.rolls[0])} and ${String(event.rolls[1])}`,
    )
  }
  if (event.hits.attacker > 0 || event.hits.defender > 0) {
    // `hits.attacker` are the hits the attacker deals: the defender takes them.
    clauses.push(
      `hits still to take: ${defender} ${String(event.hits.attacker)}, ${attacker} ${String(event.hits.defender)}`,
    )
  }
  return clauses.join(CLAUSE_SEPARATOR)
}

/**
 * One log line in plain words for a player: factions by name, who gained or
 * lost what. `state` must already be the view of that player.
 */
export function describePlayerLogEntry(
  entry: ViewerLogEntry,
  state: GameState,
): string {
  switch (entry.t) {
    case 'join':
      return `JOIN (${entry.faction})`
    case 'expel':
      return `EXPEL (${entry.faction})`
    case 'action':
      return `${factionRef(state, entry.actor)}: ${describeAction(entry.action, state)}`
    case 'vp':
      return `${factionRef(state, entry.actor)} ${entry.delta >= 0 ? 'scored' : 'lost'} ${String(Math.abs(entry.delta))} VP (${entry.reason})`
    case 'pieces':
      return describePieces(entry, state)
    case 'phase':
      return `${factionRef(state, entry.actor)} is now in ${entry.phase}/${entry.step}`
    case 'event':
      return entry.event.type === 'battle'
        ? describeBattle(entry.event, state)
        : describeLogEntry(entry, state)
    case 'win':
      return `${factionRef(state, entry.winner)} wins the game`
    default:
      return describeLogEntry(entry, state)
  }
}
