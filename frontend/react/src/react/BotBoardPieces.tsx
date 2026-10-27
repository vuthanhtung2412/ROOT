import type { CSSProperties, JSX } from 'react'
import {
  AUTOMATED_ALLIANCE_BOARD_LAYOUT,
  ELECTRIC_EYRIE_BOARD_LAYOUT,
  MECHANICAL_MARQUISE_BOARD_LAYOUT,
  VAGABOT_BOARD_LAYOUT,
  type BoardBox,
  type BoardSpot,
} from '#assets/botBoardLayout.ts'
import { imagePathForAssetKey, itemTextureKey } from '#assets/gameAssets.ts'
import type { BotBoardViewModel } from '#ui/botBoardViewModel.ts'
import {
  BOARD_OVERLAY_LAYER_CLASS_NAME,
  HideOverlaysButton,
} from '#react/HideOverlaysButton.tsx'

/** Pieces drawn on a Rootbotics bot board scan, placed in fractions of the art. */

const BOARD_MAX_WIDTH_VIEWPORT_PERCENT = 96
const BOARD_MAX_HEIGHT_VIEWPORT_PERCENT = 94
/** The strip under the art and its gap. */
const RESERVED_STRIP_PIXELS = 60
export const BOARD_ASPECT_RATIOS: Readonly<Record<BotBoardViewModel['kind'], number>> = {
  mechanicalMarquise: MECHANICAL_MARQUISE_BOARD_LAYOUT.aspectRatio,
  electricEyrie: ELECTRIC_EYRIE_BOARD_LAYOUT.aspectRatio,
  automatedAlliance: AUTOMATED_ALLIANCE_BOARD_LAYOUT.aspectRatio,
  vagabot: VAGABOT_BOARD_LAYOUT.aspectRatio,
}
const BOARD_IMAGE_CLASS_NAME = 'absolute inset-0 block size-full select-none'
const BOARD_PIECE_CLASS_NAME =
  'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]'
const CRAFTED_STRIP_CLASS_NAME =
  'absolute flex flex-row items-center justify-center gap-1'
const CRAFTED_ICON_CLASS_NAME = 'h-[80%] w-auto select-none'
const PERCENT = 100

/** As wide as the screen allows while the whole board and the strip fit its height. */
function boardWidth(kind: BotBoardViewModel['kind']): string {
  return `min(${String(BOARD_MAX_WIDTH_VIEWPORT_PERCENT)}vw, calc((${String(BOARD_MAX_HEIGHT_VIEWPORT_PERCENT)}vh - ${String(RESERVED_STRIP_PIXELS)}px) * ${String(BOARD_ASPECT_RATIOS[kind])}))`
}

function percent(fraction: number): string {
  return `${String(fraction * PERCENT)}%`
}

function spotStyle(spot: BoardSpot, spaceSize: number): CSSProperties {
  return { left: percent(spot.x), top: percent(spot.y), width: percent(spaceSize) }
}

export function boxStyle(box: BoardBox): CSSProperties {
  return {
    left: percent(box.left),
    top: percent(box.top),
    width: percent(box.width),
    height: percent(box.height),
  }
}

/** The rightmost `count` spaces of a track: pieces fill it from the right. */
export function filledSpaces(spaces: readonly BoardSpot[], count: number): readonly BoardSpot[] {
  return count <= 0 ? [] : spaces.slice(Math.max(0, spaces.length - count))
}

export function BoardPiece(props: {
  textureKey: string
  spot: BoardSpot
  spaceSize: number
}): JSX.Element | null {
  const path: string | null = imagePathForAssetKey(props.textureKey)
  if (path === null) return null
  return (
    <img
      className={BOARD_PIECE_CLASS_NAME}
      style={spotStyle(props.spot, props.spaceSize)}
      src={path}
      alt=""
      draggable={false}
    />
  )
}

export function CraftedItemsStrip(props: { items: readonly string[]; box: BoardBox }): JSX.Element {
  return (
    <div className={CRAFTED_STRIP_CLASS_NAME} style={boxStyle(props.box)} aria-label="Crafted items">
      {props.items.map((item: string, index: number): JSX.Element | null => {
        const textureKey: string | null = itemTextureKey(item)
        const path: string | null = textureKey === null ? null : imagePathForAssetKey(textureKey)
        if (path === null) return null
        return (
          <img
            key={`${item}-${String(index)}`}
            className={CRAFTED_ICON_CLASS_NAME}
            src={path}
            alt={item}
            title={item}
            draggable={false}
          />
        )
      })}
    </div>
  )
}

export function BoardArt(props: {
  view: BotBoardViewModel
  children: JSX.Element[]
}): JSX.Element {
  const path: string | null = imagePathForAssetKey(props.view.boardTextureKey)
  return (
    <div
      className="pointer-events-auto relative flex-none"
      style={{ width: boardWidth(props.view.kind), aspectRatio: BOARD_ASPECT_RATIOS[props.view.kind] }}
    >
      {path !== null ? (
        <img
          className={BOARD_IMAGE_CLASS_NAME}
          src={path}
          alt={`${props.view.factionName} faction board`}
          draggable={false}
        />
      ) : null}
      <div className={BOARD_OVERLAY_LAYER_CLASS_NAME}>{props.children}</div>
      <HideOverlaysButton />
    </div>
  )
}
