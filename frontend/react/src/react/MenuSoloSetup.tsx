import { useRef, useState, type JSX } from 'react'
import type { BotFactionId } from '@root/lib/bot-factions'
import type {
  BotDifficulty,
  BotSettingsByFaction,
  BotTrait,
  VagabotCharacter,
} from '@root/lib/bot-settings'
import {
  defaultBotSettingsChoices,
  partyBotSettings,
  withBotDifficulty,
  withBotTraitToggled,
  withVagabotCharacter,
  type BotSettingsChoices,
} from '#game/botSettingsMenu.ts'
import { IS_BIRTHDAY_EDITION } from '#game/birthdayEdition.ts'
import type { MenuFactionId } from '#game/menuPartySetup.ts'
import {
  canAddSoloBot,
  canRemoveSoloBot,
  defaultSoloTable,
  soloPartyFactions,
  soloTrackChoices,
  withSoloBotRemoved,
  withSoloFactionPicked,
  withSoloSlotSelected,
  type SoloSlot,
  type SoloTable,
} from '#game/soloTableSetup.ts'
import {
  BIRTHDAY_START_LABEL,
  BIRTHDAY_START_PAPER_CLASS_NAME,
  BIRTHDAY_TABLE_TITLE,
  BirthdayCandle,
  GUEST_COUNT_CLASS_NAME,
} from '#react/BirthdayDecorations.tsx'
import { MenuBotSettingsModal } from '#react/MenuBotSettingsModal.tsx'
import { LobbyFactionDock, SIX_FACTION_COLUMNS_CLASS_NAME } from '#react/MenuLobbyFactionDock.tsx'
import {
  CANCEL_BUTTON_CLASS_NAME,
  LOBBY_FOOTER_CLASS_NAME,
  LOBBY_TITLE_CLASS_NAME,
  PRIMARY_BUTTON_CLASS_NAME,
} from '#react/MenuParts.tsx'
import { SoloAddBotTile, SoloBotTile, SoloPlayerTile } from '#react/MenuSoloSeats.tsx'
import { PartyMedallion } from '#react/PartyMedallion.tsx'
import { useFitHeightZoom } from '#react/useFitHeightZoom.ts'
import { VersusMedallion } from '#react/VersusMedallion.tsx'

/** Player | VS | Bots side by side at every width: stacking would not fit the height. */
const TABLE_CLASS_NAME =
  'grid w-full grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-2 md:gap-12'
const SIDE_CLASS_NAME = 'flex flex-col items-center gap-3'
const SIDE_HEADING_CLASS_NAME =
  'root-paper root-paper-fine m-0 px-5 py-0.5 font-display text-2xl tracking-display text-ink [--root-paper-color:var(--color-parchment)] md:text-3xl'
/** Bots in a 2x2 grid, like the co-op table. */
const BOT_LIST_CLASS_NAME = 'm-0 grid list-none grid-cols-2 items-start justify-items-center gap-5 p-0'
/** The four bots in one row; the player track keeps the dock's six columns. */
const BOT_TRACK_COLUMNS_CLASS_NAME = 'grid-cols-4'
const TRACK_SEAT_INDEX = 0
/** Birthday edition: start is the cake, frosting pink with a lit candle. */
const START_BUTTON_CLASS_NAME = `menu-start-solo ${PRIMARY_BUTTON_CLASS_NAME} ${
  IS_BIRTHDAY_EDITION ? BIRTHDAY_START_PAPER_CLASS_NAME : ''
}`
const START_LABEL = IS_BIRTHDAY_EDITION ? BIRTHDAY_START_LABEL : 'Play solo'
/** The whole menu screen: the solo run shrinks to fit its height. */
const MENU_FRAME_SELECTOR = '.menu-overlay'

function isSameSlot(first: SoloSlot, second: SoloSlot): boolean {
  if (first.kind === 'bot' && second.kind === 'bot') return first.botIndex === second.botIndex
  return first.kind === second.kind
}

function trackTabLabel(table: SoloTable): string {
  const slot: SoloSlot = table.selectedSlot
  if (slot.kind === 'player') return 'You · pick your faction'
  if (slot.kind === 'bot') return `Bot ${String(slot.botIndex + 1)} · swap the bot`
  return `Bot ${String(table.bots.length + 1)} · pick a bot`
}

/**
 * Solo run: the player against the bots, laid out like the online lobby.
 * Selecting a tile points the shared faction track at that seat.
 */
export function MenuSoloSetup(props: {
  disabled: boolean
  onStartSolo: (factions: MenuFactionId[], botSettings: BotSettingsByFaction) => void
  onBack: () => void
}): JSX.Element {
  const [table, setTable] = useState<SoloTable>(defaultSoloTable)
  const [botSettings, setBotSettings] = useState<BotSettingsChoices>(defaultBotSettingsChoices)
  const [settingsOpenBot, setSettingsOpenBot] = useState<BotFactionId | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  const zoom: number = useFitHeightZoom({
    contentRef: sectionRef,
    frameSelector: MENU_FRAME_SELECTOR,
  })
  const botCount: number = table.bots.length

  function selectSlot(slot: SoloSlot): void {
    setTable(withSoloSlotSelected(table, slot))
  }

  function botSettingsModal(faction: BotFactionId): JSX.Element {
    return (
      <MenuBotSettingsModal
        faction={faction}
        settings={botSettings[faction]}
        onDifficultyChange={(difficulty: BotDifficulty): void => {
          setBotSettings(withBotDifficulty(botSettings, { faction, difficulty }))
        }}
        onTraitToggle={(trait: BotTrait): void => {
          setBotSettings(withBotTraitToggled(botSettings, { faction, trait }))
        }}
        onCharacterChange={(character: VagabotCharacter): void => {
          setBotSettings(withVagabotCharacter(botSettings, character))
        }}
        onClose={(): void => {
          setSettingsOpenBot(null)
        }}
      />
    )
  }

  return (
    <>
      <section
        ref={sectionRef}
        className="menu-solo m-0 flex w-full flex-shrink-0 flex-col items-center gap-4"
        style={{ zoom }}
        aria-label="Solo run against the bots"
      >
        {IS_BIRTHDAY_EDITION ? (
          <>
            <h2 className={LOBBY_TITLE_CLASS_NAME}>{BIRTHDAY_TABLE_TITLE}</h2>
            <p className={GUEST_COUNT_CLASS_NAME}>
              You and {botCount} {botCount === 1 ? 'bot guest' : 'bot guests'}
            </p>
          </>
        ) : (
          <h2 className={LOBBY_TITLE_CLASS_NAME}>
            Solo run · {botCount} {botCount === 1 ? 'bot' : 'bots'}
          </h2>
        )}
        <div className={TABLE_CLASS_NAME}>
          <div className={SIDE_CLASS_NAME}>
            <h3 className={SIDE_HEADING_CLASS_NAME}>Player</h3>
            <SoloPlayerTile
              faction={table.playerFaction}
              isSelected={table.selectedSlot.kind === 'player'}
              disabled={props.disabled}
              onSelect={(): void => {
                selectSlot({ kind: 'player' })
              }}
            />
          </div>
          {IS_BIRTHDAY_EDITION ? <PartyMedallion /> : <VersusMedallion />}
          <div className={SIDE_CLASS_NAME}>
            <h3 className={SIDE_HEADING_CLASS_NAME}>Bots</h3>
            <ul className={BOT_LIST_CLASS_NAME}>
              {table.bots.map((faction: BotFactionId, botIndex: number): JSX.Element => (
                <SoloBotTile
                  key={faction}
                  faction={faction}
                  botIndex={botIndex}
                  settings={botSettings[faction]}
                  isSelected={isSameSlot(table.selectedSlot, { kind: 'bot', botIndex })}
                  disabled={props.disabled}
                  onSelect={(): void => {
                    selectSlot({ kind: 'bot', botIndex })
                  }}
                  onRemove={
                    canRemoveSoloBot(table)
                      ? (): void => {
                          setTable(withSoloBotRemoved(table, botIndex))
                          setSettingsOpenBot(null)
                        }
                      : null
                  }
                  isSettingsOpen={settingsOpenBot === faction}
                  onToggleSettings={(): void => {
                    setSettingsOpenBot(settingsOpenBot === faction ? null : faction)
                  }}
                />
              ))}
              {canAddSoloBot(table) ? (
                <SoloAddBotTile
                  isSelected={table.selectedSlot.kind === 'newBot'}
                  disabled={props.disabled}
                  onSelect={(): void => {
                    selectSlot({ kind: 'newBot' })
                  }}
                />
              ) : null}
            </ul>
          </div>
        </div>
        <LobbyFactionDock
          choices={soloTrackChoices(table)}
          mode="own"
          seatIndex={TRACK_SEAT_INDEX}
          isSeated={true}
          disabled={props.disabled}
          modelPicker={null}
          tabLabel={trackTabLabel(table)}
          columnsClassName={
            table.selectedSlot.kind === 'player'
              ? SIX_FACTION_COLUMNS_CLASS_NAME
              : BOT_TRACK_COLUMNS_CLASS_NAME
          }
          onPick={(faction: string): void => {
            setTable(withSoloFactionPicked(table, faction))
          }}
        />
        <div className={LOBBY_FOOTER_CLASS_NAME}>
          <button
            type="button"
            className={`menu-solo-back ${CANCEL_BUTTON_CLASS_NAME}`}
            disabled={props.disabled}
            onClick={props.onBack}
          >
            Back
          </button>
          <button
            type="button"
            className={START_BUTTON_CLASS_NAME}
            disabled={props.disabled}
            onClick={(): void => {
              const factions: MenuFactionId[] = soloPartyFactions(table)
              props.onStartSolo(factions, partyBotSettings(factions, botSettings))
            }}
          >
            {START_LABEL}
            {IS_BIRTHDAY_EDITION ? <BirthdayCandle /> : null}
          </button>
        </div>
      </section>
      {settingsOpenBot !== null ? botSettingsModal(settingsOpenBot) : null}
    </>
  )
}
