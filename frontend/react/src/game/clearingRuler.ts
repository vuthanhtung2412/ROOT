/**
 * Rule: Board > Rule — warriors + buildings; tie → none;
 * Eyrie wins ties (Lords of the Forest). Tokens/pawns do not count.
 */

const GARDEN_PIECE_TYPE = 'garden'

export type ClearingPiecesForRule = {
  pieces: ReadonlyArray<{
    kind: string
    owner: number
    type?: string
  }>
}

export function ruleStrengthForSeat(
  clearing: ClearingPiecesForRule,
  seat: number,
): number {
  let total = 0
  for (const piece of clearing.pieces) {
    if (piece.owner !== seat) {
      continue
    }
    if (piece.kind === 'warrior' || piece.kind === 'building') {
      total += 1
    }
  }
  return total
}

export function clearingRuler(
  clearing: ClearingPiecesForRule,
  factions: readonly string[],
): number | null {
  // Rule: 10.2.4 Pilgrims — the Lizard Cult rules wherever it has a garden.
  const garden = clearing.pieces.find(
    (piece) => piece.kind === 'building' && piece.type === GARDEN_PIECE_TYPE,
  )
  if (garden !== undefined) {
    return garden.owner
  }
  const strengths = new Map<number, number>()
  for (let seat = 0; seat < factions.length; seat += 1) {
    const strength = ruleStrengthForSeat(clearing, seat)
    if (strength > 0) {
      strengths.set(seat, strength)
    }
  }
  if (strengths.size === 0) {
    return null
  }
  let max = 0
  for (const strength of strengths.values()) {
    if (strength > max) {
      max = strength
    }
  }
  const tied: number[] = []
  for (const [seat, strength] of strengths.entries()) {
    if (strength === max) {
      tied.push(seat)
    }
  }
  if (tied.length === 1) {
    return tied[0]!
  }
  const eyrieTied = tied.filter((seat) => factions[seat] === 'eyrie')
  if (eyrieTied.length > 0) {
    return eyrieTied.sort((left, right) => left - right)[0]!
  }
  return null
}
