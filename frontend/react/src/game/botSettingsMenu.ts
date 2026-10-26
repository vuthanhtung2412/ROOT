/**
 * Menu choices for the bots (Rootbotics 3.3): a difficulty card and any of
 * the bot's trait cards, per bot faction.
 */
import { isBotFaction, type BotFactionId } from '@root/lib/bot-factions'
import {
  DEFAULT_BOT_DIFFICULTY,
  DEFAULT_VAGABOT_CHARACTER,
  type VagabotCharacter,
  type BotDifficulty,
  type BotSettings,
  type BotSettingsByFaction,
  type BotTrait,
} from '@root/lib/bot-settings'

export type BotSettingsChoices = Record<BotFactionId, BotSettings>

export function defaultBotSettingsChoices(): BotSettingsChoices {
  return {
    mechanicalMarquise: { difficulty: DEFAULT_BOT_DIFFICULTY, traits: [] },
    electricEyrie: { difficulty: DEFAULT_BOT_DIFFICULTY, traits: [] },
    automatedAlliance: { difficulty: DEFAULT_BOT_DIFFICULTY, traits: [] },
    vagabot: {
      difficulty: DEFAULT_BOT_DIFFICULTY,
      traits: [],
      character: DEFAULT_VAGABOT_CHARACTER,
    },
  }
}

/** Rootbotics 7.3.1 — the Vagabot's character card. */
export function withVagabotCharacter(
  settings: BotSettingsChoices,
  character: VagabotCharacter,
): BotSettingsChoices {
  return { ...settings, vagabot: { ...settings.vagabot, character } }
}

export function withBotDifficulty(
  settings: BotSettingsChoices,
  choice: { faction: BotFactionId; difficulty: BotDifficulty },
): BotSettingsChoices {
  return {
    ...settings,
    [choice.faction]: { ...settings[choice.faction], difficulty: choice.difficulty },
  }
}

/** Trait card on (face up) or off; on cards keep the card order of the bot. */
export function withBotTraitToggled(
  settings: BotSettingsChoices,
  choice: { faction: BotFactionId; trait: BotTrait },
): BotSettingsChoices {
  const current = settings[choice.faction]
  const traits = current.traits.includes(choice.trait)
    ? current.traits.filter((trait: BotTrait): boolean => trait !== choice.trait)
    : [...current.traits, choice.trait]
  return { ...settings, [choice.faction]: { ...current, traits } }
}

/** Settings of the bots seated in the party only. */
export function partyBotSettings(
  factions: readonly string[],
  settings: BotSettingsChoices,
): BotSettingsByFaction {
  const seatedBots = factions.filter((faction: string): faction is BotFactionId =>
    isBotFaction(faction),
  )
  return Object.fromEntries(
    seatedBots.map((faction: BotFactionId): [BotFactionId, BotSettings] => [
      faction,
      settings[faction],
    ]),
  )
}
