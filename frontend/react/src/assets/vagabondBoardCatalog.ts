/** Vagabond board lookup — from faction board / root-base-rules. */
import { GAME_ASSET_KEYS } from '#assets/gameAssets.ts'

/** Law 9.2.8 — Allied track spaces (Indifferent → Allied). */
export const VAGABOND_RELATIONSHIP_DEVELOPMENT_CELLS = 4
/** Allied = final Allied-track space (index 3). */
export const VAGABOND_RELATIONSHIP_ALLIED_SPACE = 3
/** Markers exist for each non-Vagabond faction (Law 9.2.8 / Setup). */
export const VAGABOND_RELATIONSHIP_MARKER_FACTIONS = [
  'marquise',
  'eyrie',
  'alliance',
] as const

export type VagabondRelationshipMarkerFaction =
  (typeof VAGABOND_RELATIONSHIP_MARKER_FACTIONS)[number]

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
]

export const VAGABOND_TURN_CHEAT = [
  'Birdsong: Refresh (3 + 2× face-up tea); optional Slip.',
  'Daylight: exhaust items for Move/Battle/Explore/Aid/Strike/Repair/Craft/Special.',
  'Evening: Rest in forest; draw 1 + coins; discard to 5; enforce satchel capacity.',
] as const

export const THIEF_STARTING_ITEM_LABELS = [
  'boot',
  'torch',
  'tea',
  'sword',
] as const

export const CHOOSE_CHARACTER_PROMPT = 'Choose Vagabond character'

/** Law Appendix D — one base game character card. */
export type VagabondCharacterInfo = {
  id: string
  name: string
  startingItems: readonly string[]
  /** Special action (exhaust one torch). */
  special: VagabondAbilityInfo
  cardAssetKey: string
}

export const VAGABOND_CHARACTER_CATALOG: readonly VagabondCharacterInfo[] = [
  {
    id: 'thief',
    name: 'Thief',
    startingItems: THIEF_STARTING_ITEM_LABELS,
    special: {
      id: 'steal',
      name: 'Steal',
      description:
        'Exhaust torch: take a random card from a player in your clearing.',
    },
    cardAssetKey: GAME_ASSET_KEYS.characterCardVagabondThief,
  },
  {
    id: 'tinker',
    name: 'Tinker',
    startingItems: ['boot', 'torch', 'bag', 'hammer'],
    special: {
      id: 'dayLabor',
      name: 'Day Labor',
      description:
        'Exhaust torch: take a discard-pile card matching your clearing (birds always match).',
    },
    cardAssetKey: GAME_ASSET_KEYS.characterCardVagabondTinker,
  },
  {
    id: 'ranger',
    name: 'Ranger',
    startingItems: ['boot', 'torch', 'crossbow', 'sword'],
    special: {
      id: 'hideout',
      name: 'Hideout',
      description: 'Exhaust torch: repair three items, then end Daylight.',
    },
    cardAssetKey: GAME_ASSET_KEYS.characterCardVagabondRanger,
  },
]

/** Boards saved before characters existed carry no character: Thief. */
const DEFAULT_VAGABOND_CHARACTER: VagabondCharacterInfo =
  VAGABOND_CHARACTER_CATALOG[0]!

export function lookupVagabondCharacter(
  characterId: string | null | undefined,
): VagabondCharacterInfo {
  return (
    VAGABOND_CHARACTER_CATALOG.find(
      (character) => character.id === characterId,
    ) ?? DEFAULT_VAGABOND_CHARACTER
  )
}

/** Setup pick button, e.g. "Tinker — Day Labor". */
export function formatVagabondCharacterOptionLabel(characterId: string): string {
  const character = VAGABOND_CHARACTER_CATALOG.find(
    (entry) => entry.id === characterId,
  )
  if (character === undefined) {
    return characterId
  }
  return `${character.name} — ${character.special.name}`
}
