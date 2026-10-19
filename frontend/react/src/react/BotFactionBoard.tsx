import type { CSSProperties, JSX } from 'react'
import {
  ELECTRIC_EYRIE_BOARD_LAYOUT,
  MECHANICAL_MARQUISE_BOARD_LAYOUT,
  type BoardBox,
  type BoardSpot,
} from '#assets/botBoardLayout.ts'
import {
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
  itemTextureKey,
} from '#assets/gameAssets.ts'
import { BotBoardStrip } from '#react/BotBoardStrip.tsx'
import { BotDecreeOverlay } from '#react/BotDecreeOverlay.tsx'
import type {
  BotBoardViewModel,
  ElectricEyrieBoardViewModel,
  MechanicalMarquiseBoardViewModel,
} from '#ui/botBoardViewModel.ts'

/**
 * The art centred near the top of the screen, the bot strip under it. Keeps
 * the `faction-board-modal__bot` hook for QA scripts.
 */
const STAGE_CLASS_NAME =
  'faction-board-modal__bot pointer-events-none absolute top-[2vh] left-1/2 z-1 flex -translate-x-1/2 flex-col items-stretch gap-2'
const BOARD_MAX_WIDTH_VIEWPORT_PERCENT = 96
const BOARD_MAX_HEIGHT_VIEWPORT_PERCENT = 94
/** The strip under the art and its gap. */
const RESERVED_STRIP_PIXELS = 60
const ASPECT_RATIOS: Readonly<Record<BotBoardViewModel['kind'], number>> = {
  mechanicalMarquise: MECHANICAL_MARQUISE_BOARD_LAYOUT.aspectRatio,
  electricEyrie: ELECTRIC_EYRIE_BOARD_LAYOUT.aspectRatio,
}

/** As wide as the screen allows while the whole board and the strip fit its height. */
function boardWidth(kind: BotBoardViewModel['kind']): string {
  return `min(${String(BOARD_MAX_WIDTH_VIEWPORT_PERCENT)}vw, calc((${String(BOARD_MAX_HEIGHT_VIEWPORT_PERCENT)}vh - ${String(RESERVED_STRIP_PIXELS)}px) * ${String(ASPECT_RATIOS[kind])}))`
}
const BOARD_IMAGE_CLASS_NAME = 'absolute inset-0 block size-full select-none'
const BOARD_PIECE_CLASS_NAME =
  'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]'
const CRAFTED_STRIP_CLASS_NAME =
  'absolute flex flex-row items-center justify-center gap-1'
const CRAFTED_ICON_CLASS_NAME = 'h-[80%] w-auto select-none'
const PERCENT = 100
const EMPTY_BOX: BoardBox = { left: 0, top: 0, width: 0, height: 0 }

const BUILDING_TOKEN_KEYS: Readonly<Record<string, string>> = {
  sawmill: GAME_ASSET_KEYS.tokenMarquiseSawmill,
  workshop: GAME_ASSET_KEYS.tokenMarquiseWorkshop,
  recruiter: GAME_ASSET_KEYS.tokenMarquiseRecruiter,
}

function percent(fraction: number): string {
  return `${String(fraction * PERCENT)}%`
}

function spotStyle(spot: BoardSpot, spaceSize: number): CSSProperties {
  return { left: percent(spot.x), top: percent(spot.y), width: percent(spaceSize) }
}

function boxStyle(box: BoardBox): CSSProperties {
  return {
    left: percent(box.left),
    top: percent(box.top),
    width: percent(box.width),
    height: percent(box.height),
  }
}

/** The rightmost `count` spaces of a track: pieces fill it from the right. */
function filledSpaces(spaces: readonly BoardSpot[], count: number): readonly BoardSpot[] {
  return count <= 0 ? [] : spaces.slice(Math.max(0, spaces.length - count))
}

function BoardPiece(props: { textureKey: string; spot: BoardSpot; spaceSize: number }): JSX.Element | null {
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

function CraftedItemsStrip(props: { items: readonly string[]; box: BoardBox }): JSX.Element {
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

function BoardArt(props: {
  view: BotBoardViewModel
  aspectRatio: number
  children: JSX.Element[]
}): JSX.Element {
  const path: string | null = imagePathForAssetKey(props.view.boardTextureKey)
  return (
    <div
      className="pointer-events-auto relative flex-none"
      style={{ width: boardWidth(props.view.kind), aspectRatio: props.aspectRatio }}
    >
      {path !== null ? (
        <img
          className={BOARD_IMAGE_CLASS_NAME}
          src={path}
          alt={`${props.view.factionName} faction board`}
          draggable={false}
        />
      ) : null}
      {props.children}
    </div>
  )
}

function MarquiseBoardArt(props: { view: MechanicalMarquiseBoardViewModel }): JSX.Element {
  const layout = MECHANICAL_MARQUISE_BOARD_LAYOUT
  return (
    <BoardArt view={props.view} aspectRatio={layout.aspectRatio}>
      {[
        ...props.view.tracks.flatMap((track) =>
          filledSpaces(layout.trackSpaces[track.building] ?? [], track.onTrack).map(
            (spot: BoardSpot, index: number): JSX.Element => (
              <BoardPiece
                key={`${track.building}-${String(index)}`}
                textureKey={BUILDING_TOKEN_KEYS[track.building] ?? ''}
                spot={spot}
                spaceSize={layout.spaceSize}
              />
            ),
          ),
        ),
        <CraftedItemsStrip key="crafted" items={props.view.craftedItems} box={layout.craftedItems} />,
      ]}
    </BoardArt>
  )
}

function EyrieBoardArt(props: { view: ElectricEyrieBoardViewModel }): JSX.Element {
  const layout = ELECTRIC_EYRIE_BOARD_LAYOUT
  return (
    <BoardArt view={props.view} aspectRatio={layout.aspectRatio}>
      {[
        ...filledSpaces(layout.roostSpaces, props.view.roostsOnTrack).map(
          (spot: BoardSpot, index: number): JSX.Element => (
            <BoardPiece
              key={`roost-${String(index)}`}
              textureKey={GAME_ASSET_KEYS.tokenEyrieRoost}
              spot={spot}
              spaceSize={layout.spaceSize}
            />
          ),
        ),
        <CraftedItemsStrip key="crafted" items={props.view.craftedItems} box={layout.craftedItems} />,
        <BotDecreeOverlay
          key="decree"
          columns={props.view.decree.map((column) => ({
            suit: column.suit,
            cards: column.cards,
            frameStyle: boxStyle(layout.decreeFrames[column.suit] ?? EMPTY_BOX),
          }))}
          activeColumn={props.view.activeDecreeColumn}
        />,
      ]}
    </BoardArt>
  )
}

/** Rootbotics bot board: the printed board with its pieces and Decree, the bot strip under it. */
export function BotFactionBoard(props: { view: BotBoardViewModel }): JSX.Element {
  const { view } = props
  return (
    <section className={STAGE_CLASS_NAME} aria-label={`${view.factionName} board`}>
      {view.kind === 'mechanicalMarquise' ? <MarquiseBoardArt view={view} /> : null}
      {view.kind === 'electricEyrie' ? <EyrieBoardArt view={view} /> : null}
      <BotBoardStrip view={view} />
    </section>
  )
}
