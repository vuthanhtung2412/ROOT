/**
 * Where things sit on the Rootbotics bot board scans: centres and sizes as
 * fractions of the image, so they scale with it.
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
/** Decree column frames along the top band, left to right, in scan pixels. */
const EYRIE_DECREE_FRAME_LEFT_PIXELS: Readonly<Record<string, number>> = {
  fox: 94,
  mouse: 616,
  rabbit: 1148,
  bird: 1678,
}
const EYRIE_DECREE_FRAME_TOP_PIXELS = 43
const EYRIE_DECREE_FRAME_WIDTH_PIXELS = 240
const EYRIE_DECREE_FRAME_HEIGHT_PIXELS = 85

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
  /** Printed Decree frame of each column, by suit. */
  decreeFrames: Readonly<Record<string, BoardBox>>
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
  decreeFrames: Object.fromEntries(
    Object.entries(EYRIE_DECREE_FRAME_LEFT_PIXELS).map(
      ([suit, frameLeft]: [string, number]): [string, BoardBox] => [
        suit,
        {
          left: frameLeft / ELECTRIC_EYRIE_WIDTH,
          top: EYRIE_DECREE_FRAME_TOP_PIXELS / ELECTRIC_EYRIE_HEIGHT,
          width: EYRIE_DECREE_FRAME_WIDTH_PIXELS / ELECTRIC_EYRIE_WIDTH,
          height: EYRIE_DECREE_FRAME_HEIGHT_PIXELS / ELECTRIC_EYRIE_HEIGHT,
        },
      ],
    ),
  ),
}

/** Automated Alliance and Vagabot boards photographed from the French print, 2400 × 1832 px. */
const CLOCKWORK_SCAN_WIDTH = 2400
const CLOCKWORK_SCAN_HEIGHT = 1832
/** Sympathy token and Bases box space, in scan pixels. */
const ALLIANCE_SYMPATHY_SPACE_PIXELS = 167.8
const ALLIANCE_BASE_SPACE_PIXELS = 155.2
/** Sympathy track zig-zag rows, in scan pixels. */
const ALLIANCE_SYMPATHY_LOW_ROW_Y_PIXELS = 1605.4
const ALLIANCE_SYMPATHY_HIGH_ROW_Y_PIXELS = 1528.1
/** Sympathy track space centres, left to right (zig-zag), in scan pixels. */
const ALLIANCE_SYMPATHY_SPACE_PIXEL_CENTRES: readonly (readonly [number, number])[] = [
  [749.2, ALLIANCE_SYMPATHY_LOW_ROW_Y_PIXELS],
  [919.4, ALLIANCE_SYMPATHY_HIGH_ROW_Y_PIXELS],
  [1088.5, ALLIANCE_SYMPATHY_LOW_ROW_Y_PIXELS],
  [1256.3, ALLIANCE_SYMPATHY_HIGH_ROW_Y_PIXELS],
  [1427.3, ALLIANCE_SYMPATHY_LOW_ROW_Y_PIXELS],
  [1593.4, ALLIANCE_SYMPATHY_HIGH_ROW_Y_PIXELS],
  [1759.7, ALLIANCE_SYMPATHY_LOW_ROW_Y_PIXELS],
  [1926, ALLIANCE_SYMPATHY_HIGH_ROW_Y_PIXELS],
  [2094.2, ALLIANCE_SYMPATHY_LOW_ROW_Y_PIXELS],
  [2259.9, ALLIANCE_SYMPATHY_HIGH_ROW_Y_PIXELS],
]
/** Bases box space centres by suit (fox, rabbit, mouse), in scan pixels. */
const ALLIANCE_BASE_SPACE_X_PIXELS: Readonly<Record<string, number>> = {
  fox: 1056.3,
  rabbit: 1224.5,
  mouse: 1394.3,
}
const ALLIANCE_BASE_ROW_Y_PIXELS = 1188
/** Vagabot Battle Track slots, left to right, in scan pixels. */
const VAGABOT_BATTLE_TRACK_X_PIXELS: readonly number[] = [1292.7, 1488.5, 1686.1]
const VAGABOT_BATTLE_TRACK_ROW_Y_PIXELS = 809.6
const VAGABOT_BATTLE_TRACK_SPACE_PIXELS = 160

function clockworkBox(left: number, top: number, size: { width: number; height: number }): BoardBox {
  return {
    left: left / CLOCKWORK_SCAN_WIDTH,
    top: top / CLOCKWORK_SCAN_HEIGHT,
    width: size.width / CLOCKWORK_SCAN_WIDTH,
    height: size.height / CLOCKWORK_SCAN_HEIGHT,
  }
}

function clockworkSpot(x: number, y: number): BoardSpot {
  return { x: x / CLOCKWORK_SCAN_WIDTH, y: y / CLOCKWORK_SCAN_HEIGHT }
}

export const AUTOMATED_ALLIANCE_BOARD_LAYOUT: BotBoardLayout & {
  sympathySpaces: readonly BoardSpot[]
  baseSpaces: Readonly<Record<string, BoardSpot>>
  baseSpaceSize: number
} = {
  aspectRatio: CLOCKWORK_SCAN_WIDTH / CLOCKWORK_SCAN_HEIGHT,
  spaceSize: ALLIANCE_SYMPATHY_SPACE_PIXELS / CLOCKWORK_SCAN_WIDTH,
  craftedItems: clockworkBox(1698.4, 229, { width: 557.1, height: 146.1 }),
  sympathySpaces: ALLIANCE_SYMPATHY_SPACE_PIXEL_CENTRES.map(
    ([x, y]: readonly [number, number]): BoardSpot => clockworkSpot(x, y),
  ),
  baseSpaces: Object.fromEntries(
    Object.entries(ALLIANCE_BASE_SPACE_X_PIXELS).map(
      ([suit, x]: [string, number]): [string, BoardSpot] => [
        suit,
        clockworkSpot(x, ALLIANCE_BASE_ROW_Y_PIXELS),
      ],
    ),
  ),
  baseSpaceSize: ALLIANCE_BASE_SPACE_PIXELS / CLOCKWORK_SCAN_WIDTH,
}

export const VAGABOT_BOARD_LAYOUT: {
  aspectRatio: number
  battleTrackSpaces: readonly BoardSpot[]
  battleTrackSpaceSize: number
  satchel: BoardBox
  damaged: BoardBox
  characterCard: BoardBox
} = {
  aspectRatio: CLOCKWORK_SCAN_WIDTH / CLOCKWORK_SCAN_HEIGHT,
  battleTrackSpaces: VAGABOT_BATTLE_TRACK_X_PIXELS.map(
    (x: number): BoardSpot => clockworkSpot(x, VAGABOT_BATTLE_TRACK_ROW_Y_PIXELS),
  ),
  battleTrackSpaceSize: VAGABOT_BATTLE_TRACK_SPACE_PIXELS / CLOCKWORK_SCAN_WIDTH,
  satchel: clockworkBox(1006.3, 1124.3, { width: 685.8, height: 427 }),
  damaged: clockworkBox(1025.5, 1575.6, { width: 646.3, height: 190.1 }),
  characterCard: clockworkBox(1780.5, 1023.6, { width: 542.3, height: 755 }),
}
