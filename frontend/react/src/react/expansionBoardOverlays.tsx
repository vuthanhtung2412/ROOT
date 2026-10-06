import type { JSX } from 'react'
import {
  findBoardLayoutRegion,
  trackCellRegion,
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

const BOARD_LABEL_CLASS_NAME =
  'absolute z-2 flex items-center justify-center bg-parchment/93 px-1.5 font-mono text-[clamp(10px,2vh,14px)] text-ink-deep'
const CARD_STRIP_CLASS_NAME =
  'absolute z-2 flex flex-row items-stretch gap-1 overflow-hidden'
const FUND_BOX_CLASS_NAME =
  'absolute z-2 flex flex-wrap content-start items-start gap-0.5 overflow-hidden p-1'
const FUND_WARRIOR_CLASS_NAME = 'block h-[30%] max-h-10 w-auto select-none'
const FUND_COUNT_CLASS_NAME =
  'absolute right-[2%] bottom-[2%] bg-parchment/93 px-1.5 py-0.5 font-mono text-[clamp(11px,2.2vh,16px)] text-ink-deep'
const SERVICE_MARKER_CLASS_NAME =
  'absolute z-2 rounded-full border-[3px] border-[#7a1f1f] bg-[rgb(122_31_31/0.28)]'

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

/** Rule: 10.5 — cards revealed this turn sit in the play area. */
function RevealedCards(
  props: LayoutProps & { view: LizardBoardViewModel },
): JSX.Element | null {
  const region = findBoardLayoutRegion(props.layout, 'revealed')
  if (region === null || props.view.revealedDefIds.length === 0) {
    return null
  }
  return (
    <div
      className={`lizard-revealed ${CARD_STRIP_CLASS_NAME}`}
      style={layoutRegionStyle(region, props.layout)}
    >
      {props.view.revealedDefIds.map((defId: string, index: number) => {
        const imagePath = cardImagePublicPath(defId)
        if (imagePath === null) {
          return null
        }
        return (
          <img
            key={`${defId}-${String(index)}`}
            className="block h-full w-auto select-none"
            src={imagePath}
            alt="Revealed card"
            draggable={false}
          />
        )
      })}
    </div>
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
      <RevealedCards view={props.view} layout={props.layout} />
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
        <span
          className={`lizard-lost-souls ${BOARD_LABEL_CLASS_NAME}`}
          style={layoutRegionStyle(lostSoulsRegion, props.layout)}
        >
          {`Lost Souls: ${String(props.view.lostSoulsCount)}`}
        </span>
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
