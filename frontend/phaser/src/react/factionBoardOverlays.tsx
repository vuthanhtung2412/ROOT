import type { CSSProperties, JSX } from 'react'
import {
  findBoardLayoutRegion,
  trackCellRegion,
  type BoardLayoutRegion,
  type FactionBoardPixelLayout,
} from '#assets/factionBoardLayout.ts'
import {
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
  itemTextureKey,
} from '#assets/gameAssets.ts'
import { lookupEyrieLeader } from '#assets/eyrieLeaderCatalog.ts'
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
}): JSX.Element {
  return (
    <img
      className="faction-board-modal__token"
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
            props.view.kind === 'marquise'
              ? GAME_ASSET_KEYS.factionMarquise
              : GAME_ASSET_KEYS.factionEyrie
          }
          alt="Warriors supply"
        />
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
  emptiedCount: number
  textureKey: string
  alt: string
}): JSX.Element | null {
  const track = props.layout.tracks.find((entry) => entry.id === props.trackId)
  const imagePath = imagePathForAssetKey(props.textureKey)
  if (track === undefined || imagePath === null) {
    return null
  }
  const nodes: JSX.Element[] = []
  for (let cellIndex = 0; cellIndex < track.cells; cellIndex += 1) {
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

/** Layout-baked tokens/supply/decree/leader — coords from *.layout.json. */
export function FactionBoardOverlays(props: OverlayBaseProps): JSX.Element {
  return (
    <div className="faction-board-modal__overlays">
      <CraftedItemsOverlay {...props} />
      <SupplyOverlays {...props} />
      {props.view.kind === 'marquise' ? (
        <MarquiseTrackOverlays view={props.view} layout={props.layout} />
      ) : (
        <>
          <RemainingTrackTokens
            layout={props.layout}
            trackId="roost"
            emptiedCount={props.view.roostsOnMap}
            textureKey={GAME_ASSET_KEYS.tokenEyrieRoost}
            alt="Roost"
          />
          <EyrieDecreeOverlays view={props.view} layout={props.layout} />
          <EyrieLeaderOverlay view={props.view} layout={props.layout} />
        </>
      )}
    </div>
  )
}
