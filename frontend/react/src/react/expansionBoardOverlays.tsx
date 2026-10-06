import type { JSX } from 'react'
import {
  findBoardLayoutRegion,
  trackCellRegion,
  type BoardLayoutRegion,
  type FactionBoardPixelLayout,
} from '#assets/factionBoardLayout.ts'
import {
  cardImagePublicPath,
  factionTextureKey,
  imagePathForAssetKey,
  warriorTokenTextureKey,
} from '#assets/gameAssets.ts'
import {
  gardenTextureKey,
  outcastMarkerTextureKey,
  RIVERFOLK_EXPANSION_ASSET_KEYS,
  tradePostTextureKey,
} from '#assets/riverfolkExpansionAssets.ts'
import { getHudCallbacks } from '#game/hudStore.ts'
import {
  FitToken,
  layoutRegionStyle,
  RemainingTrackTokens,
  SupplyCell,
} from '#react/factionBoardOverlays.tsx'
import {
  BOARD_SUITS,
  LIZARD_GARDEN_TRACK_SLOT_COUNT,
  RIVERFOLK_SERVICE_IDS,
  RIVERFOLK_TRADE_POST_TRACK_SLOT_COUNT,
  type BoardSuit,
  type LizardBoardViewModel,
  type RiverfolkBoardViewModel,
  type RiverfolkServiceId,
} from '#ui/expansionBoardViewModel.ts'
import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'

/** An empty pile shows the printed Lost Souls art; a card covers it otherwise. */
const LOST_SOULS_PILE_CLASS_NAME =
  'pointer-events-auto absolute z-2 cursor-pointer p-[3%] hover:brightness-110'
const LOST_SOULS_COUNT_CLASS_NAME =
  'absolute inset-x-0 bottom-[3%] mx-auto w-fit bg-parchment/93 px-1.5 py-0.5 font-mono text-[clamp(10px,2vh,14px)] text-ink-deep'
const FUND_BOX_CLASS_NAME =
  'absolute z-2 flex flex-wrap content-start items-start gap-0.5 overflow-hidden p-1'
const FUND_WARRIOR_CLASS_NAME = 'block h-[30%] max-h-10 w-auto select-none'
const FUND_COUNT_CLASS_NAME =
  'absolute right-[2%] bottom-[2%] bg-parchment/93 px-1.5 py-0.5 font-mono text-[clamp(11px,2.2vh,16px)] text-ink-deep'
const SERVICE_MARKER_CLASS_NAME =
  'absolute z-2 rounded-full border-[3px] border-riverfolk bg-riverfolk/28'

const FUND_BOX_REGIONS: ReadonlyArray<{
  regionId: string
  label: string
  box: 'payments' | 'funds' | 'committed'
}> = [
  { regionId: 'payments', label: 'Payments', box: 'payments' },
  { regionId: 'funds', label: 'Funds', box: 'funds' },
  { regionId: 'committed', label: 'Commitments', box: 'committed' },
]

type LayoutProps = {
  layout: FactionBoardPixelLayout
}

function warriorImagePath(factionId: string): string | null {
  return imagePathForAssetKey(
    warriorTokenTextureKey(factionId) ?? factionTextureKey(factionId),
  )
}

/** Rule: 10.4.1 — outcast marker on its suit space, Outcast or Hated side. */
function OutcastMarker(
  props: LayoutProps & { view: LizardBoardViewModel },
): JSX.Element | null {
  if (props.view.outcast === null) {
    return null
  }
  const region = findBoardLayoutRegion(
    props.layout,
    `outcast-${props.view.outcast}`,
  )
  const imagePath = imagePathForAssetKey(
    outcastMarkerTextureKey(props.view.hated),
  )
  if (region === null || imagePath === null) {
    return null
  }
  return (
    <FitToken
      region={region}
      layout={props.layout}
      imagePath={imagePath}
      alt={props.view.hated ? 'Hated Outcast' : 'Outcast'}
    />
  )
}

/**
 * Rule: 10.2.6 The Lost Souls Pile — a public pile: top card face up with the
 * pile size; click to look through it.
 */
function LostSoulsPile(
  props: LayoutProps & {
    view: LizardBoardViewModel
    region: BoardLayoutRegion
  },
): JSX.Element {
  const topDefId: string | null = props.view.topLostSoulDefId
  const topCardImagePath: string | null =
    topDefId === null ? null : cardImagePublicPath(topDefId)
  return (
    <button
      type="button"
      className={`lizard-lost-souls ${LOST_SOULS_PILE_CLASS_NAME}`}
      style={layoutRegionStyle(props.region, props.layout)}
      aria-label={`Observe Lost Souls (${String(props.view.lostSoulsCount)})`}
      onClick={() => {
        getHudCallbacks().onLostSoulsClick()
      }}
    >
      {topCardImagePath !== null ? (
        <img
          className="pointer-events-none block size-full object-contain select-none"
          src={topCardImagePath}
          alt=""
          draggable={false}
        />
      ) : null}
      <span className={LOST_SOULS_COUNT_CLASS_NAME}>
        {`Lost Souls: ${String(props.view.lostSoulsCount)}`}
      </span>
    </button>
  )
}

function LizardBoardOverlays(
  props: LayoutProps & { view: LizardBoardViewModel },
): JSX.Element {
  const acolytesRegion = findBoardLayoutRegion(props.layout, 'acolytes')
  const lostSoulsRegion = findBoardLayoutRegion(props.layout, 'lost-souls')
  return (
    <>
      {acolytesRegion !== null ? (
        <SupplyCell
          region={acolytesRegion}
          layout={props.layout}
          countLabel={String(props.view.acolytes)}
          textureKey={RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardWarrior}
          alt="Acolytes"
        />
      ) : null}
      <OutcastMarker view={props.view} layout={props.layout} />
      {BOARD_SUITS.map((suit: BoardSuit) => (
        <RemainingTrackTokens
          key={suit}
          layout={props.layout}
          trackId={`garden-${suit}`}
          cellCount={LIZARD_GARDEN_TRACK_SLOT_COUNT}
          emptiedCount={
            LIZARD_GARDEN_TRACK_SLOT_COUNT - props.view.gardensOnTrack[suit]
          }
          textureKey={gardenTextureKey(suit)}
          alt={`${suit} garden`}
        />
      ))}
      {lostSoulsRegion !== null ? (
        <LostSoulsPile
          view={props.view}
          layout={props.layout}
          region={lostSoulsRegion}
        />
      ) : null}
    </>
  )
}

/** One box of the board: a warrior per fund, in its owner's colours. */
function FundBox(
  props: LayoutProps & {
    regionId: string
    label: string
    factions: readonly string[]
  },
): JSX.Element | null {
  const region = findBoardLayoutRegion(props.layout, props.regionId)
  if (region === null) {
    return null
  }
  return (
    <div
      className={`riverfolk-${props.regionId} ${FUND_BOX_CLASS_NAME}`}
      style={layoutRegionStyle(region, props.layout)}
    >
      {props.factions.map((factionId: string, index: number) => {
        const imagePath = warriorImagePath(factionId)
        if (imagePath === null) {
          return null
        }
        return (
          <img
            key={`${factionId}-${String(index)}`}
            className={FUND_WARRIOR_CLASS_NAME}
            src={imagePath}
            alt={`${factionId} warrior`}
            draggable={false}
          />
        )
      })}
      <span className={FUND_COUNT_CLASS_NAME}>
        {`${props.label}: ${String(props.factions.length)}`}
      </span>
    </div>
  )
}

/** Rule: 11.3.5 — the marker of a service sits on its current cost. */
function ServiceMarker(
  props: LayoutProps & { service: RiverfolkServiceId; cost: number },
): JSX.Element | null {
  const region = trackCellRegion(
    props.layout,
    `service-${props.service}`,
    props.cost - 1,
  )
  if (region === null) {
    return null
  }
  return (
    <div
      className={`riverfolk-service-${props.service} ${SERVICE_MARKER_CLASS_NAME}`}
      style={layoutRegionStyle(region, props.layout)}
      title={`${props.service}: cost ${String(props.cost)}`}
    />
  )
}

/** Rule: 11.5.3 — funds committed to craft sit on empty Trade Posts spaces. */
function CraftCommittedFunds(
  props: LayoutProps & { suit: BoardSuit; factions: readonly string[] },
): JSX.Element {
  return (
    <>
      {props.factions.map((factionId: string, index: number) => {
        const region = trackCellRegion(
          props.layout,
          `trade-post-${props.suit}`,
          index,
        )
        const imagePath = warriorImagePath(factionId)
        if (region === null || imagePath === null) {
          return null
        }
        return (
          <FitToken
            key={`${props.suit}-${String(index)}`}
            region={region}
            layout={props.layout}
            imagePath={imagePath}
            alt={`${factionId} warrior committed to craft`}
          />
        )
      })}
    </>
  )
}

function RiverfolkBoardOverlays(
  props: LayoutProps & { view: RiverfolkBoardViewModel },
): JSX.Element {
  return (
    <>
      {FUND_BOX_REGIONS.map((entry) => (
        <FundBox
          key={entry.regionId}
          layout={props.layout}
          regionId={entry.regionId}
          label={entry.label}
          factions={props.view[entry.box]}
        />
      ))}
      {RIVERFOLK_SERVICE_IDS.map((service: RiverfolkServiceId) => (
        <ServiceMarker
          key={service}
          layout={props.layout}
          service={service}
          cost={props.view.serviceCosts[service]}
        />
      ))}
      {BOARD_SUITS.map((suit: BoardSuit) => (
        <RemainingTrackTokens
          key={`posts-${suit}`}
          layout={props.layout}
          trackId={`trade-post-${suit}`}
          cellCount={RIVERFOLK_TRADE_POST_TRACK_SLOT_COUNT}
          emptiedCount={
            RIVERFOLK_TRADE_POST_TRACK_SLOT_COUNT -
            props.view.tradePostsOnTrack[suit]
          }
          textureKey={tradePostTextureKey(suit)}
          alt={`${suit} trade post`}
        />
      ))}
      {BOARD_SUITS.map((suit: BoardSuit) => (
        <CraftCommittedFunds
          key={`craft-${suit}`}
          layout={props.layout}
          suit={suit}
          factions={props.view.craftCommitted[suit]}
        />
      ))}
    </>
  )
}

/** Board pieces of the Lizard Cult and the Riverfolk Company. */
export function ExpansionBoardOverlays(props: {
  view: FactionBoardViewModel
  layout: FactionBoardPixelLayout
}): JSX.Element | null {
  if (props.view.kind === 'lizard') {
    return (
      <div className="pointer-events-none absolute inset-0 z-1">
        <LizardBoardOverlays view={props.view} layout={props.layout} />
      </div>
    )
  }
  if (props.view.kind === 'riverfolk') {
    return (
      <div className="pointer-events-none absolute inset-0 z-1">
        <RiverfolkBoardOverlays view={props.view} layout={props.layout} />
      </div>
    )
  }
  return null
}
