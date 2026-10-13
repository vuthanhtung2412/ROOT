import {
  FALL,
  openSlots,
  type ActionSpec,
  type FactionId,
  type Game,
  type GameState,
  type PlayerState,
} from '@root/lib'
import { listPlayerLegalActions } from '#view/playerView.js'

type Piece = GameState['clearings'][number]['pieces'][number]

export type FactionPieces = {
  warriors: number
  buildings: string[]
  tokens: string[]
  /** True when the Vagabond pawn stands here. */
  pawn: boolean
}

export type NeighborClearing = {
  id: number
  suit: string
  ruler: FactionId | null
}

export type ClearingDetail = {
  id: number
  suit: string
  slots: { total: number; free: number }
  /** Items still in the ruin; absent when the clearing holds no ruin. */
  ruinItems?: string[]
  ruler: FactionId | null
  /** Only factions with a piece here. */
  pieces: Partial<Record<FactionId, FactionPieces>>
  /** Clearings one move away by path. */
  adjacent: NeighborClearing[]
  /** Clearings linked by river: a move only for factions that use rivers. */
  byRiver: number[]
  /** Your legal action types that name this clearing right now. */
  legalActionsHereNow: string[]
  /** True when a legal action moves your pieces out of this clearing now. */
  youCanMoveFromHere: boolean
  /** True when a legal action places one of your buildings here now. */
  youCanBuildHere: boolean
  /** Why you cannot build here now; absent when you can. */
  whyNotBuild?: string
}

/** Action types that place a building of the acting faction. */
const BUILD_ACTION_TYPES: readonly string[] = [
  'build',
  'newRoost',
  'ritualBuild',
  'sanctify',
  'revolt',
]
const DECREE_ACTION_TYPE = 'decree'
const DECREE_BUILD_COLUMN = 'build'
/** Factions that build only in a clearing they rule. Rule: 6.5.4, 7.5.2.IV, 10.5.1. */
const FACTIONS_BUILDING_WHERE_THEY_RULE: readonly FactionId[] = [
  'marquise',
  'eyrie',
  'lizard',
]
const NO_SLOT_REASON = 'no free building slot in this clearing'
const KEEP_REASON =
  'the Marquise keep stands here: no other faction may place a piece'
const NOT_RULER_REASON = 'you do not rule this clearing'
const ROOST_HERE_REASON = 'you already have a roost here'
const NOT_NOW_REASON =
  'no build action names this clearing right now: wrong phase or step, or its cost is not met'

function placesBuilding(spec: ActionSpec): boolean {
  return (
    BUILD_ACTION_TYPES.includes(spec.type) ||
    (spec.type === DECREE_ACTION_TYPE &&
      (spec.params?.column ?? []).includes(DECREE_BUILD_COLUMN))
  )
}

function movesFrom(spec: ActionSpec, clearingId: number): boolean {
  return (
    (spec.params?.from ?? []).includes(clearingId) ||
    (spec.params?.moves ?? []).some(
      (move): boolean => move.from === clearingId,
    )
  )
}

type BuildCheck = {
  state: GameState
  viewer: PlayerState
  clearingId: number
  ruler: FactionId | null
}

/** First rule that stops the viewer from building in the clearing. */
function explainNoBuild(check: BuildCheck): string {
  const { state, viewer, clearingId, ruler } = check
  const pieces: readonly Piece[] = state.clearings[clearingId]?.pieces ?? []
  const foreignKeep: boolean = pieces.some(
    (piece: Piece): boolean =>
      piece.kind === 'token' &&
      piece.type === 'keep' &&
      piece.owner !== viewer.seat,
  )
  if (foreignKeep) return KEEP_REASON
  const ownRoost: boolean = pieces.some(
    (piece: Piece): boolean =>
      piece.kind === 'building' &&
      piece.type === 'roost' &&
      piece.owner === viewer.seat,
  )
  if (ownRoost) return ROOST_HERE_REASON
  if (
    FACTIONS_BUILDING_WHERE_THEY_RULE.includes(viewer.faction) &&
    ruler !== viewer.faction
  ) {
    return NOT_RULER_REASON
  }
  if (openSlots(state, clearingId) < 1) return NO_SLOT_REASON
  return NOT_NOW_REASON
}

function factionOfSeat(state: GameState, seat: number | null): FactionId | null {
  return (
    state.players.find((player: PlayerState): boolean => player.seat === seat)
      ?.faction ?? null
  )
}

function describePieces(pieces: readonly Piece[]): FactionPieces {
  return {
    warriors: pieces.filter((piece: Piece): boolean => piece.kind === 'warrior')
      .length,
    buildings: pieces.flatMap((piece: Piece): string[] =>
      piece.kind === 'building' ? [piece.type] : [],
    ),
    tokens: pieces.flatMap((piece: Piece): string[] =>
      piece.kind === 'token' ? [piece.type] : [],
    ),
    pawn: pieces.some((piece: Piece): boolean => piece.kind === 'pawn'),
  }
}

/** Every clearing a legal action lets the seat choose, whatever the param. */
function clearingsNamedBy(spec: ActionSpec): number[] {
  const params = spec.params
  if (params === undefined) return []
  const pairedClearings: number[] = [
    ...(params.options ?? []),
    ...(params.targets ?? []),
  ].flatMap((choice: object): number[] =>
    'clearing' in choice && typeof choice.clearing === 'number'
      ? [choice.clearing]
      : [],
  )
  return [
    ...(params.clearing ?? []),
    ...(params.clearings ?? []),
    ...(params.from ?? []),
    ...(params.to ?? []),
    ...(params.moves ?? []).flatMap((move): number[] => [move.from, move.to]),
    ...(params.vbMoves ?? []).map((move): number => move.to),
    ...pairedClearings,
  ]
}

/**
 * One clearing in full, so the model does not read it off the drawn map.
 * Everything here is on the table for all players. Null: no such clearing.
 */
export function describeClearing(
  game: Game,
  playerId: string,
  clearingId: number,
): ClearingDetail | null {
  const mapClearing = FALL.clearings[clearingId]
  const clearing = game.state.clearings[clearingId]
  if (mapClearing === undefined || clearing === undefined) return null
  const state = game.state
  const pieces: Partial<Record<FactionId, FactionPieces>> = {}
  for (const player of state.players) {
    const owned = clearing.pieces.filter(
      (piece: Piece): boolean => piece.owner === player.seat,
    )
    if (owned.length > 0) {
      pieces[player.faction] = describePieces(owned)
    }
  }
  const ruler = factionOfSeat(state, game.rulerOf(clearingId))
  const actionsHere: ActionSpec[] = listPlayerLegalActions(
    game,
    playerId,
  ).filter((spec: ActionSpec): boolean =>
    clearingsNamedBy(spec).includes(clearingId),
  )
  const youCanBuildHere: boolean = actionsHere.some(placesBuilding)
  const viewer = state.players.find(
    (player: PlayerState): boolean => player.playerId === playerId,
  )
  return {
    id: clearingId,
    suit: mapClearing.suit,
    slots: { total: mapClearing.slots, free: openSlots(state, clearingId) },
    ...(clearing.ruin === undefined ? {} : { ruinItems: clearing.ruin.items }),
    ruler,
    pieces,
    adjacent: FALL.adjacent(clearingId).map(
      (neighbor: number): NeighborClearing => ({
        id: neighbor,
        suit: FALL.clearings[neighbor]?.suit ?? '',
        ruler: factionOfSeat(state, game.rulerOf(neighbor)),
      }),
    ),
    byRiver: FALL.riverClearings().filter((candidate: number): boolean =>
      FALL.isRiverAdjacent(clearingId, candidate),
    ),
    legalActionsHereNow: [
      ...new Set<string>(
        actionsHere.map((spec: ActionSpec): string => spec.type),
      ),
    ],
    youCanMoveFromHere: actionsHere.some((spec: ActionSpec): boolean =>
      movesFrom(spec, clearingId),
    ),
    youCanBuildHere,
    ...(youCanBuildHere || viewer === undefined
      ? {}
      : { whyNotBuild: explainNoBuild({ state, viewer, clearingId, ruler }) }),
  }
}
