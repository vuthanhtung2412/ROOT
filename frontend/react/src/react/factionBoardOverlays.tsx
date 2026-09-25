import type { CSSProperties, JSX } from 'react'
import {
  findBoardLayoutRegion,
  trackCellRegion,
  type BoardLayoutRegion,
  type FactionBoardPixelLayout,
} from '#assets/factionBoardLayout.ts'
import { getHudCallbacks } from '#game/hudStore.ts'
import {
  allianceBaseTextureKey,
  cardImagePublicPath,
  factionTextureKey,
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
  itemTextureKey,
} from '#assets/gameAssets.ts'
import { lookupEyrieLeader } from '#assets/eyrieLeaderCatalog.ts'
import { EYRIE_ROOST_TRACK_SLOT_COUNT } from '#assets/eyrieBoardCatalog.ts'
import { MARQUISE_TRACK_SLOT_COUNT } from '#assets/marquiseBoardCatalog.ts'
import { ALLIANCE_SYMPATHY_TRACK_SLOT_COUNT } from '#assets/allianceBoardCatalog.ts'
import {
  formatDecreeSuitCounts,
  type CraftedItemView,
  type FactionBoardViewModel,
} from '#ui/factionBoardViewModel.ts'

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

function FitToken(props: {
  region: BoardLayoutRegion
  layout: FactionBoardPixelLayout
  imagePath: string
  alt: string
  round?: boolean
}): JSX.Element {
  const className = props.round
    ? 'faction-board-modal__token faction-board-modal__token--round'
    : 'faction-board-modal__token'
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
  if (region === null) {
    return null
  }
  const style = layoutRegionStyle(region, props.layout)
  if (props.view.crafted.items.length === 0) {
    return (
      <div
        className="faction-board-modal__crafted faction-board-modal__crafted--empty"
        style={style}
      >
        Items (none)
      </div>
    )
  }

  return (
    <div className="faction-board-modal__crafted" style={style}>
      {props.view.crafted.items.map((item) => (
        <CraftedItemIcon key={item.type} item={item} />
      ))}
    </div>
  )
}

function CraftedItemIcon(props: { item: CraftedItemView }): JSX.Element {
  const textureKey = itemTextureKey(props.item.type)
  const imagePath =
    textureKey !== null ? imagePathForAssetKey(textureKey) : null
  return (
    <div
      className={
        props.item.exhausted
          ? 'faction-board-modal__crafted-item faction-board-modal__crafted-item--exhausted'
          : 'faction-board-modal__crafted-item'
      }
    >
      {imagePath !== null ? (
        <img src={imagePath} alt={props.item.type} draggable={false} />
      ) : (
        <span className="faction-board-modal__crafted-fallback">
          {props.item.type}
        </span>
      )}
      {props.item.count > 1 ? (
        <span className="faction-board-modal__crafted-count">
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
    <div className="faction-board-modal__supply" style={style}>
      {imagePath !== null ? (
        <img
          className="faction-board-modal__supply-token"
          src={imagePath}
          alt={props.alt}
          draggable={false}
        />
      ) : null}
      <span className="faction-board-modal__supply-badge">{props.countLabel}</span>
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
            props.view.kind === 'alliance'
              ? GAME_ASSET_KEYS.tokenAllianceWarrior
              : factionTextureKey(props.view.kind)
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
        round={props.round}
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
            className={
              active
                ? 'faction-board-modal__decree faction-board-modal__decree--active'
                : 'faction-board-modal__decree'
            }
            style={layoutRegionStyle(region, props.layout)}
          >
            {formatDecreeSuitCounts(column.suits)}
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
      className="faction-board-modal__leader"
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
      className="faction-board-modal__supporters-hit"
      style={layoutRegionStyle(props.region, props.layout)}
      aria-label={`Observe supporters (${String(props.view.supporters)})`}
      onClick={() => {
        getHudCallbacks().onSupportersClick(props.view.seat)
      }}
    >
      {topCardImagePath !== null ? (
        <img
          className="faction-board-modal__supporters-top-card"
          src={topCardImagePath}
          alt=""
          draggable={false}
        />
      ) : null}
      <span className="faction-board-modal__supporters-suits">
        {formatDecreeSuitCounts(props.view.supporterSuits)}
      </span>
      <span className="faction-board-modal__supply-badge">
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
          // Fill layout cell (tea/coin/bag slots) — not crafted-strip sizing.
          return (
            <img
              key={`${row.trackId}-${item.type}-${String(cellIndex)}`}
              className={
                item.exhausted
                  ? 'faction-board-modal__token faction-board-modal__token--exhausted'
                  : 'faction-board-modal__token'
              }
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
  layout: FactionBoardPixelLayout
}): JSX.Element | null {
  const region = findBoardLayoutRegion(props.layout, 'character-slot')
  if (region === null) {
    return null
  }
  const imagePath = imagePathForAssetKey(
    GAME_ASSET_KEYS.characterCardVagabondThief,
  )
  if (imagePath === null) {
    return null
  }
  return (
    <img
      className="faction-board-modal__leader"
      style={layoutRegionStyle(region, props.layout)}
      src={imagePath}
      alt="Thief"
      draggable={false}
    />
  )
}

function VagabondItemOverlays(props: {
  view: Extract<FactionBoardViewModel, { kind: 'vagabond' }>
  layout: FactionBoardPixelLayout
}): JSX.Element {
  const satchelRegion = findBoardLayoutRegion(props.layout, 'satchel')
  const damagedRegion = findBoardLayoutRegion(props.layout, 'damaged')
  return (
    <>
      <VagabondCharacterOverlay layout={props.layout} />
      <VagabondTrackItemOverlays view={props.view} layout={props.layout} />
      {satchelRegion !== null ? (
        <div
          className="faction-board-modal__item-pack"
          style={layoutRegionStyle(satchelRegion, props.layout)}
        >
          {props.view.satchel.map((item, index) => (
            <CraftedItemIcon
              key={`satchel-${item.type}-${String(index)}`}
              item={{ type: item.type, exhausted: item.exhausted, count: 1 }}
            />
          ))}
        </div>
      ) : null}
      {damagedRegion !== null && props.view.damaged.length > 0 ? (
        <div
          className="faction-board-modal__item-pack"
          style={layoutRegionStyle(damagedRegion, props.layout)}
        >
          {props.view.damaged.map((item, index) => (
            <CraftedItemIcon
              key={`damaged-${item.type}-${String(index)}`}
              item={{ type: item.type, exhausted: true, count: 1 }}
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
    <div className="faction-board-modal__overlays">
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
