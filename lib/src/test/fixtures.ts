import type { Card } from '../cards/types.js'
import type { Ctx } from '../game/ctx.js'
import { FALL } from '../map/fall.js'
import type { FactionId, Piece, Seat } from '../pieces/types.js'
import type { Rng } from '../rules/Rng.js'
import type { EyrieBoard, MarquiseBoard } from '../state/boards.js'
import { ITEM_SUPPLY } from '../state/constants.js'
import type { ClearingState, GameState, PlayerState } from '../state/types.js'
import { buildRuleHooks } from '../triggers/buildHooks.js'
import type { GameSignal } from '../triggers/signals.js'

/** Root battle die face: 1–3 (not a d6). */
export type DieFace = 1 | 2 | 3

function assertDieFace(face: number): asserts face is DieFace {
  if (face !== 1 && face !== 2 && face !== 3) {
    throw new Error(`createTestRng: invalid die face ${face} (must be 1–3)`)
  }
}

/** Impose die faces in order (1–3). No PRNG in tests. */
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
  /** Imposed battle die faces (1–3) in roll order. Required if the test path rolls. */
  dice?: DieFace[]
  onSignal?: (signal: GameSignal) => void
}): Ctx {
  const state = options?.state ?? minimalState()
  return {
    map: FALL,
    rng: createTestRng(options?.dice ?? []),
    emit: (signal) => options?.onSignal?.(signal),
    hooks: buildRuleHooks(state, FALL),
    grantedActions: () => [],
  }
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
  return {
    kind: 'eyrie',
    supply: { warriors: 20 },
    leader: 'builder',
    decree: { recruit: [], move: [], battle: [], build: [] },
    roostTrack: { placed: 6 },
    ...overrides,
  }
}

export function player(
  seat: Seat,
  faction: FactionId,
  overrides?: Partial<Omit<PlayerState, 'seat' | 'faction'>>,
): PlayerState {
  return {
    playerId: `p${seat}`,
    seat,
    faction,
    vp: 0,
    hand: [],
    playArea: [],
    craftedItems: [],
    board: faction === 'eyrie' ? eyrieBoard() : marquiseBoard(),
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
    itemSupply: { ...ITEM_SUPPLY },
    pending: [],
    turnScratch: {
      actionsLeft: 3,
      extraActions: 0,
      recruited: false,
      birdsongWoodDone: false,
      eveningDrawDone: false,
      swapMeetUsed: false,
      emergencyOrdersDone: false,
      eveningScoreDone: false,
      decree: null,
    },
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
