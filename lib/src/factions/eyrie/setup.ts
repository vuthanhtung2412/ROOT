import type { Card } from '#cards/types.js'
import { isVizier, makeViziers } from '#factions/eyrie/viziers.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { placeUpTo } from '#rules/place.js'
import { RuleError } from '#rules/RuleError.js'
import {
  DECREE_COLUMNS,
  EYRIE_LEADERS,
  type DecreeColumn,
  type EyrieBoard,
  type EyrieLeader,
} from '#state/boards.js'
import type { GameState } from '#state/types.js'
import { boardOf } from '#factions/eyrie/rules.js'
import { baseFactionOf } from '#factions/bots/botFactions.js'

/** Rule: Eyrie > Setup 2 — free corner, prefer diagonally opposite Marquise keep. */
export function eyrieStartClearing(state: GameState): ClearingId {
  const taken = new Set<ClearingId>()
  let marquiseKeep: ClearingId | null = null
  for (const player of state.players) {
    if (baseFactionOf(player.faction) !== 'marquise') continue
    for (const corner of FALL.corners) {
      const hasKeep = state.clearings[corner]!.pieces.some(
        (piece) =>
          piece.kind === 'token' &&
          piece.type === 'keep' &&
          piece.owner === player.seat,
      )
      if (hasKeep) {
        taken.add(corner)
        marquiseKeep = corner
      }
    }
  }
  const preferred =
    marquiseKeep !== null
      ? FALL.opposite(marquiseKeep)
      : FALL.opposite(FALL.corners[0])
  if (!taken.has(preferred)) return preferred
  for (const corner of FALL.corners) {
    if (!taken.has(corner)) return corner
  }
  return preferred
}

/** Rule: 7.8 — Loyal Viziers begin on these Decree columns per leader. */
export const LEADER_VIZIER_COLUMNS: Record<
  EyrieLeader,
  readonly [DecreeColumn, DecreeColumn]
> = {
  builder: ['recruit', 'move'],
  charismatic: ['recruit', 'battle'],
  commander: ['move', 'battle'],
  despot: ['move', 'build'],
}

export function tuckViziersFor(
  board: EyrieBoard,
  leader: EyrieLeader,
  viziers?: Card[],
): void {
  const [firstColumn, secondColumn] = LEADER_VIZIER_COLUMNS[leader]
  const pair = viziers ?? makeViziers()
  board.decree = { recruit: [], move: [], battle: [], build: [] }
  if (pair[0]) board.decree[firstColumn].push(pair[0])
  if (pair[1]) board.decree[secondColumn].push(pair[1])
}

/** Rule: Eyrie > Setup 2 + 5 — roost + warriors; leader chosen later (7.3.3). */
export function placeEyrieRoostSetup(state: GameState, seat: Seat): void {
  const board = boardOf(state, seat)
  board.supply.warriors = 20
  board.leader = null
  board.leadersFaceUp = [...EYRIE_LEADERS]
  board.leadersFaceDown = []
  board.roostTrack.placed = 6
  board.decree = { recruit: [], move: [], battle: [], build: [] }

  const start = eyrieStartClearing(state)
  placeUpTo(state, {
    seat,
    clearing: start,
    spec: { kind: 'building', type: 'roost' },
    count: 1,
  })
  placeUpTo(state, {
    seat,
    clearing: start,
    spec: { kind: 'warrior' },
    count: 6,
  })
}

/** Rule: 7.3.3 / 7.7.3 — put chosen leader in slot; retuck viziers (existing or new). */
export function assignEyrieLeader(
  board: EyrieBoard,
  leader: EyrieLeader,
): void {
  if (!board.leadersFaceUp.includes(leader)) {
    throw new RuleError('LEADER_NOT_FACE_UP', { leader })
  }
  const existingViziers = DECREE_COLUMNS.flatMap((column) =>
    board.decree[column].filter(isVizier),
  )
  board.leader = leader
  board.leadersFaceUp = board.leadersFaceUp.filter(
    (candidate) => candidate !== leader,
  )
  tuckViziersFor(
    board,
    leader,
    existingViziers.length > 0 ? existingViziers : undefined,
  )
}
