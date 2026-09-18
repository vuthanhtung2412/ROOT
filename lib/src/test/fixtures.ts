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

/** Test die mode: fixed faces in order, or seeded PRNG. */
export type TestDie =
  | { mode: 'fixed'; faces: number[] }
  | { mode: 'seeded'; seed?: number; cursor?: number }

/** Resolve test dice — `fixed` returns faces in order (1–6). */
export function testRng(die?: TestDie): Rng {
  if (die?.mode === 'fixed') {
    const faces = die.faces
    let i = 0
    return {
      roll() {
        const n = faces[i++]
        if (n === undefined) {
          throw new Error(`testRng fixed: exhausted after ${faces.length} rolls`)
        }
        return n
      },
      toJSON: () => ({ seed: 0, cursor: i }),
    }
  }
  return new SeededRng({ seed: die?.seed ?? 1, cursor: die?.cursor ?? 0 })
}

export function testCtx(opts?: {
  state?: GameState
  die?: TestDie
  onSignal?: (s: GameSignal) => void
}): Ctx {
  const state = opts?.state ?? minimalState()
  return {
    map: FALL,
    rng: testRng(opts?.die),
    emit: (s) => opts?.onSignal?.(s),
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
  const clearings = state.clearings.map((c, i) =>
    i === clearing ? { ...c, pieces: [...pieces] } : c,
  )
  return { ...state, clearings }
}

export function card(defId: string, n = 1): Card {
  return { id: `${defId}#${n}`, defId }
}
