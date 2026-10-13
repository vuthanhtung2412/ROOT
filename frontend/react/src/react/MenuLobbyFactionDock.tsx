import type { JSX } from 'react'
import { factionPortraitPath } from '#assets/factionPortraits.ts'
import { modelDisplayName } from '#game/aiPlayerStore.ts'
import type { MenuFactionChoice } from '#game/hudStore.ts'
import { factionDisplayName, isMenuFactionId } from '#game/menuPartySetup.ts'
import { factionTintCss } from '#react/MenuLobbySeats.tsx'

/** `own`: this browser picks its faction. `ai`: the host seats an AI player. */
export type LobbyDockMode = 'own' | 'ai'

/** Frame holding the six factions, like the action dock of a turn. */
const DOCK_FRAME_CLASS_NAME =
  'menu-faction-dock root-paper relative mt-9 box-border p-3 [--root-paper-color:var(--color-cream-deep)] md:p-3.5'
/** Tabs above the frame: the seat being filled on the left, AI model on the right. */
const TAB_ROW_CLASS_NAME =
  'absolute right-3 bottom-full left-3 flex flex-row flex-wrap items-end justify-between gap-2'
const SEAT_TAB_CLASS_NAME =
  'root-paper root-paper-fine px-3 py-0.5 font-display text-[17px] whitespace-nowrap text-ink [--root-paper-color:var(--color-gold)] md:text-lg'
const MODEL_TAB_CLASS_NAME =
  'menu-ai-player root-paper root-paper-fine flex flex-row items-center gap-2 px-2.5 py-0.5 font-display text-base whitespace-nowrap text-ink [--root-paper-color:var(--color-parchment)]'
const MODEL_SELECT_CLASS_NAME =
  'menu-ai-player-model min-h-8 border-0 bg-transparent font-body text-[15px] text-ink'
const FACTION_GRID_CLASS_NAME =
  'm-0 grid grid-cols-3 gap-x-2.5 gap-y-2 border-0 p-0 md:grid-cols-6 md:gap-3'
/** One faction: head tile with the name under it. */
const FACTION_BUTTON_CLASS_NAME =
  'menu-faction-choice m-0 flex w-22 cursor-root-pointer flex-col items-center gap-1 border-0 bg-transparent p-0 text-center font-body text-[13px] leading-tight text-ink disabled:cursor-root-not-allowed md:w-26 md:text-sm'
const PICKED_FACTION_HOOK_CLASS_NAME = 'menu-faction-choice--picked'
const HEAD_TILE_CLASS_NAME =
  'root-paper root-paper-fine relative box-border block size-21 p-1.5 md:size-23'
const HEAD_TILE_FREE_CLASS_NAME = '[--root-paper-color:var(--color-cream)]'
const HEAD_TILE_PICKED_CLASS_NAME =
  'shadow-gold-ring-wide [--root-paper-color:var(--color-gold)]'
const HEAD_TILE_TAKEN_CLASS_NAME =
  '[--root-paper-color:var(--color-parchment-shadow)]'
const HEAD_PORTRAIT_CLASS_NAME = 'block size-full object-cover select-none'
const TAKEN_PORTRAIT_CLASS_NAME = 'opacity-35'

function factionName(factionId: string): string {
  return isMenuFactionId(factionId) ? factionDisplayName(factionId) : factionId
}

function seatTabLabel(mode: LobbyDockMode, seatIndex: number, isSeated: boolean): string {
  const seat = `Seat ${String(seatIndex + 1)}`
  if (mode === 'ai') return `${seat} · seat an AI`
  return isSeated ? `${seat} · change your faction` : `${seat} · pick your faction`
}

/** AI model of the seat being filled; shown only while seating an AI. */
export type LobbyDockModelPicker = {
  models: readonly string[]
  model: string
  onPickModel: (model: string) => void
}

/**
 * Open lobby: the six factions, acting for the seat the tab names. Picking a
 * free one takes it for this browser (`own`) or seats an AI on it (`ai`).
 */
export function LobbyFactionDock(props: {
  choices: readonly MenuFactionChoice[]
  mode: LobbyDockMode
  /** Seat the pick goes to. */
  seatIndex: number
  /** `own`: this browser already holds that seat. */
  isSeated: boolean
  disabled: boolean
  /** Non-null in `ai` mode. */
  modelPicker: LobbyDockModelPicker | null
  onPick: (faction: string) => void
}): JSX.Element {
  const modelPicker: LobbyDockModelPicker | null = props.modelPicker
  return (
    <div className={DOCK_FRAME_CLASS_NAME}>
      <div className={TAB_ROW_CLASS_NAME}>
        <span className={SEAT_TAB_CLASS_NAME}>
          {seatTabLabel(props.mode, props.seatIndex, props.isSeated)}
        </span>
        {modelPicker !== null ? (
          <label className={MODEL_TAB_CLASS_NAME}>
            AI model
            <select
              className={MODEL_SELECT_CLASS_NAME}
              value={modelPicker.model}
              onChange={(event): void => {
                modelPicker.onPickModel(event.target.value)
              }}
            >
              {modelPicker.models.map(
                (offeredModel: string): JSX.Element => (
                  <option key={offeredModel} value={offeredModel}>
                    {modelDisplayName(offeredModel)}
                  </option>
                ),
              )}
            </select>
          </label>
        ) : null}
      </div>
      <fieldset className={FACTION_GRID_CLASS_NAME} disabled={props.disabled}>
        <legend className="sr-only">Choose a faction</legend>
        {props.choices.map((choice: MenuFactionChoice): JSX.Element => {
          const isPicked: boolean = props.mode === 'own' && choice.takenBy === 'you'
          const isTaken: boolean = choice.takenBy !== null && !isPicked
          const portraitPath: string | null = factionPortraitPath(choice.faction)
          const tileStateClassName: string = isPicked
            ? HEAD_TILE_PICKED_CLASS_NAME
            : isTaken
              ? HEAD_TILE_TAKEN_CLASS_NAME
              : HEAD_TILE_FREE_CLASS_NAME
          return (
            <button
              key={choice.faction}
              type="button"
              className={
                isPicked
                  ? `${FACTION_BUTTON_CLASS_NAME} ${PICKED_FACTION_HOOK_CLASS_NAME}`
                  : FACTION_BUTTON_CLASS_NAME
              }
              aria-pressed={isPicked}
              disabled={isTaken}
              data-faction={choice.faction}
              onClick={(): void => {
                props.onPick(choice.faction)
              }}
            >
              <span className={`${HEAD_TILE_CLASS_NAME} ${tileStateClassName}`}>
                {portraitPath !== null ? (
                  <img
                    className={
                      isTaken
                        ? `${HEAD_PORTRAIT_CLASS_NAME} ${TAKEN_PORTRAIT_CLASS_NAME}`
                        : HEAD_PORTRAIT_CLASS_NAME
                    }
                    style={{ backgroundColor: factionTintCss(choice.faction) }}
                    src={portraitPath}
                    alt=""
                    draggable={false}
                  />
                ) : null}
              </span>
              <span>{factionName(choice.faction)}</span>
            </button>
          )
        })}
      </fieldset>
    </div>
  )
}
