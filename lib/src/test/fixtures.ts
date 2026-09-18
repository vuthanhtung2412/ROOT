import type { Card } from '../cards/types.js'
import type { Ctx } from '../game/ctx.js'
import { FALL } from '../map/fall.js'
import type { MarquiseBoard } from '../state/boards.js'
import type { FactionId, Piece, Seat } from '../pieces/types.js'
import type { Rng } from '../rules/Rng.js'
import { SeededRng } from '../rules/Rng.js'
import { ITEM_SUPPLY } from '../state/constants.js'
import type { ClearingState, GameState, PlayerState } from '../state/types.js'
import { buildRuleHooks } from '../triggers/buildHooks.js'
import type { GameSignal } from '../triggers/signals.js'

/** Test dice resolution: fixed faces in order, or seeded PRNG. */
export type TestDice =
  | { mode: 'fixed'; faces: number[] }
  | { mode: 'seeded'; seed?: number; cursor?: number }

/** Build test RNG — `fixed` returns faces in order (1–6). */
export function createTestRng(dice?: TestDice): Rng {
  if (dice?.mode === 'fixed') {
    const faces = dice.faces
    let cursor = 0
    return {
      roll() {
        const face = faces[cursor++]
        if (face === undefined) {
          throw new Error(`createTestRng fixed: exhausted after ${faces.length} rolls`)
        }
        return face
      },
      toJSON: () => ({ seed: 0, cursor }),
    }
  }
  return new SeededRng({ seed: dice?.seed ?? 1, cursor: dice?.cursor ?? 0 })
}

export function testContext(options?: {
  state?: GameState
  dice?: TestDice
  onSignal?: (signal: GameSignal) => void
}): Ctx {
  const state = options?.state ?? minimalState()
  return {
    map: FALL,
    rng: createTestRng(options?.dice),
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
    board: marquiseBoard(),
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
    factions: ['marquise', 'marquise'],
    players: [player(0, 'marquise'), player(1, 'marquise')],
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
