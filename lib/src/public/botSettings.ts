import type { BotFactionId } from '#public/botFactionIds.js'

/**
 * Rootbotics 3.3 — bot difficulty and trait cards. No runtime imports: the
 * React client loads this file on its own (`@root/lib/bot-settings`).
 * Card text SoT: `resources/rules/Rootbotics_difficulty_and_traits.md`.
 */
export type BotDifficulty = 'easy' | 'default' | 'challenging' | 'nightmare'

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = [
  'easy',
  'default',
  'challenging',
  'nightmare',
]

export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = 'default'

export type MechanicalMarquiseTrait =
  | 'blitz'
  | 'fortified'
  | 'hospitals'
  | 'ironWill'
  | 'overwhelming'

export type ElectricEyrieTrait =
  | 'focused'
  | 'nobility'
  | 'relentless'
  | 'swoop'
  | 'warTax'

export type AutomatedAllianceTrait =
  | 'steadfast'
  | 'wildfire'
  | 'informants'
  | 'popularity'
  | 'veterans'

export type VagabotTrait = 'adventurer' | 'berserker' | 'marksman' | 'helper' | 'questing'

export type BotTrait =
  | MechanicalMarquiseTrait
  | ElectricEyrieTrait
  | AutomatedAllianceTrait
  | VagabotTrait

/** Rule: Rootbotics 7.3.1 / 7.7 — Vagabot character cards played here. */
export type VagabotCharacter = 'thief' | 'tinker' | 'ranger'

export const VAGABOT_CHARACTERS: readonly VagabotCharacter[] = ['thief', 'tinker', 'ranger']

export const DEFAULT_VAGABOT_CHARACTER: VagabotCharacter = 'thief'

export type BotSettings = {
  difficulty: BotDifficulty
  traits: BotTrait[]
  /** Vagabot only — its character card; absent = Thief. */
  character?: VagabotCharacter
}

/** Settings per bot faction; a bot left out plays at default with no trait. */
export type BotSettingsByFaction = Partial<Record<BotFactionId, BotSettings>>

export type BotCardText = {
  name: string
  text: string
}

export const BOT_TRAITS: Readonly<Record<BotFactionId, readonly BotTrait[]>> = {
  mechanicalMarquise: ['blitz', 'fortified', 'hospitals', 'ironWill', 'overwhelming'],
  electricEyrie: ['focused', 'nobility', 'relentless', 'swoop', 'warTax'],
  automatedAlliance: ['steadfast', 'wildfire', 'informants', 'popularity', 'veterans'],
  vagabot: ['adventurer', 'berserker', 'marksman', 'helper', 'questing'],
}

export const BOT_TRAIT_CARDS: Readonly<Record<BotTrait, BotCardText>> = {
  blitz: {
    name: 'Blitz',
    text: 'After your move action select the highest priority clearing you rule without any enemy pieces. Move all but one warrior from the clearing and battle in the destination if opponents are present.',
  },
  fortified: {
    name: 'Fortified',
    text: 'Opponents require two hits to destroy each of your buildings. Assigning a single hit to a building has no effect.',
  },
  hospitals: {
    name: 'Hospitals',
    text: 'After each battle as Defender in which you lost at least 2 warriors, immediately recruit 2 warriors in the clearing with the keep token.',
  },
  ironWill: {
    name: 'Iron Will',
    text: 'In Escalated Daylight recruit twice as many warriors.',
  },
  overwhelming: {
    name: 'Overwhelming',
    text: 'Whenever you Recruit, score one point for every two warriors you cannot place because your supply is empty or because there are no legal clearings to place them in. Expand can only trigger once per turn.',
  },
  focused: {
    name: 'Focused',
    text: 'In battle, deal the extra hit even if the Battle column is tied for most cards.',
  },
  nobility: {
    name: 'Nobility',
    text: 'Turmoil is now triggered if you are unable to place a roost or if you are unable to place a warrior. When turmoil occurs, no victory points are lost and instead a point is scored for every bird card in your Decree.',
  },
  relentless: {
    name: 'Relentless',
    text: 'After resolving the Decree, remove all defenseless buildings and tokens in any clearing where you have warriors.',
  },
  swoop: {
    name: 'Swoop',
    text: 'At the end of Daylight, recruit two warriors in the highest priority clearing in which you have no pieces.',
  },
  warTax: {
    name: 'War Tax',
    text: 'Whenever you destroy a token or building, the owner loses 1 VP.',
  },
  steadfast: {
    name: 'Steadfast',
    text: 'Skip Public Pity if Surprise Revolt will happen this turn. (Take only one of these actions each turn.) Ignore Martial Law.',
  },
  wildfire: {
    name: 'Wildfire',
    text: 'At the end of evening, Spread Sympathy. Do not score points for placing this sympathy token.',
  },
  informants: {
    name: 'Informants',
    text: 'Defenseless sympathy tokens benefit from Automated Ambush when attacked.',
  },
  popularity: {
    name: 'Popularity',
    text: 'Destroying sympathy tokens grants no victory points for your opponents.',
  },
  veterans: {
    name: 'Veterans',
    text: 'In battle as defender, you use the higher roll and the attacker uses the lower roll.',
  },
  adventurer: {
    name: 'Adventurer',
    text: 'Battle only once per turn. At the end of Daylight, spend any remaining items on repeated Quest actions.',
  },
  berserker: {
    name: 'Berserker',
    text: 'During the Battle action target the clearing with the most pieces and target the player with the most pieces in that clearing. At the end of your turn, repair one addition item.',
  },
  marksman: {
    name: 'Marksman',
    text: 'When attacking, deal one immediate hit to your opponent (scoring a point if a warrior is removed) before the dice are rolled.',
  },
  helper: {
    name: 'Helper',
    text: 'When taking the Aid action, score an additional victory point. The aided player then takes two cards instead of one.',
  },
  questing: {
    name: 'Questing',
    text: 'Count damaged items toward the 6/9/12 items needed to place items on your Battle Track. Items cannot be removed from the Battle Track. Quests score an extra victory point. Whenever you Aid, move to the nearest clearing that has a player with any items in their Crafted Items box, but only aid them once. Updated Daylight actions — Fox: Explore, Special, Battle; Rabbit: Special, Aid, Battle; Mouse: Quest, Aid, Battle; Bird: Explore, Quest, Battle.',
  },
}

/** Rule: Rootbotics 7.7 — the Vagabot character cards played here. */
export const VAGABOT_CHARACTER_CARDS: Readonly<Record<VagabotCharacter, BotCardText>> = {
  thief: {
    name: 'Thief',
    text: 'Steal — Take a random card from an enemy player in your clearing. Target is highest score, then most pieces.',
  },
  tinker: {
    name: 'Tinker',
    text: 'Day Labor — Search the discard pile for the topmost card with an available item, and craft it, scoring 1. Start the game with one less item.',
  },
  ranger: {
    name: 'Ranger',
    text: 'Hideout — If you have three or more damaged items, slip into a random adjacent forest.',
  },
}

export function isVagabotCharacter(value: string): value is VagabotCharacter {
  return VAGABOT_CHARACTERS.some((character: VagabotCharacter): boolean => character === value)
}

export const BOT_DIFFICULTY_CARDS: Readonly<
  Record<BotFactionId, Readonly<Record<BotDifficulty, BotCardText>>>
> = {
  mechanicalMarquise: {
    easy: { name: 'Easy', text: 'Recruit two warriors during the recruit action.' },
    default: { name: 'Default', text: 'The rules on the faction board.' },
    challenging: {
      name: 'Challenging',
      text: 'After recruiting, place two warriors in the highest priority clearing you rule matching the order card.',
    },
    nightmare: {
      name: 'Nightmare',
      text: 'After recruiting, place two warriors in the highest priority clearing you rule matching the order card. At the end of evening, score 1 VP.',
    },
  },
  electricEyrie: {
    easy: {
      name: 'Easy',
      text: 'During setup, place only one Loyal Vizier in the bird column.',
    },
    default: { name: 'Default', text: 'The rules on the faction board.' },
    challenging: {
      name: 'Challenging',
      text: 'During setup, take out one bird ambush from the deck and place it in the bird column.',
    },
    nightmare: {
      name: 'Nightmare',
      text: 'During setup, take out one bird ambush from the deck and place it in the bird column. At the end of evening, score 1 VP.',
    },
  },
  automatedAlliance: {
    easy: { name: 'Easy', text: 'Organize if there are 4 or more warriors in the clearing.' },
    default: { name: 'Default', text: 'The rules on the faction board.' },
    challenging: {
      name: 'Challenging',
      text: 'Organize if there are 2 or more warriors in the clearing.',
    },
    nightmare: {
      name: 'Nightmare',
      text: 'Organize if there are 2 or more warriors in the clearing. At the end of evening, score 1 VP.',
    },
  },
  vagabot: {
    easy: { name: 'Easy', text: 'Refresh one less item during Evening.' },
    default: { name: 'Default', text: 'The rules on the faction board.' },
    challenging: { name: 'Challenging', text: 'Refresh one more item during Evening.' },
    nightmare: {
      name: 'Nightmare',
      text: 'Refresh one more item during Evening. At the end of evening, score 1 VP.',
    },
  },
}

export function isBotDifficulty(value: string): value is BotDifficulty {
  return BOT_DIFFICULTIES.some((difficulty: BotDifficulty): boolean => difficulty === value)
}

export function isBotTraitOf(faction: BotFactionId, value: string): value is BotTrait {
  return BOT_TRAITS[faction].some((trait: BotTrait): boolean => trait === value)
}
