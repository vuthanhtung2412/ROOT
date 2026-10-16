/**
 * Where things sit on the Rootbotics bot board scans (Root Database, 950 px
 * wide): centres and sizes as fractions of the image, so they scale with it.
 */

export type BoardSpot = {
  /** Centre, 0..1 of the image width. */
  x: number
  /** Centre, 0..1 of the image height. */
  y: number
}

export type BoardBox = {
  left: number
  top: number
  width: number
  height: number
}

type BotBoardLayout = {
  /** Image width / height. */
  aspectRatio: number
  /** One space, as a fraction of the image width. */
  spaceSize: number
  craftedItems: BoardBox
}

/** Mechanical Marquise board scanned from the printed board, 2090 px wide. */
const MECHANICAL_MARQUISE_WIDTH = 2090
const MECHANICAL_MARQUISE_HEIGHT = 1634
/** Electric Eyrie board from the official errata sheet, 2000 px wide. */
const ELECTRIC_EYRIE_WIDTH = 2000
const ELECTRIC_EYRIE_HEIGHT = 1543
/** Track spaces measured on the scans, in pixels. */
const MARQUISE_TRACK_SPACE_PIXELS = 140.5
const EYRIE_ROOST_SPACE_PIXELS = 126

/** Buildings track space centres, left to right, in scan pixels. */
const MARQUISE_TRACK_SPACE_X_PIXELS: readonly number[] = [
  1135.65, 1291.25, 1450.55, 1608.25, 1766.25, 1926.95,
]
const MARQUISE_TRACK_ROW_Y_PIXELS: Readonly<Record<string, number>> = {
  sawmill: 1057.65,
  workshop: 1240.95,
  recruiter: 1418.65,
}
/** Roosts track space centres, left to right, in scan pixels. */
const EYRIE_ROOST_SPACE_X_PIXELS: readonly number[] = [
  1004.4, 1147.2, 1291.7, 1432.4, 1580, 1722, 1868.2,
]
const EYRIE_ROOST_ROW_Y_PIXELS = 628.1

export const MECHANICAL_MARQUISE_BOARD_LAYOUT: BotBoardLayout & {
  trackSpaces: Readonly<Record<string, readonly BoardSpot[]>>
} = {
  aspectRatio: MECHANICAL_MARQUISE_WIDTH / MECHANICAL_MARQUISE_HEIGHT,
  spaceSize: MARQUISE_TRACK_SPACE_PIXELS / MECHANICAL_MARQUISE_WIDTH,
  craftedItems: {
    left: 1496.2 / MECHANICAL_MARQUISE_WIDTH,
    top: 189.7 / MECHANICAL_MARQUISE_HEIGHT,
    width: 506.9 / MECHANICAL_MARQUISE_WIDTH,
    height: 135.3 / MECHANICAL_MARQUISE_HEIGHT,
  },
  trackSpaces: Object.fromEntries(
    Object.entries(MARQUISE_TRACK_ROW_Y_PIXELS).map(
      ([building, rowY]: [string, number]): [string, BoardSpot[]] => [
        building,
        MARQUISE_TRACK_SPACE_X_PIXELS.map(
          (spaceX: number): BoardSpot => ({
            x: spaceX / MECHANICAL_MARQUISE_WIDTH,
            y: rowY / MECHANICAL_MARQUISE_HEIGHT,
          }),
        ),
      ],
    ),
  ),
}

export const ELECTRIC_EYRIE_BOARD_LAYOUT: BotBoardLayout & {
  roostSpaces: readonly BoardSpot[]
} = {
  aspectRatio: ELECTRIC_EYRIE_WIDTH / ELECTRIC_EYRIE_HEIGHT,
  spaceSize: EYRIE_ROOST_SPACE_PIXELS / ELECTRIC_EYRIE_WIDTH,
  craftedItems: {
    left: 1363.8 / ELECTRIC_EYRIE_WIDTH,
    top: 377.1 / ELECTRIC_EYRIE_HEIGHT,
    width: 502.2 / ELECTRIC_EYRIE_WIDTH,
    height: 120.6 / ELECTRIC_EYRIE_HEIGHT,
  },
  roostSpaces: EYRIE_ROOST_SPACE_X_PIXELS.map(
    (spaceX: number): BoardSpot => ({
      x: spaceX / ELECTRIC_EYRIE_WIDTH,
      y: EYRIE_ROOST_ROW_Y_PIXELS / ELECTRIC_EYRIE_HEIGHT,
    }),
  ),
}
