import { Color } from 'three'

/**
 * Birthday edition: the swatch of the "Birthday assets" mockup board, tokens
 * of `style.css` (frosting, berry, lizard, balloon, mint, flame). Balloons and
 * confetti of the map pick from them.
 */
const BIRTHDAY_PARTY_COLORS: readonly number[] = [
  0xf2b8c6, 0xa63d58, 0xc9b530, 0x7fb3d5, 0x9fcfb0, 0xf5a623,
]

/** The party colour at a 0..1 roll of the dice. */
export function pickPartyColor(roll: number): Color {
  const index: number = Math.floor(roll * BIRTHDAY_PARTY_COLORS.length)
  return new Color(BIRTHDAY_PARTY_COLORS[index] ?? BIRTHDAY_PARTY_COLORS[0])
}
