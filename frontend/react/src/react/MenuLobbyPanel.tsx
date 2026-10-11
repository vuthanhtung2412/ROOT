import type { JSX } from 'react'
import type {
  MenuFactionChoice,
  MenuLobbyHudState,
  MenuLobbySeat,
} from '#game/hudStore.ts'
import { factionDisplayName, isMenuFactionId } from '#game/menuPartySetup.ts'
import { factionColorCss } from '#game/theme.ts'
import {
  FactionBadge,
  PRIMARY_BUTTON_CLASS_NAME,
  SEAT_ROW_CLASS_NAME,
  SECONDARY_BUTTON_CLASS_NAME,
  SECTION_TITLE_CLASS_NAME,
} from '#react/MenuParts.tsx'

/** One faction of the picker: badge, name, and who holds it. */
const FACTION_CHOICE_CLASS_NAME =
  'menu-faction-choice root-button root-button--quiet flex flex-row items-center gap-2 px-3 py-2 text-left font-body text-base'
const PICKED_FACTION_CHOICE_CLASS_NAME =
  'menu-faction-choice menu-faction-choice--picked root-button root-button--accent flex flex-row items-center gap-2 px-3 py-2 text-left font-body text-base'
const TAKEN_BY_OTHER_NOTE = 'taken'
const PICKED_NOTE = 'your pick'

function factionName(factionId: string): string {
  return isMenuFactionId(factionId) ? factionDisplayName(factionId) : factionId
}

function lobbySeatStatus(seat: MenuLobbySeat): string {
  if (seat.isLocalPlayer) return 'you'
  return seat.occupied ? 'joined' : 'waiting…'
}

function choiceNote(choice: MenuFactionChoice): string | null {
  if (choice.takenBy === 'you') return PICKED_NOTE
  return choice.takenBy === 'other' ? TAKEN_BY_OTHER_NOTE : null
}

/** Open lobby: pick a faction nobody else holds; picking again changes it. */
function FactionPicker(props: {
  choices: readonly MenuFactionChoice[]
  disabled: boolean
  onPick: (faction: string) => void
}): JSX.Element {
  return (
    <fieldset
      className="m-0 flex w-full flex-col gap-2 border-0 p-0"
      disabled={props.disabled}
    >
      <legend className={`mb-1 ${SECTION_TITLE_CLASS_NAME}`}>
        Choose your faction
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {props.choices.map((choice: MenuFactionChoice): JSX.Element => {
          const note: string | null = choiceNote(choice)
          return (
            <button
              key={choice.faction}
              type="button"
              className={
                choice.takenBy === 'you'
                  ? PICKED_FACTION_CHOICE_CLASS_NAME
                  : FACTION_CHOICE_CLASS_NAME
              }
              aria-pressed={choice.takenBy === 'you'}
              disabled={choice.takenBy === 'other'}
              data-faction={choice.faction}
              onClick={(): void => {
                props.onPick(choice.faction)
              }}
            >
              <FactionBadge factionId={choice.faction} />
              <span className="flex min-w-0 flex-col">
                <span>{factionName(choice.faction)}</span>
                {note !== null ? (
                  <span className="text-sm italic opacity-80">{note}</span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Online lobby: who sits where, the faction picker, the host's Start button. */
export function OnlineLobbyPanel(props: {
  lobby: MenuLobbyHudState
  playPending: boolean
  onPickFaction: (faction: string) => void
  onStart: () => void
  onLeave: () => void
}): JSX.Element {
  const isOpenLobby: boolean = props.lobby.factionChoices.length > 0
  return (
    <section className="m-0 flex w-full flex-col gap-2" aria-label="Online lobby">
      <h2 className={SECTION_TITLE_CLASS_NAME}>Online lobby</h2>
      {props.lobby.seats.length === 0 ? (
        <p className="m-0 font-body text-[15px] text-ink-soft italic">
          Nobody has picked a faction yet.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {props.lobby.seats.map(
            (seat: MenuLobbySeat, seatIndex: number): JSX.Element => (
              <li
                key={`lobby-seat-${String(seatIndex)}`}
                className={`menu-seat ${SEAT_ROW_CLASS_NAME} justify-between gap-3 font-body text-base text-ink`}
                style={{ borderLeftColor: factionColorCss(seat.faction) }}
              >
                <span className="flex flex-row items-center gap-3">
                  <FactionBadge factionId={seat.faction} />
                  Seat {seatIndex + 1} · {factionName(seat.faction)}
                </span>
                <span className="text-sm text-ink-soft italic">
                  {lobbySeatStatus(seat)}
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      {isOpenLobby ? (
        <FactionPicker
          choices={props.lobby.factionChoices}
          disabled={props.playPending}
          onPick={props.onPickFaction}
        />
      ) : null}
      {props.lobby.isHost ? (
        <button
          type="button"
          className={`${PRIMARY_BUTTON_CLASS_NAME} self-center`}
          disabled={props.playPending || !props.lobby.canStart}
          title={props.lobby.canStart ? undefined : 'Needs at least two players'}
          onClick={props.onStart}
        >
          Start game
        </button>
      ) : (
        <p className="m-0 text-center font-body text-[15px] text-ink-soft italic">
          Waiting for the host to start…
        </p>
      )}
      <button
        type="button"
        className={`${SECONDARY_BUTTON_CLASS_NAME} self-center`}
        disabled={props.playPending}
        title={
          props.lobby.isHost
            ? 'Remove this lobby for everyone'
            : 'Go back to the menu'
        }
        onClick={props.onLeave}
      >
        {props.lobby.isHost ? 'Close lobby' : 'Leave lobby'}
      </button>
    </section>
  )
}
