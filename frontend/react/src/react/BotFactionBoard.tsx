import type { JSX } from 'react'
import {
  ELECTRIC_EYRIE_BOARD_LAYOUT,
  MECHANICAL_MARQUISE_BOARD_LAYOUT,
  type BoardBox,
  type BoardSpot,
} from '#assets/botBoardLayout.ts'
import { GAME_ASSET_KEYS } from '#assets/gameAssets.ts'
import {
  BoardArt,
  BoardPiece,
  CraftedItemsStrip,
  boxStyle,
  filledSpaces,
} from '#react/BotBoardPieces.tsx'
import { BotBoardStrip } from '#react/BotBoardStrip.tsx'
import {
  AutomatedAllianceBoardArt,
  VagabotBoardArt,
} from '#react/BotClockworkBoardArt.tsx'
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
const EMPTY_BOX: BoardBox = { left: 0, top: 0, width: 0, height: 0 }

const BUILDING_TOKEN_KEYS: Readonly<Record<string, string>> = {
  sawmill: GAME_ASSET_KEYS.tokenMarquiseSawmill,
  workshop: GAME_ASSET_KEYS.tokenMarquiseWorkshop,
  recruiter: GAME_ASSET_KEYS.tokenMarquiseRecruiter,
}

function MarquiseBoardArt(props: { view: MechanicalMarquiseBoardViewModel }): JSX.Element {
  const layout = MECHANICAL_MARQUISE_BOARD_LAYOUT
  return (
    <BoardArt view={props.view}>
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
    <BoardArt view={props.view}>
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
      {view.kind === 'automatedAlliance' ? <AutomatedAllianceBoardArt view={view} /> : null}
      {view.kind === 'vagabot' ? <VagabotBoardArt view={view} /> : null}
      <BotBoardStrip view={view} />
    </section>
  )
}
