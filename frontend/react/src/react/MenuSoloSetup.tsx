import { useState, type JSX } from 'react'
import {
  factionDisplayName,
  isSoloFactionId,
  MENU_BOT_FACTION_IDS,
  SOLO_FACTION_IDS,
  type SoloFactionId,
} from '#game/menuPartySetup.ts'
import { factionColorCss } from '#game/theme.ts'
import {
  FactionBadge,
  PAPER_SHEET_CLASS_NAME,
  SEAT_ROW_CLASS_NAME,
  SECONDARY_BUTTON_CLASS_NAME,
  SECTION_TITLE_CLASS_NAME,
} from '#react/MenuParts.tsx'

const DEFAULT_SOLO_FACTION: SoloFactionId = 'alliance'

/** Solo: pick a faction and play it against both bots, no server needed. */
export function MenuSoloSetup(props: {
  disabled: boolean
  onStartSolo: (faction: SoloFactionId) => void
}): JSX.Element {
  const [faction, setFaction] = useState<SoloFactionId>(DEFAULT_SOLO_FACTION)

  return (
    <section
      className={`menu-solo m-0 flex flex-col items-center gap-3 ${PAPER_SHEET_CLASS_NAME}`}
      aria-label="Solo game against the bots"
    >
      <fieldset
        className="m-0 flex w-full flex-col gap-2 border-0 p-0"
        disabled={props.disabled}
      >
        <legend className={`mb-1 ${SECTION_TITLE_CLASS_NAME}`}>
          Solo vs bots
        </legend>
        <label
          className={`${SEAT_ROW_CLASS_NAME} gap-3`}
          style={{ borderLeftColor: factionColorCss(faction) }}
        >
          <FactionBadge factionId={faction} />
          <span className="min-w-12 font-body text-sm text-ink-soft">You</span>
          <select
            className="menu-solo-faction w-full min-w-0 flex-1 border-2 border-ink bg-parchment px-2 py-1.5 font-body text-base text-ink"
            value={faction}
            aria-label="Your faction"
            onChange={(event): void => {
              const nextValue: string = event.target.value
              if (isSoloFactionId(nextValue)) {
                setFaction(nextValue)
              }
            }}
          >
            {SOLO_FACTION_IDS.map(
              (optionId: SoloFactionId): JSX.Element => (
                <option key={optionId} value={optionId}>
                  {factionDisplayName(optionId)}
                </option>
              ),
            )}
          </select>
        </label>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {MENU_BOT_FACTION_IDS.map(
            (botId): JSX.Element => (
              <li
                key={botId}
                className={`${SEAT_ROW_CLASS_NAME} gap-3`}
                style={{ borderLeftColor: factionColorCss(botId) }}
              >
                <FactionBadge factionId={botId} />
                <span className="font-body text-base text-ink">
                  {factionDisplayName(botId)}
                </span>
              </li>
            ),
          )}
        </ul>
      </fieldset>
      <button
        type="button"
        className={`menu-start-solo ${SECONDARY_BUTTON_CLASS_NAME}`}
        disabled={props.disabled}
        onClick={(): void => {
          props.onStartSolo(faction)
        }}
      >
        Play solo
      </button>
    </section>
  )
}
