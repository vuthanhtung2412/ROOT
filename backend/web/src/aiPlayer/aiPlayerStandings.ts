import {
  EYRIE_ROOST_VP,
  type FactionId,
  type Game,
  type GameState,
  type PlayerState,
} from '@root/lib'

export const VICTORY_POINT_GOAL = 30

const ROOST_BUILDING = 'roost'
const HIGHEST_ROOST_TRACK_INDEX = EYRIE_ROOST_VP.length - 1

type Piece = GameState['clearings'][number]['pieces'][number]

export type PlayerStanding = {
  faction: FactionId
  seat: number
  you: boolean
  victoryPoints: number
  victoryPointsToGoal: number
  handSize: number
  warriorsOnMap: number
  /** Building or token type → how many are on the map. */
  buildingsOnMap: Record<string, number>
  tokensOnMap: Record<string, number>
  craftedItems: string[]
  /** Points the faction scores at its next Evening if the map stays as it is. */
  sureVictoryPointsNextEvening?: { points: number; from: string }
}

export type Standings = {
  goal: number
  turn: number
  /** Highest score first. */
  players: PlayerStanding[]
  /** Pieces still on your faction board. */
  yourSupply: Record<string, number>
}

function countByType(types: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const type of types) {
    counts[type] = (counts[type] ?? 0) + 1
  }
  return counts
}

function supplyOf(player: PlayerState): Record<string, number> {
  return 'supply' in player.board ? { ...player.board.supply } : {}
}

function standingOf(
  state: GameState,
  player: PlayerState,
  playerId: string,
): PlayerStanding {
  const pieces: Piece[] = state.clearings.flatMap(
    (clearing: GameState['clearings'][number]): Piece[] =>
      clearing.pieces.filter(
        (piece: Piece): boolean => piece.owner === player.seat,
      ),
  )
  const buildingsOnMap = countByType(
    pieces.flatMap((piece: Piece): string[] =>
      piece.kind === 'building' ? [piece.type] : [],
    ),
  )
  const standing: PlayerStanding = {
    faction: player.faction,
    seat: player.seat,
    you: player.playerId === playerId,
    victoryPoints: player.vp,
    victoryPointsToGoal: Math.max(0, VICTORY_POINT_GOAL - player.vp),
    handSize: player.hand.length,
    warriorsOnMap: pieces.filter(
      (piece: Piece): boolean => piece.kind === 'warrior',
    ).length,
    buildingsOnMap,
    tokensOnMap: countByType(
      pieces.flatMap((piece: Piece): string[] =>
        piece.kind === 'token' ? [piece.type] : [],
      ),
    ),
    craftedItems: player.craftedItems.map(
      (item: PlayerState['craftedItems'][number]): string => item.type,
    ),
  }
  if (player.board.kind !== 'eyrie') return standing
  // Rule: 7.6.1 — the Eyrie score their roosts on the map every Evening.
  const roosts = buildingsOnMap[ROOST_BUILDING] ?? 0
  return {
    ...standing,
    sureVictoryPointsNextEvening: {
      points:
        EYRIE_ROOST_VP[Math.min(roosts, HIGHEST_ROOST_TRACK_INDEX)] ?? 0,
      from: `${String(roosts)} roosts on the map at Evening`,
    },
  }
}

/**
 * The race to the goal: every score and what is on the map, all of it public.
 * Hands are counted, never read. Null when `playerId` holds no seat.
 */
export function buildStandings(game: Game, playerId: string): Standings | null {
  const state = game.state
  const viewer = state.players.find(
    (player: PlayerState): boolean => player.playerId === playerId,
  )
  if (viewer === undefined) return null
  return {
    goal: VICTORY_POINT_GOAL,
    turn: state.turn,
    players: state.players
      .map(
        (player: PlayerState): PlayerStanding =>
          standingOf(state, player, playerId),
      )
      .sort(
        (first: PlayerStanding, second: PlayerStanding): number =>
          second.victoryPoints - first.victoryPoints,
      ),
    yourSupply: supplyOf(viewer),
  }
}
