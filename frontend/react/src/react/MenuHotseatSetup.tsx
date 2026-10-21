import { useState, type JSX } from 'react'
import {
  assignFactionAtSeat,
  defaultFactionsForPlayerCount,
  factionDisplayName,
  isMenuFactionId,
  HOTSEAT_FACTION_IDS,
  MENU_PLAYER_COUNTS,
  validatePartyFactions,
  type MenuFactionId,
  type MenuPlayerCount,
  type PartySetupValidation,
} from '#game/menuPartySetup.ts'
import { factionColorCss } from '#game/theme.ts'
import { isBotFaction } from '@root/lib/bot-factions'
import type { BotDifficulty, BotSettingsByFaction, BotTrait } from '@root/lib/bot-settings'
import {
  defaultBotSettingsChoices,
  partyBotSettings,
  withBotDifficulty,
  withBotTraitToggled,
  type BotSettingsChoices,
} from '#game/botSettingsMenu.ts'
import { MenuBotSettings } from '#react/MenuBotSettings.tsx'
import {
  FactionBadge,
  PAPER_SHEET_CLASS_NAME,
  SEAT_ROW_CLASS_NAME,
  SECONDARY_BUTTON_CLASS_NAME,
  SECTION_TITLE_CLASS_NAME,
} from '#react/MenuParts.tsx'

const PLAYER_COUNT_BUTTON_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press m-0 min-h-11 min-w-18 px-3 py-1.5 font-display text-xl text-ink'
const PLAYER_COUNT_PICKED_PAPER_CLASS_NAME =
  'shadow-gold-ring [--root-paper-color:var(--color-gold-light)]'
const PLAYER_COUNT_PAPER_CLASS_NAME =
  '[--root-paper-color:var(--color-parchment-deep)]'
const DEFAULT_PLAYER_COUNT: MenuPlayerCount = 2

/**
 * Dev builds only: every seat on this device (hotseat), factions chosen here,
 * and the QA shortcut into a loaded snapshot.
 */
export function MenuHotseatSetup(props: {
  disabled: boolean
  showQaContinue: boolean
  onStartParty: (factions: string[], botSettings: BotSettingsByFaction) => void
  onQaContinue: () => void
}): JSX.Element {
  const [botSettings, setBotSettings] = useState<BotSettingsChoices>(defaultBotSettingsChoices)
  const [playerCount, setPlayerCount] =
    useState<MenuPlayerCount>(DEFAULT_PLAYER_COUNT)
  const [seatFactions, setSeatFactions] = useState<MenuFactionId[]>(() =>
    defaultFactionsForPlayerCount(DEFAULT_PLAYER_COUNT),
  )
  const validation: PartySetupValidation = validatePartyFactions(seatFactions)

  return (
    <section
      className={`m-0 flex flex-col items-center gap-3 ${PAPER_SHEET_CLASS_NAME}`}
      aria-label="Single-screen game (development)"
    >
      <fieldset
        className="m-0 flex w-full flex-col gap-2 border-0 p-0"
        disabled={props.disabled}
      >
        <legend className={`mb-1 ${SECTION_TITLE_CLASS_NAME}`}>Players</legend>
        <div className="flex flex-row flex-wrap gap-2">
          {MENU_PLAYER_COUNTS.map((count: MenuPlayerCount): JSX.Element => {
            const selected: boolean = count === playerCount
            return (
              <button
                key={count}
                type="button"
                className={
                  selected
                    ? `${PLAYER_COUNT_BUTTON_CLASS_NAME} ${PLAYER_COUNT_PICKED_PAPER_CLASS_NAME}`
                    : `${PLAYER_COUNT_BUTTON_CLASS_NAME} ${PLAYER_COUNT_PAPER_CLASS_NAME}`
                }
                aria-pressed={selected}
                onClick={(): void => {
                  setPlayerCount(count)
                  setSeatFactions(defaultFactionsForPlayerCount(count))
                }}
              >
                {count}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset
        className="m-0 flex w-full flex-col gap-2 border-0 p-0"
        disabled={props.disabled}
      >
        <legend className={`mb-1 ${SECTION_TITLE_CLASS_NAME}`}>Factions</legend>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {seatFactions.map(
            (factionId: MenuFactionId, seatIndex: number): JSX.Element => (
              <li
                key={`seat-${String(seatIndex)}`}
                className={`menu-seat ${SEAT_ROW_CLASS_NAME} flex-wrap gap-3`}
                style={{ borderLeftColor: factionColorCss(factionId) }}
              >
                <FactionBadge factionId={factionId} />
                <span className="min-w-12 font-body text-sm text-ink-soft">
                  Seat {seatIndex + 1}
                </span>
                <label className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="sr-only">Faction for seat {seatIndex + 1}</span>
                  <select
                    className="w-full border-2 border-ink bg-parchment px-2 py-1.5 font-body text-base text-ink"
                    value={factionId}
                    onChange={(event): void => {
                      const nextValue: string = event.target.value
                      if (!isMenuFactionId(nextValue)) {
                        return
                      }
                      setSeatFactions(
                        assignFactionAtSeat(seatFactions, seatIndex, nextValue),
                      )
                    }}
                  >
                    {HOTSEAT_FACTION_IDS.map(
                      (optionId: MenuFactionId): JSX.Element => (
                        <option key={optionId} value={optionId}>
                          {factionDisplayName(optionId)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                {isBotFaction(factionId) ? (
                  <div className="w-full pl-12">
                    <MenuBotSettings
                      faction={factionId}
                      settings={botSettings[factionId]}
                      onDifficultyChange={(difficulty: BotDifficulty): void => {
                        setBotSettings(
                          withBotDifficulty(botSettings, { faction: factionId, difficulty }),
                        )
                      }}
                      onTraitToggle={(trait: BotTrait): void => {
                        setBotSettings(
                          withBotTraitToggled(botSettings, { faction: factionId, trait }),
                        )
                      }}
                    />
                  </div>
                ) : null}
              </li>
            ),
          )}
        </ul>
      </fieldset>

      <button
        type="button"
        className={SECONDARY_BUTTON_CLASS_NAME}
        disabled={props.disabled || !validation.ok}
        onClick={(): void => {
          if (!validation.ok) {
            return
          }
          props.onStartParty(
            validation.factions,
            partyBotSettings(validation.factions, botSettings),
          )
        }}
      >
        Start game
      </button>
      {props.showQaContinue ? (
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS_NAME}
          disabled={props.disabled}
          onClick={props.onQaContinue}
        >
          QA: Continue loaded game
        </button>
      ) : null}
      {!validation.ok ? (
        <p
          className="m-0 max-w-[70vw] text-center font-body text-[14px] text-[#8a3030]"
          role="status"
        >
          {validation.reason}
        </p>
      ) : null}
    </section>
  )
}
