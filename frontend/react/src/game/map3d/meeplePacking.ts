/**
 * Where each meeple of a stack stands on the ground, as offsets from the
 * stack's centre (model units). Counts 1–4 match the tight packs used on the
 * table: one alone, a pair, a triangle, a square. Larger stacks fill a
 * centred grid so every warrior still shows.
 */

export type MeeplePackOffset = {
  x: number
  z: number
}

/** Centre-to-centre gap: warriors ~0.75 m tall, feet nearly touch. */
export const MEEPLE_PACK_SPACING = 0.55

const HALF = 0.5
/** Height of an equilateral triangle of side 1, over 2: √3 / 2. */
const EQUILATERAL_HALF_HEIGHT = Math.sqrt(3) * HALF
/** Peak of a centred equilateral triangle: 2/3 of that height. */
const TRIANGLE_PEAK_OFFSET = (EQUILATERAL_HALF_HEIGHT * 2) / 3
/** Base of a centred equilateral triangle: 1/3 of that height. */
const TRIANGLE_BASE_OFFSET = EQUILATERAL_HALF_HEIGHT / 3

/**
 * Pack layouts for 1–4, in units of {@link MEEPLE_PACK_SPACING}.
 * 3 = two in front, one behind (triangle); 4 = 2×2 square.
 */
const PACK_RATIOS_BY_COUNT: Readonly<
  Record<number, ReadonlyArray<readonly [number, number]>>
> = {
  1: [[0, 0]],
  2: [
    [-HALF, 0],
    [HALF, 0],
  ],
  3: [
    [-HALF, TRIANGLE_BASE_OFFSET],
    [HALF, TRIANGLE_BASE_OFFSET],
    [0, -TRIANGLE_PEAK_OFFSET],
  ],
  4: [
    [-HALF, -HALF],
    [HALF, -HALF],
    [-HALF, HALF],
    [HALF, HALF],
  ],
}

/** Centred square grid for stacks bigger than the fixed packs. */
function gridPackOffsets(count: number): MeeplePackOffset[] {
  const columnCount: number = Math.ceil(Math.sqrt(count))
  const rowCount: number = Math.ceil(count / columnCount)
  const uncentred: MeeplePackOffset[] = Array.from(
    { length: count },
    (_, index: number): MeeplePackOffset => {
      const row: number = Math.floor(index / columnCount)
      const column: number = index % columnCount
      const meeplesInRow: number =
        row === rowCount - 1 ? count - row * columnCount : columnCount
      return {
        x: (column - (meeplesInRow - 1) * HALF) * MEEPLE_PACK_SPACING,
        z: (row - (rowCount - 1) * HALF) * MEEPLE_PACK_SPACING,
      }
    },
  )
  // An incomplete last row pulls the average off centre: shift the pack back.
  const centreX: number =
    uncentred.reduce(
      (sum: number, offset: MeeplePackOffset): number => sum + offset.x,
      0,
    ) / count
  const centreZ: number =
    uncentred.reduce(
      (sum: number, offset: MeeplePackOffset): number => sum + offset.z,
      0,
    ) / count
  return uncentred.map(
    (offset: MeeplePackOffset): MeeplePackOffset => ({
      x: offset.x - centreX,
      z: offset.z - centreZ,
    }),
  )
}

/** Offsets of every meeple in a stack of `count`. */
export function meeplePackOffsets(count: number): MeeplePackOffset[] {
  const packedCount: number = Math.max(count, 1)
  const ratios: ReadonlyArray<readonly [number, number]> | undefined =
    PACK_RATIOS_BY_COUNT[packedCount]
  if (ratios === undefined) {
    return gridPackOffsets(packedCount)
  }
  return ratios.map(
    ([ratioX, ratioZ]: readonly [number, number]): MeeplePackOffset => ({
      x: ratioX * MEEPLE_PACK_SPACING,
      z: ratioZ * MEEPLE_PACK_SPACING,
    }),
  )
}
