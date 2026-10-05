import type { CSSProperties, JSX } from 'react'
import type { ActionSpec } from '#api/client.ts'
import {
  findBoardLayoutRegion,
  trackCellRegion,
  type BoardLayoutRegion,
  type FactionBoardPixelLayout,
} from '#assets/factionBoardLayout.ts'
import { getHudCallbacks } from '#game/hudStore.ts'
import {
  findRearrangeSpec,
  type RearrangeOrigin,
} from '#game/vagabondRearrange.ts'
import {
  allianceBaseTextureKey,
  cardImagePublicPath,
  factionTextureKey,
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
  itemTextureKey,
  suitTextureKey,
  warriorTokenTextureKey,
} from '#assets/gameAssets.ts'
import { lookupEyrieLeader } from '#assets/eyrieLeaderCatalog.ts'
import { EYRIE_ROOST_TRACK_SLOT_COUNT } from '#assets/eyrieBoardCatalog.ts'
import { MARQUISE_TRACK_SLOT_COUNT } from '#assets/marquiseBoardCatalog.ts'
import { ALLIANCE_SYMPATHY_TRACK_SLOT_COUNT } from '#assets/allianceBoardCatalog.ts'
import {
  VAGABOND_RELATIONSHIP_DEVELOPMENT_CELLS,
} from '#assets/vagabondBoardCatalog.ts'
import {
  formatDecreeSuitCounts,
  sortDecreeSuits,
  type CraftedItemView,
  type FactionBoardViewModel,
  type VagabondRelationshipMarkerView,
} from '#ui/factionBoardViewModel.ts'
import {
  BOARD_CLICKABLE_CLASS_NAME,
  useActingPlayerActions,
} from '#react/boardActions.ts'

type OverlayBaseProps = {
  view: FactionBoardViewModel
  layout: FactionBoardPixelLayout
}

/** Map layout.json px → % of board image (naturalWidth × naturalHeight). */
function layoutRegionStyle(
  region: BoardLayoutRegion,
  layout: FactionBoardPixelLayout,
): CSSProperties {
  return {
    left: `${(region.x / layout.naturalWidth) * 100}%`,
    top: `${(region.y / layout.naturalHeight) * 100}%`,
    width: `${(region.width / layout.naturalWidth) * 100}%`,
    height: `${(region.height / layout.naturalHeight) * 100}%`,
  }
}

const DARK_LABEL_CLASS_NAME = 'bg-[rgb(10_10_10/0.8)] font-mono text-[#f7f0e4]'
const TOKEN_CLASS_NAME = 'absolute z-1 block select-none'
const EXHAUSTED_CLASS_NAME = 'opacity-40'
const CRAFTED_STRIP_CLASS_NAME = 'absolute flex flex-row gap-1 overflow-hidden px-1.5 py-1'
/** Crafted strip: icons follow the strip height. */
const CRAFTED_STRIP_ITEM_SIZE_CLASS_NAME = 'h-[72%]'
/** Satchel / damaged: fixed size matching tea/coin/bag track tokens. */
const ITEM_PACK_ITEM_SIZE_CLASS_NAME = 'size-16'
const ITEM_PACK_CLASS_NAME =
  'pointer-events-auto absolute z-2 flex flex-wrap content-start items-start justify-start gap-1 overflow-x-hidden overflow-y-auto p-1'
const SUPPLY_BADGE_CLASS_NAME =
  'absolute top-[2%] right-[2%] z-2 bg-parchment/93 px-1.5 py-0.5 font-mono text-[clamp(12px,2.4vh,18px)] text-[#1a1408]'
const DECREE_CLASS_NAME =
  'absolute flex items-center overflow-hidden px-2 py-1 font-mono text-[clamp(10px,2vh,14px)]'
const DECREE_ACTIVE_CLASS_NAME = 'bg-[rgb(255_224_138/0.87)] text-[#1a1408]'
/** Not the resolving column: suit icons sit straight on the board art. */
const DECREE_IDLE_CLASS_NAME = 'text-[#1a1408]'
const LEADER_CLASS_NAME = 'absolute object-contain object-left-top select-none'
const MOVE_TO_SATCHEL_HINT = 'Move to Satchel'
const MOVE_TO_TRACK_HINT = 'Move to its track'
const RELATIONSHIP_PACK_CLASS_NAME =
  'pointer-events-none absolute z-2 flex flex-col flex-nowrap items-center justify-center overflow-visible'

function FitToken(props: {
  region: BoardLayoutRegion
  layout: FactionBoardPixelLayout
  imagePath: string
  alt: string
  round?: boolean
}): JSX.Element {
  const className = props.round
    ? `${TOKEN_CLASS_NAME} rounded-full object-cover`
    : `${TOKEN_CLASS_NAME} object-fill`
  return (
    <img
      className={className}
      style={layoutRegionStyle(props.region, props.layout)}
      src={props.imagePath}
      alt={props.alt}
      draggable={false}
    />
  )
}

function CraftedItemsOverlay(props: OverlayBaseProps): JSX.Element | null {
  const region = findBoardLayoutRegion(props.layout, 'crafted-items')
  if (region === null || props.view.crafted.items.length === 0) {
    return null
  }
  const style = layoutRegionStyle(region, props.layout)

  return (
    <div className={`${CRAFTED_STRIP_CLASS_NAME} items-center`} style={style}>
      {props.view.crafted.items.map((item) => (
        <CraftedItemIcon
          key={item.type}
          item={item}
          sizeClassName={CRAFTED_STRIP_ITEM_SIZE_CLASS_NAME}
        />
      ))}
    </div>
  )
}

type RearrangeSpecFinder = (
  itemType: string,
  from: RearrangeOrigin,
) => ActionSpec | null

/** Legal track <-> Satchel moves the acting player may take on this board. */
function useRearrangeSpecFinder(seat: number): RearrangeSpecFinder {
  const actions = useActingPlayerActions()
  return (itemType, from) => findRearrangeSpec(actions, { seat, itemType, from })
}

function CraftedItemIcon(props: {
  item: CraftedItemView
  sizeClassName: string
  rearrangeSpec?: ActionSpec | null
}): JSX.Element {
  const textureKey = itemTextureKey(props.item.type)
  const imagePath =
    textureKey !== null ? imagePathForAssetKey(textureKey) : null
  const rearrangeSpec = props.rearrangeSpec ?? null
  if (rearrangeSpec !== null && imagePath !== null) {
    return (
      <button
        type="button"
        className={`relative aspect-square flex-none ${props.sizeClassName} ${BOARD_CLICKABLE_CLASS_NAME}`}
        title={MOVE_TO_TRACK_HINT}
        aria-label={`${props.item.type}: ${MOVE_TO_TRACK_HINT}`}
        onClick={() => {
          getHudCallbacks().onRearrangeItem(rearrangeSpec)
        }}
      >
        <img
          className="block size-full object-contain"
          src={imagePath}
          alt=""
          draggable={false}
        />
      </button>
    )
  }
  return (
    <div
      className={`relative aspect-square flex-none ${props.sizeClassName} ${
        props.item.exhausted ? EXHAUSTED_CLASS_NAME : ''
      }`}
    >
      {imagePath !== null ? (
        <img
          className="block size-full object-contain"
          src={imagePath}
          alt={props.item.type}
          draggable={false}
        />
      ) : (
        <span className={`${DARK_LABEL_CLASS_NAME} block px-1 py-0.5 text-[10px]`}>
          {props.item.type}
        </span>
      )}
      {props.item.count > 1 ? (
        <span className="absolute -top-1 -right-1 bg-parchment px-[3px] py-px font-mono text-[9px] font-bold text-ink">
          {String(props.item.count)}
        </span>
      ) : null}
    </div>
  )
}

function SupplyCell(props: {
  region: BoardLayoutRegion
  layout: FactionBoardPixelLayout
  countLabel: string
  textureKey: string
  alt: string
}): JSX.Element {
  const imagePath = imagePathForAssetKey(props.textureKey)
  const style = layoutRegionStyle(props.region, props.layout)
  return (
    <div className="absolute" style={style}>
      {imagePath !== null ? (
        <img
          className="block size-full object-contain select-none"
          src={imagePath}
          alt={props.alt}
          draggable={false}
        />
      ) : null}
      <span className={SUPPLY_BADGE_CLASS_NAME}>{props.countLabel}</span>
    </div>
  )
}

function SupplyOverlays(props: OverlayBaseProps): JSX.Element {
  const warriorsRegion = findBoardLayoutRegion(props.layout, 'supply-warriors')
  const woodRegion =
    props.view.kind === 'marquise'
      ? findBoardLayoutRegion(props.layout, 'supply-wood')
      : null
  return (
    <>
      {warriorsRegion !== null ? (
        <SupplyCell
          region={warriorsRegion}
          layout={props.layout}
          countLabel={String(props.view.warriors)}
          textureKey={
            warriorTokenTextureKey(props.view.kind) ??
            factionTextureKey(props.view.kind)
          }
          alt="Warriors supply"
        />
      ) : null}
      {props.view.kind === 'alliance' ? (
        <AllianceSupplyExtras view={props.view} layout={props.layout} />
      ) : null}
      {props.view.kind === 'marquise' && woodRegion !== null ? (
        <SupplyCell
          region={woodRegion}
          layout={props.layout}
          countLabel={String(props.view.wood)}
          textureKey={GAME_ASSET_KEYS.tokenMarquiseWood}
          alt="Wood supply"
        />
      ) : null}
    </>
  )
}

function RemainingTrackTokens(props: {
  layout: FactionBoardPixelLayout
  trackId: string
  cellCount: number
  emptiedCount: number
  textureKey: string
  alt: string
  round?: boolean
}): JSX.Element | null {
  const imagePath = imagePathForAssetKey(props.textureKey)
  if (imagePath === null) {
    return null
  }
  const nodes: JSX.Element[] = []
  for (let cellIndex = 0; cellIndex < props.cellCount; cellIndex += 1) {
    if (cellIndex < props.emptiedCount) {
      continue
    }
    const region = trackCellRegion(props.layout, props.trackId, cellIndex)
    if (region === null) {
      continue
    }
    nodes.push(
      <FitToken
        key={`${props.trackId}-${String(cellIndex)}`}
        region={region}
        layout={props.layout}
        imagePath={imagePath}
        alt={props.alt}
        round={props.round === true}
      />,
    )
  }
  return <>{nodes}</>
}

function MarquiseTrackOverlays(props: {
  view: Extract<FactionBoardViewModel, { kind: 'marquise' }>
  layout: FactionBoardPixelLayout
}): JSX.Element {
  const rows: Array<{
    trackId: string
    emptied: number
    textureKey: string
    alt: string
  }> = [
    {
      trackId: 'sawmill',
      emptied: props.view.emptiedColumnCount.sawmill,
      textureKey: GAME_ASSET_KEYS.tokenMarquiseSawmill,
      alt: 'Sawmill',
    },
    {
      trackId: 'workshop',
      emptied: props.view.emptiedColumnCount.workshop,
      textureKey: GAME_ASSET_KEYS.tokenMarquiseWorkshop,
      alt: 'Workshop',
    },
    {
      trackId: 'recruiter',
      emptied: props.view.emptiedColumnCount.recruiter,
      textureKey: GAME_ASSET_KEYS.tokenMarquiseRecruiter,
      alt: 'Recruiter',
    },
  ]
  return (
    <>
      {rows.map((row) => (
        <RemainingTrackTokens
          key={row.trackId}
          layout={props.layout}
          trackId={row.trackId}
          cellCount={MARQUISE_TRACK_SLOT_COUNT}
          emptiedCount={row.emptied}
          textureKey={row.textureKey}
          alt={row.alt}
        />
      ))}
    </>
  )
}

/** One suit icon per card; the text summary stays for screen readers and hover. */
function SuitIconRow(props: { suits: readonly string[] }): JSX.Element {
  const summary = formatDecreeSuitCounts(props.suits)
  if (props.suits.length === 0) {
    return <span>{summary}</span>
  }
  return (
    <span
      className="flex h-full flex-row items-center gap-1"
      role="img"
      aria-label={summary}
      title={summary}
    >
      {sortDecreeSuits(props.suits).map((suit, index) => {
        const textureKey = suitTextureKey(suit)
        const imagePath =
          textureKey !== null ? imagePathForAssetKey(textureKey) : null
        if (imagePath === null) {
          return <span key={`${suit}-${String(index)}`}>{suit}</span>
        }
        return (
          <img
            key={`${suit}-${String(index)}`}
            className="block h-full w-auto object-contain select-none"
            src={imagePath}
            alt=""
            draggable={false}
          />
        )
      })}
    </span>
  )
}

function EyrieDecreeOverlays(props: {
  view: Extract<FactionBoardViewModel, { kind: 'eyrie' }>
  layout: FactionBoardPixelLayout
}): JSX.Element {
  return (
    <>
      {props.view.decreeColumns.map((column) => {
        const region = findBoardLayoutRegion(props.layout, column.regionId)
        if (region === null) {
          return null
        }
        const active = props.view.activeDecreeColumn === column.columnId
        return (
          <div
            key={column.columnId}
            className={`${DECREE_CLASS_NAME} ${
              active ? DECREE_ACTIVE_CLASS_NAME : DECREE_IDLE_CLASS_NAME
            }`}
            style={layoutRegionStyle(region, props.layout)}
          >
            <SuitIconRow suits={column.suits} />
          </div>
        )
      })}
    </>
  )
}

function EyrieLeaderOverlay(props: {
  view: Extract<FactionBoardViewModel, { kind: 'eyrie' }>
  layout: FactionBoardPixelLayout
}): JSX.Element | null {
  if (props.view.leader === null) {
    return null
  }
  const leaderAsset = lookupEyrieLeader(props.view.leader.id)
  if (leaderAsset === null) {
    return null
  }
  const region = findBoardLayoutRegion(props.layout, 'leader-slot')
  if (region === null) {
    return null
  }
  return (
    <img
      className={LEADER_CLASS_NAME}
      style={layoutRegionStyle(region, props.layout)}
      src={leaderAsset.imagePath}
      alt={props.view.leader.name}
      draggable={false}
    />
  )
}

function SupportersPileOverlay(props: {
  view: Extract<FactionBoardViewModel, { kind: 'alliance' }>
  region: BoardLayoutRegion
  layout: FactionBoardPixelLayout
}): JSX.Element {
  const topDefId = props.view.topSupporterDefId
  const topCardImagePath =
    topDefId === null ? null : cardImagePublicPath(topDefId)
  return (
    <button
      type="button"
      className="faction-board-modal__supporters-hit pointer-events-auto absolute cursor-pointer overflow-hidden disabled:cursor-not-allowed"
      style={layoutRegionStyle(props.region, props.layout)}
      aria-label={
        props.view.supportersFaceDown
          ? `Supporters face down (${String(props.view.supporters)})`
          : `Observe supporters (${String(props.view.supporters)})`
      }
      disabled={props.view.supportersFaceDown}
      onClick={() => {
        getHudCallbacks().onSupportersClick(props.view.seat)
      }}
    >
      {topCardImagePath !== null ? (
        <img
          className="pointer-events-none absolute inset-0 z-0 block size-full object-fill select-none"
          src={topCardImagePath}
          alt=""
          draggable={false}
        />
      ) : null}
      {props.view.supportersFaceDown ? null : (
        <span
          className={`${DARK_LABEL_CLASS_NAME} pointer-events-none absolute inset-x-0 top-0 z-1 px-2 py-1 text-center text-[clamp(10px,2vh,14px)] leading-[1.2]`}
        >
          {formatDecreeSuitCounts(props.view.supporterSuits)}
        </span>
      )}
      <span className={SUPPLY_BADGE_CLASS_NAME}>
        {String(props.view.supporters)}
      </span>
    </button>
  )
}

function AllianceSupplyExtras(props: {
  view: Extract<FactionBoardViewModel, { kind: 'alliance' }>
  layout: FactionBoardPixelLayout
}): JSX.Element {
  const officersRegion = findBoardLayoutRegion(props.layout, 'officers')
  const supportersRegion = findBoardLayoutRegion(props.layout, 'supporters')
  const baseSuitRegionIds: ReadonlyArray<{ suit: string; regionId: string }> = [
    { suit: 'fox', regionId: 'base-fox' },
    { suit: 'rabbit', regionId: 'base-rabbit' },
    { suit: 'mouse', regionId: 'base-mouse' },
  ]
  return (
    <>
      {officersRegion !== null ? (
        <SupplyCell
          region={officersRegion}
          layout={props.layout}
          countLabel={String(props.view.officers)}
          textureKey={GAME_ASSET_KEYS.tokenAllianceWarrior}
          alt="Officers"
        />
      ) : null}
      {supportersRegion !== null ? (
        <SupportersPileOverlay
          view={props.view}
          region={supportersRegion}
          layout={props.layout}
        />
      ) : null}
      {baseSuitRegionIds.map((slot) => {
        if (!props.view.basesInSupply.includes(slot.suit)) {
          return null
        }
        const region = findBoardLayoutRegion(props.layout, slot.regionId)
        if (region === null) {
          return null
        }
        const imagePath = imagePathForAssetKey(allianceBaseTextureKey(slot.suit))
        if (imagePath === null) {
          return null
        }
        return (
          <FitToken
            key={slot.regionId}
            region={region}
            layout={props.layout}
            imagePath={imagePath}
            alt={`${slot.suit} base`}
          />
        )
      })}
    </>
  )
}

function VagabondTrackItemOverlays(props: {
  view: Extract<FactionBoardViewModel, { kind: 'vagabond' }>
  layout: FactionBoardPixelLayout
}): JSX.Element {
  const trackRows: Array<{
    trackId: 'tea' | 'coin' | 'bag'
    items: Array<{ type: string; exhausted: boolean }>
  }> = [
    { trackId: 'tea', items: props.view.tracks.tea },
    { trackId: 'coin', items: props.view.tracks.coin },
    { trackId: 'bag', items: props.view.tracks.bag },
  ]
  const findRearrange = useRearrangeSpecFinder(props.view.seat)
  return (
    <>
      {trackRows.map((row) =>
        row.items.map((item, cellIndex) => {
          const region = trackCellRegion(
            props.layout,
            row.trackId,
            cellIndex,
          )
          if (region === null) {
            return null
          }
          const textureKey = itemTextureKey(item.type)
          const imagePath =
            textureKey !== null ? imagePathForAssetKey(textureKey) : null
          if (imagePath === null) {
            return null
          }
          const rearrangeSpec = item.exhausted
            ? null
            : findRearrange(row.trackId, 'track')
          if (rearrangeSpec !== null) {
            return (
              <button
                key={`${row.trackId}-${item.type}-${String(cellIndex)}`}
                type="button"
                className={`${TOKEN_CLASS_NAME} ${BOARD_CLICKABLE_CLASS_NAME}`}
                style={layoutRegionStyle(region, props.layout)}
                title={MOVE_TO_SATCHEL_HINT}
                aria-label={`${item.type}: ${MOVE_TO_SATCHEL_HINT}`}
                onClick={() => {
                  getHudCallbacks().onRearrangeItem(rearrangeSpec)
                }}
              >
                <img
                  className="block size-full object-fill"
                  src={imagePath}
                  alt=""
                  draggable={false}
                />
              </button>
            )
          }
          // Fill layout cell (tea/coin/bag slots) — not crafted-strip sizing.
          return (
            <img
              key={`${row.trackId}-${item.type}-${String(cellIndex)}`}
              className={`${TOKEN_CLASS_NAME} object-fill ${
                item.exhausted ? EXHAUSTED_CLASS_NAME : ''
              }`}
              style={layoutRegionStyle(region, props.layout)}
              src={imagePath}
              alt={item.type}
              draggable={false}
            />
          )
        }),
      )}
    </>
  )
}

function VagabondCharacterOverlay(props: {
  view: Extract<FactionBoardViewModel, { kind: 'vagabond' }>
  layout: FactionBoardPixelLayout
}): JSX.Element | null {
  const region = findBoardLayoutRegion(props.layout, 'character-slot')
  if (region === null) {
    return null
  }
  const imagePath = imagePathForAssetKey(props.view.character.cardAssetKey)
  if (imagePath === null) {
    return null
  }
  return (
    <img
      className={LEADER_CLASS_NAME}
      style={layoutRegionStyle(region, props.layout)}
      src={imagePath}
      alt={props.view.character.name}
      draggable={false}
    />
  )
}

function VagabondRelationshipOverlays(props: {
  view: Extract<FactionBoardViewModel, { kind: 'vagabond' }>
  layout: FactionBoardPixelLayout
}): JSX.Element {
  const hostileRegion = findBoardLayoutRegion(
    props.layout,
    'relationship-hostile',
  )
  const hostileMarkers = props.view.relationships.filter(
    (marker) => marker.space === 'hostile',
  )
  const developmentSlots: VagabondRelationshipMarkerView[][] = Array.from(
    { length: VAGABOND_RELATIONSHIP_DEVELOPMENT_CELLS },
    () => [],
  )
  for (const marker of props.view.relationships) {
    if (marker.space === 'hostile') {
      continue
    }
    const slot = developmentSlots[marker.space]
    if (slot === undefined) {
      continue
    }
    slot.push(marker)
  }
  return (
    <>
      {hostileRegion !== null && hostileMarkers.length > 0 ? (
        <RelationshipMarkerPack
          region={hostileRegion}
          layout={props.layout}
          markers={hostileMarkers}
          packClassName={`${RELATIONSHIP_PACK_CLASS_NAME} gap-1`}
        />
      ) : null}
      {developmentSlots.map((markers, cellIndex) => {
        if (markers.length === 0) {
          return null
        }
        const region = trackCellRegion(
          props.layout,
          'relationship-development',
          cellIndex,
        )
        if (region === null) {
          return null
        }
        return (
          <RelationshipMarkerPack
            key={`relationship-dev-${String(cellIndex)}`}
            region={region}
            layout={props.layout}
            markers={markers}
            packClassName={`${RELATIONSHIP_PACK_CLASS_NAME} gap-0.5`}
          />
        )
      })}
    </>
  )
}

function RelationshipMarkerPack(props: {
  region: BoardLayoutRegion
  layout: FactionBoardPixelLayout
  markers: readonly VagabondRelationshipMarkerView[]
  packClassName: string
}): JSX.Element {
  return (
    <div
      className={props.packClassName}
      style={layoutRegionStyle(props.region, props.layout)}
      data-marker-count={String(props.markers.length)}
    >
      {props.markers.map((marker) => {
        const imagePath = imagePathForAssetKey(
          factionTextureKey(marker.faction),
        )
        if (imagePath === null) {
          return null
        }
        return (
          <img
            key={marker.faction}
            className="size-16 flex-none object-contain object-center select-none"
            src={imagePath}
            alt={`${marker.faction} relationship`}
            draggable={false}
          />
        )
      })}
    </div>
  )
}

function VagabondItemOverlays(props: {
  view: Extract<FactionBoardViewModel, { kind: 'vagabond' }>
  layout: FactionBoardPixelLayout
}): JSX.Element {
  const satchelRegion = findBoardLayoutRegion(props.layout, 'satchel')
  const damagedRegion = findBoardLayoutRegion(props.layout, 'damaged')
  const findRearrange = useRearrangeSpecFinder(props.view.seat)
  return (
    <>
      <VagabondCharacterOverlay view={props.view} layout={props.layout} />
      <VagabondRelationshipOverlays view={props.view} layout={props.layout} />
      <VagabondTrackItemOverlays view={props.view} layout={props.layout} />
      {satchelRegion !== null ? (
        <div
          className={ITEM_PACK_CLASS_NAME}
          style={layoutRegionStyle(satchelRegion, props.layout)}
        >
          {props.view.satchel.map((item, index) => (
            <CraftedItemIcon
              key={`satchel-${item.type}-${String(index)}`}
              item={{ type: item.type, exhausted: item.exhausted, count: 1 }}
              sizeClassName={ITEM_PACK_ITEM_SIZE_CLASS_NAME}
              rearrangeSpec={
                item.exhausted ? null : findRearrange(item.type, 'satchel')
              }
            />
          ))}
        </div>
      ) : null}
      {damagedRegion !== null && props.view.damaged.length > 0 ? (
        <div
          className={ITEM_PACK_CLASS_NAME}
          style={layoutRegionStyle(damagedRegion, props.layout)}
        >
          {props.view.damaged.map((item, index) => (
            <CraftedItemIcon
              key={`damaged-${item.type}-${String(index)}`}
              item={{ type: item.type, exhausted: true, count: 1 }}
              sizeClassName={ITEM_PACK_ITEM_SIZE_CLASS_NAME}
            />
          ))}
        </div>
      ) : null}
    </>
  )
}

/** Layout-baked tokens/supply/decree/leader — coords from *.layout.json. */
export function FactionBoardOverlays(props: OverlayBaseProps): JSX.Element {
  return (
    <div className="absolute inset-0 z-1">
      <CraftedItemsOverlay {...props} />
      {props.view.kind !== 'vagabond' ? <SupplyOverlays {...props} /> : null}
      {props.view.kind === 'marquise' ? (
        <MarquiseTrackOverlays view={props.view} layout={props.layout} />
      ) : null}
      {props.view.kind === 'eyrie' ? (
        <>
          <RemainingTrackTokens
            layout={props.layout}
            trackId="roost"
            cellCount={EYRIE_ROOST_TRACK_SLOT_COUNT}
            emptiedCount={props.view.roostsOnMap}
            textureKey={GAME_ASSET_KEYS.tokenEyrieRoost}
            alt="Roost"
          />
          <EyrieDecreeOverlays view={props.view} layout={props.layout} />
          <EyrieLeaderOverlay view={props.view} layout={props.layout} />
        </>
      ) : null}
      {props.view.kind === 'alliance' ? (
        <RemainingTrackTokens
          layout={props.layout}
          trackId="sympathy"
          cellCount={ALLIANCE_SYMPATHY_TRACK_SLOT_COUNT}
          emptiedCount={
            ALLIANCE_SYMPATHY_TRACK_SLOT_COUNT - props.view.sympathyTokensOnTrack
          }
          textureKey={GAME_ASSET_KEYS.tokenAllianceSympathy}
          alt="Sympathy"
          round
        />
      ) : null}
      {props.view.kind === 'vagabond' ? (
        <VagabondItemOverlays view={props.view} layout={props.layout} />
      ) : null}
    </div>
  )
}
