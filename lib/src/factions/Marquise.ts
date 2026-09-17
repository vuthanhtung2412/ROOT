import type { Action, ActionSpec } from '../actions/types.js'
import { FALL } from '../map/fall.js'
import type { ClearingId } from '../map/types.js'
import { playerOf } from '../queries/seat.js'
import { placeUpTo } from '../rules/place.js'
import { RuleError } from '../rules/RuleError.js'
import type { MarquiseBoard } from '../state/boards.js'
import type { GameState, Phase, Step } from '../state/types.js'
import type { Ctx } from '../game/ctx.js'
import type { LogEntry } from '../log/types.js'
import type { Seat } from '../pieces/types.js'
import { Faction } from './Faction.js'

const STEPS: Record<Phase, Step[]> = {
  birdsong: ['wood'],
  daylight: ['craft', 'actions'],
  evening: ['draw', 'discard'],
}

function marquiseSeats(state: GameState): Seat[] {
  return state.players
    .filter((p) => p.faction === 'marquise')
    .map((p) => p.seat)
    .sort((a, b) => a - b)
}

/** Rule: Marquise > Setup 1–2 — 1st cat corners[0], 2nd opposite. */
export function keepCornerFor(state: GameState, seat: Seat): ClearingId {
  const seats = marquiseSeats(state)
  const index = seats.indexOf(seat)
  if (index < 0) throw new RuleError('NOT_MARQUISE', { seat })
  if (index === 0) return FALL.corners[0]
  if (index === 1) return FALL.opposite(FALL.corners[0])
  return FALL.corners[index % 4]!
}

function isTwoCatGame(state: GameState): boolean {
  return marquiseSeats(state).length >= 2
}

function garrisonClearings(state: GameState, keep: ClearingId): ClearingId[] {
  if (isTwoCatGame(state)) {
    // House rule: 2-cat garrison = keep + adjacent only.
    return [keep, ...FALL.adjacent(keep)]
  }
  // Rule: Marquise > Setup 3 — all clearings except diagonally opposite corner.
  const opposite = FALL.opposite(keep)
  return Array.from({ length: 12 }, (_, id) => id as ClearingId).filter(
    (id) => id !== opposite,
  )
}

function placeStartingBuildings(state: GameState, seat: Seat, keep: ClearingId): void {
  // House rule: keep first, then adjacent by ascending clearing id.
  const targets = [keep, ...FALL.adjacent(keep).sort((a, b) => a - b)]
  for (const type of ['sawmill', 'workshop', 'recruiter'] as const) {
    for (const clearing of targets) {
      if (placeUpTo(state, seat, clearing, { kind: 'building', type }, 1) > 0) break
    }
  }
}

function fillTracks(board: MarquiseBoard): void {
  // Rule: Marquise > Setup 5 — 5 of each on tracks; leftmost column empty.
  board.tracks.sawmill.placed = 5
  board.tracks.workshop.placed = 5
  board.tracks.recruiter.placed = 5
}

export class Marquise extends Faction {
  readonly id = 'marquise' as const
  readonly steps = STEPS

  setup(state: GameState, seat: Seat, _ctx: Ctx): void {
    const keep = keepCornerFor(state, seat)
    placeUpTo(state, seat, keep, { kind: 'token', type: 'keep' }, 1)

    for (const clearing of garrisonClearings(state, keep)) {
      placeUpTo(state, seat, clearing, { kind: 'warrior' }, 1)
    }

    placeStartingBuildings(state, seat, keep)

    const board = playerOf(state, seat).board
    if (board.kind !== 'marquise') throw new RuleError('NOT_MARQUISE', { seat })
    fillTracks(board)
  }

  legalActions(state: GameState, ctx: Ctx): ActionSpec[] {
    return [{ type: 'endPhase', actor: state.currentSeat }, ...ctx.grantedActions()]
  }

  validate(state: GameState, action: Action, _ctx: Ctx): void {
    if (action.type !== 'endPhase') {
      throw new RuleError('NOT_IMPLEMENTED', { action: action.type })
    }
  }

  apply(state: GameState, action: Action, _ctx: Ctx): LogEntry[] {
    return [{ t: 'action', actor: state.currentSeat, action }]
  }

  endTurn(state: GameState): void {
    for (const clearing of state.clearings) {
      for (const piece of clearing.pieces) {
        if (piece.kind === 'building' && piece.owner === state.currentSeat) {
          piece.used = false
        }
      }
    }
    state.turnScratch = { actionsLeft: 3, extraActions: 0 }
  }
}

export const MARQUISE = new Marquise()
