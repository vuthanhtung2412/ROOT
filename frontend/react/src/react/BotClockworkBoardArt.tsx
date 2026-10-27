import type { JSX } from 'react'
import {
  AUTOMATED_ALLIANCE_BOARD_LAYOUT,
  VAGABOT_BOARD_LAYOUT,
  type BoardBox,
  type BoardSpot,
} from '#assets/botBoardLayout.ts'
import { GAME_ASSET_KEYS, imagePathForAssetKey, itemTextureKey } from '#assets/gameAssets.ts'
import {
  BoardArt,
  BoardPiece,
  CraftedItemsStrip,
  boxStyle,
  filledSpaces,
} from '#react/BotBoardPieces.tsx'
import type {
  AutomatedAllianceBoardViewModel,
  VagabotBoardViewModel,
  VagabotItemView,
} from '#ui/botBoardViewModel.ts'

/** Automated Alliance (Rootbotics 6) and Vagabot (Rootbotics 7) board pieces. */

const BASE_TOKEN_KEYS: Readonly<Record<string, string>> = {
  fox: GAME_ASSET_KEYS.tokenAllianceBaseFox,
  rabbit: GAME_ASSET_KEYS.tokenAllianceBaseRabbit,
  mouse: GAME_ASSET_KEYS.tokenAllianceBaseMouse,
}
const ITEM_BOX_CLASS_NAME =
  'absolute flex flex-row flex-wrap content-center items-center justify-center gap-1'
const ITEM_ICON_CLASS_NAME =
  'h-auto select-none drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]'
/** Rule: Rootbotics 7.2.3 — exhausted items lie face down. */
const ITEM_EXHAUSTED_CLASS_NAME = 'rotate-90 opacity-60 grayscale'
const TRACK_ITEM_CLASS_NAME =
  'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]'
const CHARACTER_CARD_CLASS_NAME =
  'absolute flex flex-col items-center justify-end gap-1 rounded-sm bg-[rgb(20_24_18/0.78)] px-2 py-2 text-center font-body text-[#f3ecd8]'
const CHARACTER_CARD_IMAGE_CLASS_NAME =
  'absolute block rounded-md object-contain select-none drop-shadow-[0_2px_3px_rgb(0_0_0/0.6)]'
const CHARACTER_NAME_CLASS_NAME = 'font-display text-[2.2vmin] leading-tight'
const CHARACTER_TEXT_CLASS_NAME = 'text-[1.4vmin] leading-snug'
const PERCENT = 100
/** Satchel and Damaged box items, as a share of a Battle Track item. */
const BOX_ITEM_SHARE_OF_TRACK_ITEM = 0.75

function itemIconPath(item: VagabotItemView): string | null {
  const textureKey: string | null = itemTextureKey(item.type)
  return textureKey === null ? null : imagePathForAssetKey(textureKey)
}

function ItemIcon(props: { item: VagabotItemView; widthPercent: number }): JSX.Element | null {
  const path: string | null = itemIconPath(props.item)
  if (path === null) return null
  const exhausted: string = props.item.exhausted ? ITEM_EXHAUSTED_CLASS_NAME : ''
  return (
    <img
      className={`${ITEM_ICON_CLASS_NAME} ${exhausted}`}
      style={{ width: `${String(props.widthPercent)}%` }}
      src={path}
      alt={props.item.type}
      title={`${props.item.type}${props.item.exhausted ? ' (exhausted)' : ''}`}
      draggable={false}
    />
  )
}

type ItemBoxProps = {
  label: string
  items: readonly VagabotItemView[]
  box: BoardBox
  /** One item, as a fraction of the board width. */
  itemSize: number
}

function ItemBox(props: ItemBoxProps): JSX.Element {
  const itemWidthPercent: number = (props.itemSize / props.box.width) * PERCENT
  return (
    <div className={ITEM_BOX_CLASS_NAME} style={boxStyle(props.box)} aria-label={props.label}>
      {props.items.map((item: VagabotItemView, index: number): JSX.Element => (
        <ItemIcon key={`${item.type}-${String(index)}`} item={item} widthPercent={itemWidthPercent} />
      ))}
    </div>
  )
}

function TrackItem(props: { item: VagabotItemView; spot: BoardSpot; size: number }): JSX.Element | null {
  const path: string | null = itemIconPath(props.item)
  if (path === null) return null
  return (
    <img
      className={`${TRACK_ITEM_CLASS_NAME} ${props.item.exhausted ? ITEM_EXHAUSTED_CLASS_NAME : ''}`}
      style={{
        left: `${String(props.spot.x * PERCENT)}%`,
        top: `${String(props.spot.y * PERCENT)}%`,
        width: `${String(props.size * PERCENT)}%`,
      }}
      src={path}
      alt={props.item.type}
      draggable={false}
    />
  )
}

/** Rootbotics 6.3 — sympathy left on the track, bases left in the Bases box. */
export function AutomatedAllianceBoardArt(props: { view: AutomatedAllianceBoardViewModel }): JSX.Element {
  const layout = AUTOMATED_ALLIANCE_BOARD_LAYOUT
  return (
    <BoardArt view={props.view}>
      {[
        ...filledSpaces(layout.sympathySpaces, props.view.sympathyOnTrack).map(
          (spot: BoardSpot, index: number): JSX.Element => (
            <BoardPiece
              key={`sympathy-${String(index)}`}
              textureKey={GAME_ASSET_KEYS.tokenAllianceSympathy}
              spot={spot}
              spaceSize={layout.spaceSize}
            />
          ),
        ),
        ...props.view.basesOnBoard.map((suit: string): JSX.Element | null => {
          const spot: BoardSpot | undefined = layout.baseSpaces[suit]
          const textureKey: string | undefined = BASE_TOKEN_KEYS[suit]
          if (spot === undefined || textureKey === undefined) return null
          return (
            <BoardPiece
              key={`base-${suit}`}
              textureKey={textureKey}
              spot={spot}
              spaceSize={layout.baseSpaceSize}
            />
          )
        }).filter((piece: JSX.Element | null): piece is JSX.Element => piece !== null),
        <CraftedItemsStrip key="crafted" items={props.view.craftedItems} box={layout.craftedItems} />,
      ]}
    </BoardArt>
  )
}

/** Rootbotics 7.3.1 — the printed character card; its text when the art is missing. */
function VagabotCharacterCard(props: { view: VagabotBoardViewModel; box: BoardBox }): JSX.Element {
  const { character } = props.view
  const imagePath: string | null = imagePathForAssetKey(character.cardAssetKey)
  if (imagePath !== null) {
    return (
      <img
        className={`vagabot-character ${CHARACTER_CARD_IMAGE_CLASS_NAME}`}
        style={boxStyle(props.box)}
        src={imagePath}
        alt={`${character.name}: ${character.text}`}
        title={`${character.name} — ${character.text}`}
        draggable={false}
      />
    )
  }
  return (
    <div className={`vagabot-character ${CHARACTER_CARD_CLASS_NAME}`} style={boxStyle(props.box)}>
      <span className={CHARACTER_NAME_CLASS_NAME}>{character.name}</span>
      <span className={CHARACTER_TEXT_CLASS_NAME}>{character.text}</span>
    </div>
  )
}

/** Rootbotics 7.2 — Satchel, Battle Track, Damaged box and the character card. */
export function VagabotBoardArt(props: { view: VagabotBoardViewModel }): JSX.Element {
  const layout = VAGABOT_BOARD_LAYOUT
  const { view } = props
  const boxItemSize: number = layout.battleTrackSpaceSize * BOX_ITEM_SHARE_OF_TRACK_ITEM
  return (
    <BoardArt view={view}>
      {[
        ...view.battleTrack.map((item: VagabotItemView, index: number): JSX.Element | null => {
          const spot: BoardSpot | undefined = layout.battleTrackSpaces[index]
          if (spot === undefined) return null
          return (
            <TrackItem
              key={`track-${String(index)}`}
              item={item}
              spot={spot}
              size={layout.battleTrackSpaceSize}
            />
          )
        }).filter((piece: JSX.Element | null): piece is JSX.Element => piece !== null),
        <ItemBox key="satchel" label="Satchel" items={view.satchel} box={layout.satchel} itemSize={boxItemSize} />,
        <ItemBox key="damaged" label="Damaged items" items={view.damaged} box={layout.damaged} itemSize={boxItemSize} />,
        <VagabotCharacterCard key="character" view={view} box={layout.characterCard} />,
      ]}
    </BoardArt>
  )
}
