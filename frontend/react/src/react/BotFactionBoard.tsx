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
import { SuitIcon } from '#react/SuitIcon.tsx'
import type {
  BotBoardViewModel,
  BotCardView,
  ElectricEyrieBoardViewModel,
  MechanicalMarquiseBoardViewModel,
} from '#ui/botBoardViewModel.ts'

/**
 * Same stage as the other faction boards: the art centred near the top of
 * the screen, a card panel beside it. Keeps the `faction-board-modal__bot`
 * hook for QA scripts.
 */
const STAGE_CLASS_NAME =
  'faction-board-modal__bot pointer-events-none absolute top-[2vh] left-1/2 z-1 flex -translate-x-1/2 flex-row items-stretch gap-3'
const BOARD_MAX_WIDTH_VIEWPORT_PERCENT = 96
const BOARD_MAX_HEIGHT_VIEWPORT_PERCENT = 94
/** Side panel, its gap to the art and the stage inset, as on the other boards. */
const SIDE_PANEL_WIDTH_PIXELS = 220
const RESERVED_SIDE_PIXELS = 256
const ASPECT_RATIOS: Readonly<Record<BotBoardViewModel['kind'], number>> = {
  mechanicalMarquise: MECHANICAL_MARQUISE_BOARD_LAYOUT.aspectRatio,
  electricEyrie: ELECTRIC_EYRIE_BOARD_LAYOUT.aspectRatio,
}

/** As wide as the screen allows beside the panel while the whole board fits its height. */
function boardWidth(kind: BotBoardViewModel['kind']): string {
  return `min(calc(${String(BOARD_MAX_WIDTH_VIEWPORT_PERCENT)}vw - ${String(RESERVED_SIDE_PIXELS)}px), calc(${String(BOARD_MAX_HEIGHT_VIEWPORT_PERCENT)}vh * ${String(ASPECT_RATIOS[kind])}))`
}
/** Dark card panel of the Vagabond quests and Cult revealed cards. */
const SIDE_PANEL_CLASS_NAME =
  'pointer-events-auto absolute inset-0 flex flex-col gap-2 overflow-y-auto rounded border border-[rgb(230_220_190/0.35)] bg-[rgb(20_24_18/0.72)] p-2 font-body text-[#f3ecd8]'
const PANEL_HEADING_CLASS_NAME = 'm-0 text-[12px] font-normal tracking-heading uppercase opacity-90'
const PANEL_FOOTNOTE_CLASS_NAME = 'text-[11px] opacity-80'
const CARD_CHIP_CLASS_NAME =
  'inline-flex items-center gap-1 border border-ink/40 bg-parchment px-1.5 py-0.5 font-body text-xs text-ink'
const SUIT_ICON_CLASS_NAME = 'size-4'
const COLUMN_CLASS_NAME =
  'flex flex-col items-center gap-1 border border-[rgb(230_220_190/0.25)] bg-black/20 p-1.5'
const BOARD_IMAGE_CLASS_NAME = 'absolute inset-0 block size-full select-none'
const BOARD_PIECE_CLASS_NAME =
  'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]'
const CRAFTED_STRIP_CLASS_NAME =
  'absolute flex flex-row items-center justify-center gap-1'
const CRAFTED_ICON_CLASS_NAME = 'h-[80%] w-auto select-none'
const EMPTY_TEXT = '—'
const PERCENT = 100

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
      ]}
    </BoardArt>
  )
}

function CardChip(props: { card: BotCardView }): JSX.Element {
  return (
    <span className={CARD_CHIP_CLASS_NAME} title={props.card.cardId}>
      <SuitIcon suit={props.card.suit} className={SUIT_ICON_CLASS_NAME} alt={props.card.suit} />
      {props.card.name}
    </span>
  )
}

/** The Decree beside the printed board: its columns, left to right, top to bottom. */
function EyrieDecree(props: { view: ElectricEyrieBoardViewModel }): JSX.Element {
  return (
    <section className="flex flex-col gap-1.5" aria-label="The Decree">
      <h3 className={PANEL_HEADING_CLASS_NAME}>The Decree</h3>
      {props.view.decree.map((column) => (
        <div key={column.suit} className={COLUMN_CLASS_NAME}>
          <SuitIcon suit={column.suit} className="size-6" alt={column.suit} />
          {column.cards.length === 0 ? <span>{EMPTY_TEXT}</span> : null}
          {column.cards.map((card) => (
            <CardChip key={card.cardId} card={card} />
          ))}
        </div>
      ))}
    </section>
  )
}

/** Card panel beside the art: the bot's supply, order card and (Eyrie) Decree. */
function BotSidePanel(props: { view: BotBoardViewModel }): JSX.Element {
  const { view } = props
  return (
    <aside className="relative flex-none" style={{ width: SIDE_PANEL_WIDTH_PIXELS }}>
      <div className={SIDE_PANEL_CLASS_NAME}>
        <div className={PANEL_FOOTNOTE_CLASS_NAME}>
          {view.victoryPoints} VP · {view.warriors} warriors in supply
        </div>
        <section className="flex flex-col items-start gap-1.5" aria-label="Order card">
          <h3 className={PANEL_HEADING_CLASS_NAME}>Order card</h3>
          {view.orderCard === null ? (
            <span className={PANEL_FOOTNOTE_CLASS_NAME}>{EMPTY_TEXT}</span>
          ) : (
            <CardChip card={view.orderCard} />
          )}
        </section>
        {view.kind === 'electricEyrie' ? <EyrieDecree view={view} /> : null}
      </div>
    </aside>
  )
}

/** Rootbotics bot board: the printed board with its pieces, order card and Decree. */
export function BotFactionBoard(props: { view: BotBoardViewModel }): JSX.Element {
  const { view } = props
  return (
    <section className={STAGE_CLASS_NAME} aria-label={`${view.factionName} board`}>
      {view.kind === 'mechanicalMarquise' ? <MarquiseBoardArt view={view} /> : null}
      {view.kind === 'electricEyrie' ? <EyrieBoardArt view={view} /> : null}
      <BotSidePanel view={view} />
    </section>
  )
}
