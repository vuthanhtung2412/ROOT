import type { JSX } from 'react'
import type { BotFactionId } from '@root/lib/bot-factions'
import {
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_CARDS,
  BOT_TRAIT_CARDS,
  BOT_TRAITS,
  isBotDifficulty,
  type BotDifficulty,
  type BotSettings,
  type BotTrait,
} from '@root/lib/bot-settings'
import { factionDisplayName } from '#game/menuPartySetup.ts'

const TRAIT_BUTTON_CLASS_NAME =
  'menu-bot-trait m-0 cursor-root-pointer border border-ink/50 px-2 py-0.5 font-body text-xs text-ink'
const TRAIT_PICKED_CLASS_NAME = 'bg-gold-light shadow-gold-ring'
const TRAIT_UNPICKED_CLASS_NAME = 'bg-parchment/70 opacity-75'

/**
 * Rootbotics 3.3 — a bot's difficulty card and trait cards, under its seat.
 * Card text shows on hover.
 */
export function MenuBotSettings(props: {
  faction: BotFactionId
  settings: BotSettings
  onDifficultyChange: (difficulty: BotDifficulty) => void
  onTraitToggle: (trait: BotTrait) => void
}): JSX.Element {
  const { faction, settings } = props
  return (
    <div className="menu-bot-settings flex w-full flex-col gap-1.5 pl-12">
      <label className="flex flex-row items-center gap-2 font-body text-sm text-ink-soft">
        Difficulty
        <select
          className="menu-bot-difficulty border border-ink bg-parchment px-1.5 py-0.5 font-body text-sm text-ink"
          value={settings.difficulty}
          aria-label={`Difficulty of ${factionDisplayName(faction)}`}
          title={BOT_DIFFICULTY_CARDS[faction][settings.difficulty].text}
          onChange={(event): void => {
            const nextValue: string = event.target.value
            if (isBotDifficulty(nextValue)) props.onDifficultyChange(nextValue)
          }}
        >
          {BOT_DIFFICULTIES.map(
            (difficulty: BotDifficulty): JSX.Element => (
              <option key={difficulty} value={difficulty}>
                {BOT_DIFFICULTY_CARDS[faction][difficulty].name}
              </option>
            ),
          )}
        </select>
      </label>
      <div className="flex flex-row flex-wrap gap-1" role="group" aria-label="Traits">
        {BOT_TRAITS[faction].map((trait: BotTrait): JSX.Element => {
          const picked: boolean = settings.traits.includes(trait)
          return (
            <button
              key={trait}
              type="button"
              className={`${TRAIT_BUTTON_CLASS_NAME} ${picked ? TRAIT_PICKED_CLASS_NAME : TRAIT_UNPICKED_CLASS_NAME}`}
              aria-pressed={picked}
              title={BOT_TRAIT_CARDS[trait].text}
              onClick={(): void => {
                props.onTraitToggle(trait)
              }}
            >
              {BOT_TRAIT_CARDS[trait].name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
