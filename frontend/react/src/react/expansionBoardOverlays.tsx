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
  suitTextureKey,
  warriorTokenTextureKey,
} from '#assets/gameAssets.ts'
import {
  gardenTextureKey,
  outcastMarkerTextureKey,
  RIVERFOLK_EXPANSION_ASSET_KEYS,
  tradePostTextureKey,
} from '#assets/riverfolkExpansionAssets.ts'
import { IS_BIRTHDAY_EDITION } from '#game/birthdayEdition.ts'
import { getHudCallbacks } from '#game/hudStore.ts'
import { TokenBow } from '#react/BirthdayDecorations.tsx'
import {
  FitToken,
  layoutRegionStyle,
  RemainingTrackTokens,
  SupplyCell,
} from '#react/factionBoardOverlays.tsx'
import { SuitIcon } from '#react/SuitIcon.tsx'
import {
  BOARD_SUITS,
  LIZARD_GARDEN_TRACK_SLOT_COUNT,
  RIVERFOLK_SERVICE_IDS,
  RIVERFOLK_TRADE_POST_TRACK_SLOT_COUNT,
  type BoardSuit,
  type LizardBoardViewModel,
  type LostSoulSuitCount,
  type RiverfolkBoardViewModel,
  type RiverfolkServiceId,
} from '#ui/expansionBoardViewModel.ts'
import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'

/** An empty pile shows the printed Lost Souls art; a card covers it otherwise. */
const LOST_SOULS_PILE_CLASS_NAME =
  'pointer-events-auto absolute z-2 cursor-root-pointer hover:brightness-110'
/** Fills the whole frame (a button gives no height to percentages). */
const LOST_SOULS_TOP_CARD_CLASS_NAME =
  'pointer-events-none absolute inset-0 block size-full rounded-[5%] object-fill select-none'
/** Suit chips sit astride the top edge of the card, like tabs. */
const LOST_SOULS_SUIT_STRIP_CLASS_NAME =
  'absolute inset-x-[10%] top-0 z-1 flex -translate-y-1/2 flex-row items-center justify-between font-mono text-[clamp(10px,2vh,14px)]'
const LOST_SOULS_SUIT_CLASS_NAME =
  'flex flex-row items-center gap-0.5 rounded px-1 py-0.5'
const LOST_SOULS_SUIT_TRAILING_CLASS_NAME = 'bg-parchment/93 text-ink-deep'
/** Rule: 10.4.1 — the suit that would become the Outcast. */
const LOST_SOULS_SUIT_LEADING_CLASS_NAME =
  'bg-gold font-bold text-ink-deep ring-2 ring-ink-deep'
const FUND_BOX_CLASS_NAME = 'absolute z-2'
const FUND_WARRIORS_CLASS_NAME =
  'flex size-full flex-wrap content-start items-start gap-0.5 overflow-hidden p-1'
const FUND_WARRIOR_CLASS_NAME = 'block h-[30%] max-h-10 w-auto select-none'
/** Sits astride the top-right corner of the box, taking no room inside it. */
const FUND_COUNT_CLASS_NAME =
  'absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 bg-parchment/93 px-1 font-mono text-[clamp(10px,1.8vh,13px)] leading-tight text-ink-deep'
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
    <>
      <FitToken
        region={region}
        layout={props.layout}
        imagePath={imagePath}
        alt={props.view.hated ? 'Hated Outcast' : 'Outcast'}
      />
      {IS_BIRTHDAY_EDITION ? (
        <TokenBow style={layoutRegionStyle(region, props.layout)} suit={null} />
      ) : null}
    </>
  )
}

/** Birthday edition: a bow in the suit's colour on every garden left on its track. */
function GardenTrackBows(
  props: LayoutProps & { suit: BoardSuit; gardensOnTrack: number },
): JSX.Element {
  const emptiedCount: number = LIZARD_GARDEN_TRACK_SLOT_COUNT - props.gardensOnTrack
  const bows: JSX.Element[] = []
  for (let cellIndex = emptiedCount; cellIndex < LIZARD_GARDEN_TRACK_SLOT_COUNT; cellIndex += 1) {
    const region = trackCellRegion(props.layout, `garden-${props.suit}`, cellIndex)
    if (region !== null) {
      bows.push(
        <TokenBow
          key={`garden-bow-${props.suit}-${String(cellIndex)}`}
          style={layoutRegionStyle(region, props.layout)}
          suit={props.suit}
        />,
      )
    }
  }
  return <>{bows}</>
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
      <span className={LOST_SOULS_SUIT_STRIP_CLASS_NAME}>
        {props.view.lostSoulSuits.map((entry: LostSoulSuitCount) => {
          const suitKey: string | null = suitTextureKey(entry.suit)
          return (
            <span
              key={entry.suit}
              className={`${LOST_SOULS_SUIT_CLASS_NAME} ${
                entry.mostCommon
                  ? LOST_SOULS_SUIT_LEADING_CLASS_NAME
                  : LOST_SOULS_SUIT_TRAILING_CLASS_NAME
              }`}
              title={`${entry.suit}: ${String(entry.count)}`}
            >
              {suitKey !== null ? (
                <SuitIcon
                  suit={entry.suit}
                  className="block h-[1.4em] w-auto select-none"
                  alt={entry.suit}
                />
              ) : (
                entry.suit
              )}
              {String(entry.count)}
            </span>
          )
        })}
      </span>
      {topCardImagePath !== null ? (
        <img
          className={LOST_SOULS_TOP_CARD_CLASS_NAME}
          src={topCardImagePath}
          alt=""
          draggable={false}
        />
      ) : null}
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
      {IS_BIRTHDAY_EDITION
        ? BOARD_SUITS.map((suit: BoardSuit) => (
            <GardenTrackBows
              key={`garden-bows-${suit}`}
              layout={props.layout}
              suit={suit}
              gardensOnTrack={props.view.gardensOnTrack[suit]}
            />
          ))
        : null}
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
      <div className={FUND_WARRIORS_CLASS_NAME}>
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
      </div>
      <span
        className={FUND_COUNT_CLASS_NAME}
        title={`${props.label}: ${String(props.factions.length)}`}
      >
        {String(props.factions.length)}
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
