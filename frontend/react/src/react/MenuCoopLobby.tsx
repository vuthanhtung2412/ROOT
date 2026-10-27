import { useRef, useState, type JSX } from 'react'
import { isBotFaction, type BotFactionId } from '@root/lib/bot-factions'
import type { BotDifficulty, BotTrait, VagabotCharacter } from '@root/lib/bot-settings'
import type { PlayMode } from '#api/client.ts'
import { IS_BIRTHDAY_EDITION } from '#game/birthdayEdition.ts'
import {
  defaultBotSettingsChoices,
  withBotDifficulty,
  withBotTraitToggled,
  withVagabotCharacter,
  type BotSettingsChoices,
} from '#game/botSettingsMenu.ts'
import type {
  LobbyTableChange,
  MenuFactionChoice,
  MenuLobbyHudState,
  MenuLobbySeat,
} from '#game/hudStore.ts'
import { PLAY_MODE_LABELS } from '#game/menuLobby.ts'
import { MenuBotSettingsModal } from '#react/MenuBotSettingsModal.tsx'
import { LobbyFactionDock } from '#react/MenuLobbyFactionDock.tsx'
import {
  LobbyEmptySeatTile,
  LobbyOpenSeatTile,
  LobbySeatTile,
  type LobbySide,
} from '#react/MenuLobbySeats.tsx'
import { SoloAddBotTile, SoloBotTile } from '#react/MenuSoloSeats.tsx'
import { PartyMedallion } from '#react/PartyMedallion.tsx'
import { useFitHeightZoom } from '#react/useFitHeightZoom.ts'
import { VersusMedallion } from '#react/VersusMedallion.tsx'

/** The lobby creator joins first, so the host always holds seat 0. */
const HOST_SEAT_INDEX = 0
/** Co-op VS cloud is a step bigger than the solo one. */
const COOP_MEDALLION_SIZE_CLASS_NAME = 'w-28 md:w-52'
const NO_SEAT_INDEX = -1
const PLAY_MODES: readonly PlayMode[] = ['freeForAll', 'cooperative']
/** Pill under the lobby title: one paper tab per mode, the active one gold. */
const SWITCH_CLASS_NAME = 'menu-play-mode m-0 flex flex-row gap-1.5 border-0 p-0'
const SWITCH_BUTTON_CLASS_NAME =
  'menu-play-mode-option root-paper root-paper-fine root-paper-press m-0 min-h-10 px-4 py-1 font-display text-lg text-ink disabled:cursor-root-not-allowed'
const SWITCH_ACTIVE_PAPER_CLASS_NAME = 'shadow-gold-ring-wide [--root-paper-color:var(--color-gold)]'
const SWITCH_IDLE_PAPER_CLASS_NAME = '[--root-paper-color:var(--color-parchment-deep)]'
const SWITCH_LOCKED_CLASS_NAME = 'opacity-70'
/** Woodland 2x2 | VS | Clockwork 2x2 side by side at every width. */
const TABLE_CLASS_NAME =
  'grid w-full grid-cols-[1fr_auto_1fr] items-start justify-items-center gap-2 py-8 md:gap-12 md:py-16'
const SIDE_CLASS_NAME = 'flex flex-col items-center gap-3'
const SEAT_GRID_CLASS_NAME = 'm-0 grid list-none grid-cols-2 items-start justify-items-center gap-x-8 gap-y-5 p-0'
const TABLE_FULL_NOTE_CLASS_NAME = 'm-0 max-w-44 text-center font-body text-sm text-ink-soft italic'
/** The whole menu screen: the co-op lobby shrinks to fit its height. */
const MENU_FRAME_SELECTOR = '.menu-overlay'
/** The four Rootbotics bots in one row. */
const BOT_PICKER_COLUMNS_CLASS_NAME = 'grid-cols-4'

/** Each side is always a full 2x2 grid; unused slots stay empty. */
const SIDE_SLOT_COUNT = 4

type IndexedSeat = { seat: MenuLobbySeat; seatIndex: number }

/** Inert slots that pad one side up to its 2x2 grid. */
function emptySlots(props: { side: LobbySide; usedSlotCount: number }): JSX.Element[] {
  const emptySlotCount: number = Math.max(SIDE_SLOT_COUNT - props.usedSlotCount, 0)
  return Array.from(
    { length: emptySlotCount },
    (_: undefined, emptyIndex: number): JSX.Element => {
      const slotIndex: number = props.usedSlotCount + emptyIndex
      return (
        <LobbyEmptySeatTile
          key={`${props.side}-empty-${String(slotIndex)}`}
          slotIndex={slotIndex}
          side={props.side}
        />
      )
    },
  )
}

/** Host: Free-for-all | Co-op vs bots. Guests see the same pill, locked. */
export function LobbyPlayModeSwitch(props: {
  playMode: PlayMode
  isHost: boolean
  disabled: boolean
  onChange: (change: LobbyTableChange) => void
}): JSX.Element {
  return (
    <fieldset className={SWITCH_CLASS_NAME} disabled={props.disabled || !props.isHost}>
      <legend className="sr-only">Play mode</legend>
      {PLAY_MODES.map((playMode: PlayMode): JSX.Element => {
        const isActive: boolean = playMode === props.playMode
        return (
          <button
            key={playMode}
            type="button"
            className={`${SWITCH_BUTTON_CLASS_NAME} ${
              isActive ? SWITCH_ACTIVE_PAPER_CLASS_NAME : SWITCH_IDLE_PAPER_CLASS_NAME
            } ${props.isHost ? '' : SWITCH_LOCKED_CLASS_NAME}`}
            aria-pressed={isActive}
            data-play-mode={playMode}
            title={props.isHost ? undefined : 'The host picks the play mode'}
            onClick={(): void => {
              if (!isActive) props.onChange({ kind: 'setPlayMode', playMode })
            }}
          >
            {PLAY_MODE_LABELS[playMode]}
          </button>
        )
      })}
    </fieldset>
  )
}

function indexedSeats(seats: readonly MenuLobbySeat[]): IndexedSeat[] {
  return seats.map((seat: MenuLobbySeat, seatIndex: number): IndexedSeat => ({ seat, seatIndex }))
}

function isBotFactionId(faction: string): faction is BotFactionId {
  return isBotFaction(faction)
}

/**
 * Co-op vs bots (Rootbotics 3.5.1): the Woodland (humans) against the
 * Clockwork (bots). One open seat trails the humans while seats remain.
 */
export function MenuCoopLobby(props: {
  lobby: MenuLobbyHudState
  playPending: boolean
  onPickFaction: (faction: string) => void
  onExpelPlayer: (seat: number) => void
  onChangeLobbyTable: (change: LobbyTableChange) => void
  /** Title and mode switch, shrunk with the table to fit the screen. */
  header: JSX.Element
  /** Close / Start and the start reason. */
  footer: JSX.Element
}): JSX.Element {
  const lobby: MenuLobbyHudState = props.lobby
  const sectionRef = useRef<HTMLElement | null>(null)
  const zoom: number = useFitHeightZoom({
    contentRef: sectionRef,
    frameSelector: MENU_FRAME_SELECTOR,
  })
  const seats: IndexedSeat[] = indexedSeats(lobby.seats)
  const humans: IndexedSeat[] = seats.filter(
    (indexed: IndexedSeat): boolean => !isBotFaction(indexed.seat.faction),
  )
  const bots: IndexedSeat[] = seats.filter((indexed: IndexedSeat): boolean =>
    isBotFaction(indexed.seat.faction),
  )
  const settingsByBot: BotSettingsChoices = {
    ...defaultBotSettingsChoices(),
    ...lobby.botSettings,
  }
  const localSeatIndex: number = lobby.seats.findIndex(
    (seat: MenuLobbySeat): boolean => seat.isLocalPlayer,
  )
  const isSeated: boolean = localSeatIndex !== NO_SEAT_INDEX
  const nextSeatIndex: number = lobby.seats.length
  const hasOpenSeat: boolean = lobby.openSeatCount > 0
  const showDock: boolean = isSeated || hasOpenSeat
  const [isPickingBot, setIsPickingBot] = useState<boolean>(false)
  const [settingsOpenBot, setSettingsOpenBot] = useState<BotFactionId | null>(null)
  /** Woodland side clicked: the dock goes back to the woodland factions. */
  function showFactionDock(): void {
    setIsPickingBot(false)
  }
  const canAddBot: boolean =
    lobby.isHost &&
    hasOpenSeat &&
    lobby.botChoices.some((choice: MenuFactionChoice): boolean => choice.takenBy === null)

  return (
    <>
      <section
        ref={sectionRef}
        className="menu-coop m-0 flex w-full flex-shrink-0 flex-col items-center gap-4"
        style={{ zoom }}
        aria-label="Online lobby"
      >
        {props.header}
        <div className={TABLE_CLASS_NAME}>
          <div className={SIDE_CLASS_NAME}>
            <ol className={SEAT_GRID_CLASS_NAME}>
              {humans.map(
                (indexed: IndexedSeat): JSX.Element => (
                  <LobbySeatTile
                    key={`coop-seat-${String(indexed.seatIndex)}`}
                    seat={indexed.seat}
                    seatIndex={indexed.seatIndex}
                    isSelected={indexed.seat.isLocalPlayer && !isPickingBot}
                    onSelect={indexed.seat.isLocalPlayer ? showFactionDock : null}
                    onExpel={
                      lobby.isHost &&
                      !indexed.seat.isLocalPlayer &&
                      indexed.seatIndex !== HOST_SEAT_INDEX &&
                      !props.playPending
                        ? (): void => {
                            props.onExpelPlayer(indexed.seatIndex)
                          }
                        : null
                    }
                  />
                ),
              )}
              {hasOpenSeat ? (
                <LobbyOpenSeatTile
                  seatIndex={nextSeatIndex}
                  kind={isSeated ? 'waiting' : 'local'}
                  isSelected={!isSeated && !isPickingBot}
                  onSelect={showFactionDock}
                />
              ) : null}
              {emptySlots({ side: 'human', usedSlotCount: humans.length + (hasOpenSeat ? 1 : 0) })}
            </ol>
          </div>
          {IS_BIRTHDAY_EDITION ? (
            <PartyMedallion sizeClassName={COOP_MEDALLION_SIZE_CLASS_NAME} />
          ) : (
            <VersusMedallion sizeClassName={COOP_MEDALLION_SIZE_CLASS_NAME} />
          )}
          <div className={SIDE_CLASS_NAME}>
            <ul className={SEAT_GRID_CLASS_NAME}>
              {bots.map(
                (indexed: IndexedSeat, botIndex: number): JSX.Element | null => {
                  const faction: string = indexed.seat.faction
                  if (!isBotFactionId(faction)) return null
                  return (
                    <SoloBotTile
                      key={faction}
                      faction={faction}
                      botIndex={botIndex}
                      seatNumber={indexed.seatIndex + 1}
                      settings={settingsByBot[faction]}
                      isSelected={settingsOpenBot === faction}
                      disabled={props.playPending}
                      onSelect={(): void => {
                        setSettingsOpenBot(faction)
                      }}
                      onRemove={
                        lobby.isHost
                          ? (): void => {
                              props.onExpelPlayer(indexed.seatIndex)
                            }
                          : null
                      }
                      isSettingsOpen={settingsOpenBot === faction}
                      tileSize="lobbySeat"
                      onToggleSettings={(): void => {
                        setSettingsOpenBot(settingsOpenBot === faction ? null : faction)
                      }}
                    />
                  )
                },
              )}
              {canAddBot ? (
                <SoloAddBotTile
                  tileSize="lobbySeat"
                  isSelected={isPickingBot}
                  disabled={props.playPending}
                  onSelect={(): void => {
                    setIsPickingBot(!isPickingBot)
                  }}
                />
              ) : null}
              {emptySlots({ side: 'bot', usedSlotCount: bots.length + (canAddBot ? 1 : 0) })}
            </ul>
            {!hasOpenSeat && bots.length === 0 ? (
              <p className={TABLE_FULL_NOTE_CLASS_NAME}>Table full — free a seat to add a bot.</p>
            ) : null}
          </div>
        </div>
        {isPickingBot && canAddBot ? (
          <LobbyFactionDock
            choices={lobby.botChoices}
            mode="own"
            seatIndex={nextSeatIndex}
            isSeated={false}
            disabled={props.playPending}
            modelPicker={null}
            tabLabel={`Seat ${String(nextSeatIndex + 1)} · pick a bot`}
            columnsClassName={BOT_PICKER_COLUMNS_CLASS_NAME}
            onPick={(faction: string): void => {
              if (!isBotFactionId(faction)) return
              props.onChangeLobbyTable({ kind: 'addBot', faction })
              setIsPickingBot(false)
            }}
          />
        ) : showDock ? (
          <LobbyFactionDock
            choices={lobby.factionChoices}
            mode="own"
            seatIndex={isSeated ? localSeatIndex : nextSeatIndex}
            isSeated={isSeated}
            disabled={props.playPending}
            modelPicker={null}
            onPick={props.onPickFaction}
          />
        ) : null}
        {props.footer}
      </section>
      {settingsOpenBot !== null ? (
        <MenuBotSettingsModal
          faction={settingsOpenBot}
          settings={settingsByBot[settingsOpenBot]}
          isReadOnly={!lobby.isHost}
          onDifficultyChange={(difficulty: BotDifficulty): void => {
            const choices = withBotDifficulty(settingsByBot, { faction: settingsOpenBot, difficulty })
            props.onChangeLobbyTable({
              kind: 'setBotSettings',
              faction: settingsOpenBot,
              settings: choices[settingsOpenBot],
            })
          }}
          onTraitToggle={(trait: BotTrait): void => {
            const choices = withBotTraitToggled(settingsByBot, { faction: settingsOpenBot, trait })
            props.onChangeLobbyTable({
              kind: 'setBotSettings',
              faction: settingsOpenBot,
              settings: choices[settingsOpenBot],
            })
          }}
          onCharacterChange={(character: VagabotCharacter): void => {
            const choices = withVagabotCharacter(settingsByBot, character)
            props.onChangeLobbyTable({
              kind: 'setBotSettings',
              faction: settingsOpenBot,
              settings: choices[settingsOpenBot],
            })
          }}
          onClose={(): void => {
            setSettingsOpenBot(null)
          }}
        />
      ) : null}
    </>
  )
}
