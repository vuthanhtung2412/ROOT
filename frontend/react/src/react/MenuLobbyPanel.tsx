import { useState, useSyncExternalStore, type JSX } from 'react'
import type { AddAiPlayerInput } from '#api/client.ts'
import {
  getAiPlayerSnapshot,
  subscribeAiPlayers,
  type AiPlayerStoreState,
} from '#game/aiPlayerStore.ts'
import type {
  MenuFactionChoice,
  MenuLobbyHudState,
  MenuLobbySeat,
} from '#game/hudStore.ts'
import { MenuAiPlayerForm } from '#react/MenuAiPlayerForm.tsx'
import {
  LobbyFactionDock,
  type LobbyDockMode,
} from '#react/MenuLobbyFactionDock.tsx'
import {
  LobbyOpenSeatTile,
  LobbySeatTile,
  type LobbyOpenSeatKind,
} from '#react/MenuLobbySeats.tsx'
import {
  CANCEL_BUTTON_CLASS_NAME,
  LOBBY_FOOTER_CLASS_NAME,
  LOBBY_TITLE_CLASS_NAME,
  PAPER_SHEET_CLASS_NAME,
  PRIMARY_BUTTON_CLASS_NAME,
} from '#react/MenuParts.tsx'

/** The lobby creator joins first, so the host always holds seat 0. */
const HOST_SEAT_INDEX = 0
const NO_SEAT_INDEX = -1
const SEAT_ROW_CLASS_NAME =
  'm-0 grid list-none grid-cols-2 gap-x-7 gap-y-4 p-0 md:flex md:flex-row md:items-start md:gap-11'
const LEAVE_BUTTON_CLASS_NAME = `menu-leave-lobby ${CANCEL_BUTTON_CLASS_NAME}`
const START_BUTTON_CLASS_NAME = `menu-start-online ${PRIMARY_BUTTON_CLASS_NAME}`

/** Seats nobody took yet, numbered after the taken ones. */
function openSeatIndexes(lobby: MenuLobbyHudState): number[] {
  return Array.from(
    { length: lobby.openSeatCount },
    (_empty: unknown, offset: number): number => lobby.seats.length + offset,
  )
}

/**
 * Online lobby: one portrait tile per seat, the faction dock acting for the
 * seat that is being filled, then the host's Start (or the guest's Leave).
 */
export function OnlineLobbyPanel(props: {
  lobby: MenuLobbyHudState
  playPending: boolean
  onPickFaction: (faction: string) => void
  onAddAiPlayer: (input: AddAiPlayerInput) => void
  onExpelPlayer: (seat: number) => void
  onStart: () => void
  onLeave: () => void
}): JSX.Element {
  const lobby: MenuLobbyHudState = props.lobby
  const aiPlayerStore: AiPlayerStoreState = useSyncExternalStore(
    subscribeAiPlayers,
    getAiPlayerSnapshot,
    getAiPlayerSnapshot,
  )
  const [isSeatingAi, setIsSeatingAi] = useState<boolean>(false)
  const [pickedModel, setPickedModel] = useState<string | null>(null)

  const isOpenLobby: boolean = lobby.factionChoices.length > 0
  const localSeatIndex: number = lobby.seats.findIndex(
    (seat: MenuLobbySeat): boolean => seat.isLocalPlayer,
  )
  const isSeated: boolean = localSeatIndex !== NO_SEAT_INDEX
  const nextOpenSeatIndex: number = lobby.seats.length
  const hasOpenSeat: boolean = lobby.openSeatCount > 0
  const hasFreeFaction: boolean = lobby.factionChoices.some(
    (choice: MenuFactionChoice): boolean => choice.takenBy === null,
  )
  const model: string | null =
    pickedModel !== null && aiPlayerStore.models.includes(pickedModel)
      ? pickedModel
      : (aiPlayerStore.defaultModel ?? aiPlayerStore.models[0] ?? null)
  const canSeatAi: boolean =
    isOpenLobby && lobby.isHost && hasOpenSeat && hasFreeFaction && model !== null
  const dockMode: LobbyDockMode = isSeatingAi && canSeatAi ? 'ai' : 'own'
  // A browser that only watches a full lobby has no seat to pick for.
  const showDock: boolean = isOpenLobby && (isSeated || hasOpenSeat)
  const takenSeatCount: number = lobby.seats.filter(
    (seat: MenuLobbySeat): boolean => seat.occupied,
  ).length
  const tableSeatCount: number = lobby.seats.length + lobby.openSeatCount

  function openSeatKind(seatIndex: number): LobbyOpenSeatKind {
    if (seatIndex !== nextOpenSeatIndex) return 'waiting'
    if (!isSeated) return 'local'
    return canSeatAi ? 'ai' : 'waiting'
  }

  function isOpenSeatSelected(kind: LobbyOpenSeatKind): boolean {
    if (kind === 'local') return dockMode === 'own'
    return kind === 'ai' && dockMode === 'ai'
  }

  function pickInDock(faction: string): void {
    if (dockMode === 'ai' && model !== null) {
      props.onAddAiPlayer({ model, faction })
      setIsSeatingAi(false)
      return
    }
    props.onPickFaction(faction)
  }

  return (
    <section
      className="m-0 flex w-full flex-col items-center gap-6"
      aria-label="Online lobby"
    >
      <h2 className={LOBBY_TITLE_CLASS_NAME}>
        Online lobby · {takenSeatCount} of {tableSeatCount} seats
      </h2>
      <ol className={SEAT_ROW_CLASS_NAME}>
        {lobby.seats.map(
          (seat: MenuLobbySeat, seatIndex: number): JSX.Element => {
            const isOwnSeat: boolean = isOpenLobby && seat.isLocalPlayer
            const canExpel: boolean =
              isOpenLobby &&
              lobby.isHost &&
              seat.occupied &&
              !seat.isLocalPlayer &&
              seatIndex !== HOST_SEAT_INDEX
            return (
              <LobbySeatTile
                key={`lobby-seat-${String(seatIndex)}`}
                seat={seat}
                seatIndex={seatIndex}
                isSelected={isOwnSeat && dockMode === 'own'}
                onSelect={
                  isOwnSeat
                    ? (): void => {
                        setIsSeatingAi(false)
                      }
                    : null
                }
                onExpel={
                  canExpel && !props.playPending
                    ? (): void => {
                        props.onExpelPlayer(seatIndex)
                      }
                    : null
                }
              />
            )
          },
        )}
        {openSeatIndexes(lobby).map((seatIndex: number): JSX.Element => {
          const kind: LobbyOpenSeatKind = openSeatKind(seatIndex)
          return (
            <LobbyOpenSeatTile
              key={`lobby-seat-${String(seatIndex)}`}
              seatIndex={seatIndex}
              kind={kind}
              isSelected={isOpenSeatSelected(kind)}
              onSelect={(): void => {
                setIsSeatingAi(true)
              }}
            />
          )
        })}
      </ol>
      {showDock ? (
        <LobbyFactionDock
          choices={lobby.factionChoices}
          mode={dockMode}
          seatIndex={
            dockMode === 'own' && isSeated ? localSeatIndex : nextOpenSeatIndex
          }
          isSeated={isSeated}
          disabled={props.playPending}
          modelPicker={
            dockMode === 'ai' && model !== null
              ? {
                  models: aiPlayerStore.models,
                  model,
                  onPickModel: setPickedModel,
                }
              : null
          }
          onPick={pickInDock}
        />
      ) : null}
      {!isOpenLobby && lobby.isHost && model !== null ? (
        <div className={PAPER_SHEET_CLASS_NAME}>
          <MenuAiPlayerForm
            factionChoices={lobby.factionChoices}
            disabled={props.playPending}
            onAdd={props.onAddAiPlayer}
          />
        </div>
      ) : null}
      <div className={LOBBY_FOOTER_CLASS_NAME}>
        <button
          type="button"
          className={LEAVE_BUTTON_CLASS_NAME}
          disabled={props.playPending}
          title={
            lobby.isHost ? 'Remove this lobby for everyone' : 'Go back to the menu'
          }
          onClick={props.onLeave}
        >
          {lobby.isHost ? 'Close lobby' : 'Leave lobby'}
        </button>
        {lobby.isHost ? (
          <button
            type="button"
            className={START_BUTTON_CLASS_NAME}
            disabled={props.playPending || !lobby.canStart}
            title={lobby.canStart ? undefined : 'Needs at least two players'}
            onClick={props.onStart}
          >
            Start game
          </button>
        ) : null}
      </div>
    </section>
  )
}
