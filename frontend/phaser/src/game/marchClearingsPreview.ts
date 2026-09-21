export type MarchPreviewMove = {
  from: number
  to: number
  count: number
}

export type ClearingPieceSnapshot = {
  id: string
  kind: string
  owner: number
  type?: string
  used?: boolean
}

export type ClearingPiecesSnapshot = {
  pieces: ClearingPieceSnapshot[]
}

function copyClearings(
  clearings: readonly ClearingPiecesSnapshot[],
): ClearingPiecesSnapshot[] {
  return clearings.map((clearing) => ({
    pieces: clearing.pieces.map((piece) => {
      const copy: ClearingPieceSnapshot = {
        id: piece.id,
        kind: piece.kind,
        owner: piece.owner,
      }
      if (piece.type !== undefined) {
        copy.type = piece.type
      }
      if (piece.used !== undefined) {
        copy.used = piece.used
      }
      return copy
    }),
  }))
}

function applyOneMarchMove(
  clearings: ClearingPiecesSnapshot[],
  warriorOwnerSeat: number,
  move: MarchPreviewMove,
): ClearingPiecesSnapshot[] {
  const fromClearing = clearings[move.from]
  const toClearing = clearings[move.to]
  if (fromClearing === undefined || toClearing === undefined) {
    return clearings
  }

  const moved: ClearingPieceSnapshot[] = []
  const remaining: ClearingPieceSnapshot[] = []
  for (const piece of fromClearing.pieces) {
    if (
      moved.length < move.count &&
      piece.kind === 'warrior' &&
      piece.owner === warriorOwnerSeat
    ) {
      moved.push(piece)
    } else {
      remaining.push(piece)
    }
  }
  if (moved.length < move.count) {
    return clearings
  }

  return clearings.map((clearing, clearingId) => {
    if (clearingId === move.from) {
      return { pieces: remaining }
    }
    if (clearingId === move.to) {
      return { pieces: [...clearing.pieces, ...moved] }
    }
    return clearing
  })
}

/**
 * Optimistic board preview: move warrior pieces for completed march legs
 * before the server acknowledges the compound march action.
 */
export function applyMarchMovesToClearings(
  clearings: readonly ClearingPiecesSnapshot[],
  warriorOwnerSeat: number,
  moves: readonly MarchPreviewMove[],
): ClearingPiecesSnapshot[] {
  let next = copyClearings(clearings)
  for (const move of moves) {
    next = applyOneMarchMove(next, warriorOwnerSeat, move)
  }
  return next
}
