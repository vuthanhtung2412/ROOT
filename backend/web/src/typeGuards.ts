import {
  BOT_FACTION_IDS,
  isBotTraitOf,
  type Action,
  type BotFactionId,
  type BotSettings,
  type BotSettingsByFaction,
  type BotTrait,
  type FactionId,
  type GameSnapshot,
  type Seat,
} from '@root/lib'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const FACTION_IDS: ReadonlySet<string> = new Set([
  'marquise',
  'eyrie',
  'alliance',
  'vagabond',
  'lizard',
  'riverfolk',
  'mechanicalMarquise',
  'electricEyrie',
  'automatedAlliance',
  'vagabot',
])

export function isFactionId(value: unknown): value is FactionId {
  return typeof value === 'string' && FACTION_IDS.has(value)
}

const SEAT_COUNT = 4

export function isSeat(value: number): value is Seat {
  return Number.isInteger(value) && value >= 0 && value < SEAT_COUNT
}

export function isFactionIdArray(value: unknown): value is FactionId[] {
  return Array.isArray(value) && value.every(isFactionId)
}

/** Rootbotics 3.3.2 — each bot gets only its own trait cards (and only the Vagabot a character). */
export function hasOnlyOwnTraits(settings: BotSettingsByFaction): boolean {
  return BOT_FACTION_IDS.every((faction: BotFactionId): boolean => {
    const factionSettings = settings[faction]
    return factionSettings === undefined || areBotSettingsOf(faction, factionSettings)
  })
}

export function hasOnlyTraitsOf(faction: BotFactionId, traits: readonly BotTrait[]): boolean {
  return traits.every((trait: BotTrait): boolean => isBotTraitOf(faction, trait))
}

/** Rootbotics 3.3.2 / 7.3.1 — own traits; a character card for the Vagabot only. */
export function areBotSettingsOf(faction: BotFactionId, settings: BotSettings): boolean {
  if (settings.character !== undefined && faction !== 'vagabot') return false
  return hasOnlyTraitsOf(faction, settings.traits)
}

/** Zod ActionSchema is loose; narrow to engine Action after request validation. */
export function isAction(value: unknown): value is Action {
  if (!isRecord(value)) return false
  return typeof value.type === 'string'
}

/** Zod GameSnapshotSchema is loose; narrow to engine GameSnapshot after validation. */
export function isGameSnapshot(value: unknown): value is GameSnapshot {
  if (!isRecord(value)) return false
  if (!isRecord(value.state)) return false
  if (!Array.isArray(value.history) || !value.history.every(isAction)) return false
  if (!Array.isArray(value.log)) return false
  if (!isRecord(value.rng)) return false
  if (typeof value.rng.seed !== 'number') return false
  if (typeof value.rng.cursor !== 'number') return false
  return true
}
