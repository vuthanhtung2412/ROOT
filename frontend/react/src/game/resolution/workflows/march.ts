import type { ActionSpec } from '#api/client.ts'
import {
  readChoiceParams,
  type ClientAction,
} from '#game/resolution/ActionComposer.ts'
import { clearingRuler } from '#game/clearingRuler.ts'
import { fallAdjacentClearings } from '@root/lib/fall-metadata'
import {
  applyMarchMovesToClearings,
  type ClearingPiecesSnapshot,
} from '#game/resolution/marchClearingsPreview.ts'
import type {
  MarchMove,
  ResolutionUi,
} from '#game/resolution/ResolutionUi.ts'

export type MarchBoardSnapshot = {
  clearings: ClearingPiecesSnapshot[]
  factions: readonly string[]
  seat: number
}

export type MarchBoardSource = {
  warriorCountsForCurrentSeat: () => Map<number, number>
  boardForMarch?: () => MarchBoardSnapshot | null
}

function unique(values: number[]): number[] {
  return [...new Set(values)]
}

function countsFromLegalMoves(legalMoves: MarchMove[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const move of legalMoves) {
    counts.set(move.from, Math.max(counts.get(move.from) ?? 0, move.count))
  }
  return counts
}

/** Apply one march leg to warrior counts (6.5.2 sequential). */
export function warriorCountsAfterMove(
  before: ReadonlyMap<number, number>,
  move: MarchMove,
): Map<number, number> {
  const next = new Map(before)
  next.set(move.from, (next.get(move.from) ?? 0) - move.count)
  next.set(move.to, (next.get(move.to) ?? 0) + move.count)
  return next
}

/** Adjacent march legs from warrior counts only (no rule check). */
export function legalMarchLegsFromCounts(
  counts: ReadonlyMap<number, number>,
): MarchMove[] {
  const moves: MarchMove[] = []
  for (const [from, available] of counts) {
    if (available < 1) {
      continue
    }
    for (const to of fallAdjacentClearings(from)) {
      for (let count = 1; count <= available; count += 1) {
        moves.push({ from, to, count })
      }
    }
  }
  return moves
}

/** Rule: 4.2.1 — must rule origin and/or destination. */
function marchLegRulesOriginOrDestination(
  clearings: readonly ClearingPiecesSnapshot[],
  factions: readonly string[],
  seat: number,
  move: MarchMove,
): boolean {
  const fromClearing = clearings[move.from]
  const toClearing = clearings[move.to]
  if (fromClearing === undefined || toClearing === undefined) {
    return false
  }
  return (
    clearingRuler(fromClearing, factions) === seat ||
    clearingRuler(toClearing, factions) === seat
  )
}

function secondLegMoves(input: {
  legalMoves: MarchMove[]
  initialCounts: Map<number, number>
  firstMove: MarchMove
  boardSnapshot: MarchBoardSnapshot | null
}): MarchMove[] {
  const afterFirstCounts = warriorCountsAfterMove(
    input.initialCounts,
    input.firstMove,
  )
  const adjacencyLegs = legalMarchLegsFromCounts(afterFirstCounts)
  const board = input.boardSnapshot
  if (board === null) {
    return adjacencyLegs
  }
  const clearingsAfterFirst = applyMarchMovesToClearings(
    board.clearings,
    board.seat,
    [input.firstMove],
  )
  return adjacencyLegs.filter((move) =>
    marchLegRulesOriginOrDestination(
      clearingsAfterFirst,
      board.factions,
      board.seat,
      move,
    ),
  )
}

async function pickMarchLeg(input: {
  ui: ResolutionUi
  legs: MarchMove[]
  moveIndex: '1' | '2'
  canConfirmOnDestination?: boolean
}): Promise<MarchMove | 'confirm'> {
  const { ui, legs, moveIndex } = input
  const originPick = await ui.pickClearing({
    message: `March ${moveIndex}/2 — pick origin`,
    clearings: unique(legs.map((move) => move.from)),
    canCancel: true,
  })
  if (originPick.kind === 'confirm') {
    return 'confirm'
  }
  const from = originPick.clearingId
  const fromMoves = legs.filter((move) => move.from === from)

  const destinationPick = await ui.pickClearing({
    message:
      moveIndex === '2'
        ? 'March 2/2 — pick destination'
        : `March ${moveIndex}/2 — pick destination`,
    clearings: unique(fromMoves.map((move) => move.to)),
    canConfirm: input.canConfirmOnDestination === true,
    canCancel: true,
  })
  if (destinationPick.kind === 'confirm') {
    return 'confirm'
  }
  const to = destinationPick.clearingId
  const candidates = fromMoves.filter((move) => move.to === to)
  const counts = unique(candidates.map((move) => move.count)).sort(
    (left, right) => left - right,
  )
  const countValue = await ui.pickOption({
    message: `March ${moveIndex}/2 — how many warriors?`,
    clearings: [from, to],
    options: counts.map((count) => ({
      label: `${String(count)} x warriors`,
      value: String(count),
    })),
    canCancel: true,
  })
  const count = Number(countValue)
  const match = candidates.find((move) => move.count === count)
  if (match === undefined) {
    throw new Error('March count not in legal moves')
  }
  return match
}

/**
 * Compound March (6.5.2) as a procedural workflow.
 * Reads top-to-bottom like Temporal: await each UI pick, then return action.
 */
export async function resolveMarch(
  spec: ActionSpec,
  ui: ResolutionUi,
  board?: MarchBoardSource,
): Promise<ClientAction> {
  const params = readChoiceParams(spec)
  const legalMoves = params.moves ?? []
  const fromBoard = board?.warriorCountsForCurrentSeat()
  const initialCounts =
    fromBoard !== undefined && fromBoard.size > 0
      ? fromBoard
      : countsFromLegalMoves(legalMoves)
  const boardSnapshot = board?.boardForMarch?.() ?? null

  const first = await pickMarchLeg({
    ui,
    legs: legalMoves,
    moveIndex: '1',
  })
  if (first === 'confirm') {
    throw new Error('Confirm not allowed before first march leg')
  }

  ui.setMarchPreview(first)

  const secondLegs = secondLegMoves({
    legalMoves,
    initialCounts,
    firstMove: first,
    boardSnapshot,
  })
  const afterFirst = await ui.pickClearing({
    message: `March 1 done (${String(first.count)}) — Confirm, or pick 2nd origin`,
    clearings: unique(secondLegs.map((move) => move.from)),
    canConfirm: true,
    canCancel: true,
  })
  if (afterFirst.kind === 'confirm') {
    return { type: 'march', moves: [first] }
  }

  const from2 = afterFirst.clearingId
  const from2Moves = secondLegs.filter((move) => move.from === from2)
  const destinationPick = await ui.pickClearing({
    message: 'March 2/2 — pick destination',
    clearings: unique(from2Moves.map((move) => move.to)),
    canConfirm: true,
    canCancel: true,
  })
  if (destinationPick.kind === 'confirm') {
    return { type: 'march', moves: [first] }
  }
  const to2 = destinationPick.clearingId
  const candidates = from2Moves.filter((move) => move.to === to2)
  const counts = unique(candidates.map((move) => move.count)).sort(
    (left, right) => left - right,
  )
  const countValue = await ui.pickOption({
    message: 'March 2/2 — how many warriors?',
    clearings: [from2, to2],
    options: counts.map((count) => ({
      label: `${String(count)} x warriors`,
      value: String(count),
    })),
    canCancel: true,
  })
  const count = Number(countValue)
  const second = candidates.find((move) => move.count === count)
  if (second === undefined) {
    throw new Error('Second march count not in legal moves')
  }
  return { type: 'march', moves: [first, second] }
}
