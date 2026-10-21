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

export type BotTrait = MechanicalMarquiseTrait | ElectricEyrieTrait

export type BotSettings = {
  difficulty: BotDifficulty
  traits: BotTrait[]
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
}

export function isBotDifficulty(value: string): value is BotDifficulty {
  return BOT_DIFFICULTIES.some((difficulty: BotDifficulty): boolean => difficulty === value)
}

export function isBotTraitOf(faction: BotFactionId, value: string): value is BotTrait {
  return BOT_TRAITS[faction].some((trait: BotTrait): boolean => trait === value)
}
