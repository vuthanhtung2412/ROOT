/** Vagabond (Thief) board lookup — from faction board / root-base-rules. */

export type VagabondAbilityInfo = {
  id: string
  name: string
  description: string
}

export const VAGABOND_ABILITIES: readonly VagabondAbilityInfo[] = [
  {
    id: 'nimble',
    name: 'Nimble',
    description: 'Ignore rule when moving your pawn.',
  },
  {
    id: 'lone-traveler',
    name: 'Lone Traveler',
    description: 'Your pawn is not a warrior and cannot be removed.',
  },
  {
    id: 'steal',
    name: 'Steal (Thief)',
    description: 'Exhaust torch: take a random card from a player in your clearing.',
  },
]

export const VAGABOND_TURN_CHEAT = [
  'Birdsong: Refresh (3 + 2× face-up tea); optional Slip.',
  'Daylight: exhaust items for Move/Battle/Explore/Aid/Strike/Repair/Craft/Steal.',
  'Evening: Rest in forest; draw 1 + coins; discard to 5; enforce satchel capacity.',
] as const

export const THIEF_STARTING_ITEM_LABELS = [
  'boot',
  'torch',
  'tea',
  'sword',
] as const
