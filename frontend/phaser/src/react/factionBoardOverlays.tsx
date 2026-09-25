import type { CSSProperties, JSX } from 'react'
import {
  findBoardLayoutRegion,
  scaleBoardLayoutRegion,
  trackCellRegion,
  type BoardImagePlacement,
  type FactionBoardPixelLayout,
  type ScaledBoardRect,
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
  placement: BoardImagePlacement
}

function regionStyle(
  box: ScaledBoardRect,
  placement: BoardImagePlacement,
): CSSProperties {
  return {
    left: box.x - placement.left,
    top: box.y - placement.top,
    width: box.width,
    height: box.height,
  }
}

function FitToken(props: {
  box: ScaledBoardRect
  placement: BoardImagePlacement
  imagePath: string
  alt: string
}): JSX.Element {
  return (
    <img
      className="faction-board-modal__token"
      style={regionStyle(props.box, props.placement)}
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
  const box = scaleBoardLayoutRegion(region, props.placement)
  const style = regionStyle(box, props.placement)
  if (props.view.crafted.items.length === 0) {
    return (
      <div className="faction-board-modal__crafted faction-board-modal__crafted--empty" style={style}>
        Items (none)
      </div>
    )
  }

  const iconSize = Math.max(18, Math.min(36, Math.round(box.height * 0.72)))
  return (
    <div className="faction-board-modal__crafted" style={style}>
      {props.view.crafted.items.map((item) => (
        <CraftedItemIcon key={item.type} item={item} iconSize={iconSize} />
      ))}
    </div>
  )
}

function CraftedItemIcon(props: {
  item: CraftedItemView
  iconSize: number
}): JSX.Element {
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
      style={{ width: props.iconSize, height: props.iconSize }}
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
  box: ScaledBoardRect
  placement: BoardImagePlacement
  countLabel: string
  textureKey: string
  alt: string
}): JSX.Element {
  const imagePath = imagePathForAssetKey(props.textureKey)
  return (
    <>
      {imagePath !== null ? (
        <FitToken
          box={props.box}
          placement={props.placement}
          imagePath={imagePath}
          alt={props.alt}
        />
      ) : null}
      <span
        className="faction-board-modal__supply-badge"
        style={{
          left: props.box.x - props.placement.left + props.box.width - 4,
          top: props.box.y - props.placement.top + 2,
          fontSize: `${Math.max(14, Math.round(props.box.height * 0.28))}px`,
        }}
      >
        {props.countLabel}
      </span>
    </>
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
          box={scaleBoardLayoutRegion(warriorsRegion, props.placement)}
          placement={props.placement}
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
          box={scaleBoardLayoutRegion(woodRegion, props.placement)}
          placement={props.placement}
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
  placement: BoardImagePlacement
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
        box={scaleBoardLayoutRegion(region, props.placement)}
        placement={props.placement}
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
  placement: BoardImagePlacement
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
          placement={props.placement}
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
  placement: BoardImagePlacement
}): JSX.Element {
  return (
    <>
      {props.view.decreeColumns.map((column) => {
        const region = findBoardLayoutRegion(props.layout, column.regionId)
        if (region === null) {
          return null
        }
        const box = scaleBoardLayoutRegion(region, props.placement)
        const active = props.view.activeDecreeColumn === column.columnId
        return (
          <div
            key={column.columnId}
            className={
              active
                ? 'faction-board-modal__decree faction-board-modal__decree--active'
                : 'faction-board-modal__decree'
            }
            style={{
              ...regionStyle(box, props.placement),
              fontSize: `${Math.max(11, Math.round(box.height * 0.38))}px`,
            }}
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
  placement: BoardImagePlacement
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
  const box = scaleBoardLayoutRegion(region, props.placement)
  return (
    <img
      className="faction-board-modal__leader"
      style={regionStyle(box, props.placement)}
      src={leaderAsset.imagePath}
      alt={props.view.leader.name}
      draggable={false}
    />
  )
}

/** Layout-baked tokens/supply/decree/leader on the character board. */
export function FactionBoardOverlays(props: OverlayBaseProps): JSX.Element {
  return (
    <div className="faction-board-modal__overlays">
      <CraftedItemsOverlay {...props} />
      <SupplyOverlays {...props} />
      {props.view.kind === 'marquise' ? (
        <MarquiseTrackOverlays
          view={props.view}
          layout={props.layout}
          placement={props.placement}
        />
      ) : (
        <>
          <RemainingTrackTokens
            layout={props.layout}
            placement={props.placement}
            trackId="roost"
            emptiedCount={props.view.roostsOnMap}
            textureKey={GAME_ASSET_KEYS.tokenEyrieRoost}
            alt="Roost"
          />
          <EyrieDecreeOverlays
            view={props.view}
            layout={props.layout}
            placement={props.placement}
          />
          <EyrieLeaderOverlay
            view={props.view}
            layout={props.layout}
            placement={props.placement}
          />
        </>
      )}
    </div>
  )
}
