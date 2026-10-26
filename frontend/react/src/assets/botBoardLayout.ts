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

/** Automated Alliance and Vagabot boards from the Root Database, 950 × 725 px. */
const CLOCKWORK_SCAN_WIDTH = 950
const CLOCKWORK_SCAN_HEIGHT = 725
/** Sympathy token and Bases box space, in scan pixels. */
const ALLIANCE_SYMPATHY_SPACE_PIXELS = 52
const ALLIANCE_BASE_SPACE_PIXELS = 52
/** Sympathy track space centres, left to right (zig-zag), in scan pixels. */
const ALLIANCE_SYMPATHY_SPACE_PIXEL_CENTRES: readonly (readonly [number, number])[] = [
  [297.5, 640],
  [365, 607.5],
  [432.5, 639],
  [498.5, 607.5],
  [566.5, 639],
  [634, 607.5],
  [701.5, 639],
  [769, 607.5],
  [836.5, 639],
  [902.5, 607.5],
]
/** Bases box space centres by suit (fox, rabbit, mouse), in scan pixels. */
const ALLIANCE_BASE_SPACE_X_PIXELS: Readonly<Record<string, number>> = {
  fox: 417.5,
  rabbit: 485,
  mouse: 554,
}
const ALLIANCE_BASE_ROW_Y_PIXELS = 470
/** Vagabot Battle Track slots, left to right, in scan pixels. */
const VAGABOT_BATTLE_TRACK_X_PIXELS: readonly number[] = [516, 595, 673.5]
const VAGABOT_BATTLE_TRACK_ROW_Y_PIXELS = 319
const VAGABOT_BATTLE_TRACK_SPACE_PIXELS = 58

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
  craftedItems: clockworkBox(682, 92, { width: 222, height: 50 }),
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
  satchel: clockworkBox(408, 490, { width: 264, height: 122 }),
  damaged: clockworkBox(412, 640, { width: 254, height: 60 }),
  characterCard: clockworkBox(712, 410, { width: 218, height: 298 }),
}
