import type { Card } from '#cards/types.js'
import { Game } from '#game/Game.js'
import type { Ctx } from '#game/ctx.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import type { FactionId, Piece, Seat } from '#pieces/types.js'
import type { Rng } from '#rules/Rng.js'
import {
  EYRIE_LEADERS,
  eyrieLeaderPools,
  createFactionBoard,
  type EyrieBoard,
  type EyrieLeader,
  type MarquiseBoard,
} from '#state/boards.js'
import { ITEM_SUPPLY } from '#state/constants.js'
import type { ClearingState, GameState, PlayerState } from '#state/types.js'
import { createTurnScratch } from '#state/turnScratch.js'
import { buildRuleHooks } from '#triggers/buildHooks.js'
import { SignalBus } from '#triggers/SignalBus.js'
import type { GameSignal } from '#triggers/signals.js'

/** Root battle die face: 0–3 (physical Root dice). */
export type DieFace = 0 | 1 | 2 | 3

function assertDieFace(face: number): asserts face is DieFace {
  if (face !== 0 && face !== 1 && face !== 2 && face !== 3) {
    throw new Error(`createTestRng: invalid die face ${face} (must be 0–3)`)
  }
}

/** Impose die faces in order (0–3). No PRNG in tests. */
export function createTestRng(faces: DieFace[] = []): Rng {
  for (const face of faces) assertDieFace(face)
  let cursor = 0
  return {
    roll() {
      const face = faces[cursor++]
      if (face === undefined) {
        throw new Error(
          faces.length === 0
            ? 'createTestRng: no dice faces set — pass faces to impose results'
            : `createTestRng: exhausted after ${faces.length} rolls`,
        )
      }
      return face
    },
    toJSON: () => ({ seed: 0, cursor }),
  }
}

export function testContext(options?: {
  state?: GameState
  /** Imposed battle die faces (0–3) in roll order. Required if the test path rolls. */
  dice?: DieFace[]
  /** Override RNG (e.g. SeededRng for shuffles). Defaults to createTestRng(dice). */
  rng?: Rng
  onSignal?: (signal: GameSignal) => void
}): Ctx {
  const state = options?.state ?? minimalState()
  return {
    map: FALL,
    rng: options?.rng ?? createTestRng(options?.dice ?? []),
    emit: (signal) => options?.onSignal?.(signal),
    hooks: buildRuleHooks(state, FALL),
    grantedActions: () => [],
  }
}

/** Test context that dispatches signals to active crafted-card effects. */
export function buildCraftContext(state: GameState): Ctx {
  const context = testContext({ state })
  const signalBus = new SignalBus()
  context.emit = (signal: GameSignal): void => {
    signalBus.emit(state, signal, context)
  }
  return context
}

export function marquiseBoard(
  overrides?: Partial<MarquiseBoard['supply']>,
): MarquiseBoard {
  return {
    kind: 'marquise',
    supply: { warriors: 25, wood: 8, ...overrides },
    tracks: {
      sawmill: { placed: 5 },
      workshop: { placed: 5 },
      recruiter: { placed: 5 },
    },
  }
}

export function eyrieBoard(overrides?: Partial<EyrieBoard>): EyrieBoard {
  const leader = overrides?.leader !== undefined ? overrides.leader : 'builder'
  const emptyLeadersFaceDown: EyrieBoard['leadersFaceDown'] = []
  const defaultPools =
    leader === null
      ? { leadersFaceUp: [...EYRIE_LEADERS], leadersFaceDown: emptyLeadersFaceDown }
      : eyrieLeaderPools(leader)
  return {
    kind: 'eyrie',
    supply: { warriors: 20 },
    decree: { recruit: [], move: [], battle: [], build: [] },
    roostTrack: { placed: 6 },
    ...overrides,
    leader,
    leadersFaceUp: overrides?.leadersFaceUp ?? defaultPools.leadersFaceUp,
    leadersFaceDown: overrides?.leadersFaceDown ?? defaultPools.leadersFaceDown,
  }
}

export function player(
  seat: Seat,
  faction: FactionId,
  overrides?: Partial<Omit<PlayerState, 'seat' | 'faction'>>,
): PlayerState {
  const board =
    faction === 'eyrie'
      ? eyrieBoard()
      : faction === 'alliance'
        ? createFactionBoard('alliance')
        : faction === 'vagabond'
          ? createFactionBoard('vagabond')
          : marquiseBoard()
  return {
    playerId: `p${seat}`,
    seat,
    faction,
    vp: 0,
    hand: [],
    playArea: [],
    craftedItems: [],
    board,
    ...overrides,
  }
}

export function emptyClearings(): ClearingState[] {
  return Array.from({ length: 12 }, () => ({ pieces: [] }))
}

export function minimalState(overrides?: Partial<GameState>): GameState {
  return {
    id: 'test',
    seed: 1,
    map: 'fall',
    status: 'playing',
    turn: 1,
    currentSeat: 0,
    phase: 'daylight',
    step: 'actions',
    factions: ['marquise', 'eyrie'],
    players: [player(0, 'marquise'), player(1, 'eyrie')],
    clearings: emptyClearings(),
    deck: { draw: [], discard: [] },
    dominanceAvailable: [],
    questDeck: [],
    questsAvailable: [],
    itemSupply: { ...ITEM_SUPPLY },
    pending: [],
    turnScratch: createTurnScratch({ actionsLeft: 3 }),
    ...overrides,
  }
}

export function withPieces(
  state: GameState,
  clearing: number,
  pieces: Piece[],
): GameState {
  const clearings = state.clearings.map((clearingState, index) =>
    index === clearing ? { ...clearingState, pieces: [...pieces] } : clearingState,
  )
  return { ...state, clearings }
}

export function card(defId: string, copyNumber = 1): Card {
  return { id: `${defId}#${copyNumber}`, defId }
}

/** Two-player lobby (joined, not started). Default seed 42. */
export function createLobbyGame(seed = 42): Game {
  const game = Game.create({ seed })
  game.join('a')
  game.join('b')
  return game
}

/** Lobby through keep + starting buildings; pending chooseLeader. */
export function createLobbyAfterKeep(seed = 42): Game {
  const game = createLobbyGame(seed)
  game.start()
  game.apply({ type: 'resolveEvent', clearing: FALL.corners[0]! })
  resolveStartingBuildings(game)
  return game
}

export function resolveStartingBuildings(game: Game): void {
  while (game.state.pending[0]?.type === 'placeStartingBuilding') {
    const clearings = game.legalActions()[0]?.params?.clearing
    if (clearings === undefined || clearings.length === 0) {
      throw new Error('no legal starting building clearings')
    }
    game.apply({ type: 'resolveEvent', clearing: clearings[0]! })
  }
}

export type FinishSetupOptions = {
  keep?: ClearingId
  leader?: EyrieLeader
}

export function finishSetup(
  game: Game,
  options: FinishSetupOptions = {},
): void {
  if (game.state.pending[0]?.type === 'chooseKeep') {
    game.apply({
      type: 'resolveEvent',
      clearing: options.keep ?? FALL.corners[0]!,
    })
  }
  resolveStartingBuildings(game)
  if (game.state.pending[0]?.type === 'chooseLeader') {
    game.apply({
      type: 'resolveEvent',
      leader: options.leader ?? 'builder',
    })
  }
}

export type CreatePlayingGameOptions = FinishSetupOptions & {
  seed?: number
  playerIds?: [string, string]
}

export function createPlayingGame(
  options: CreatePlayingGameOptions = {},
): Game {
  const game = Game.create({ seed: options.seed ?? 42 })
  const playerIds = options.playerIds ?? ['a', 'b']
  game.join(playerIds[0])
  game.join(playerIds[1])
  game.start()
  finishSetup(game, options)
  return game
}

