import type { FactionId } from '#pieces/types.js'

/**
 * Rootbotics bot factions. No runtime imports: the React client loads this
 * file on its own (`@root/lib/bot-factions`).
 */
export type BotFactionId =
  | 'mechanicalMarquise'
  | 'electricEyrie'
  | 'automatedAlliance'
  | 'vagabot'

/** Factions a human plays; each bot replaces one of them (Rootbotics 3.2). */
export type HumanFactionId = Exclude<FactionId, BotFactionId>

export const BOT_FACTION_IDS: readonly BotFactionId[] = [
  'mechanicalMarquise',
  'electricEyrie',
  'automatedAlliance',
  'vagabot',
]

const HUMAN_FACTION_OF_BOT: Readonly<Record<BotFactionId, HumanFactionId>> = {
  mechanicalMarquise: 'marquise',
  electricEyrie: 'eyrie',
  automatedAlliance: 'alliance',
  vagabot: 'vagabond',
}

export function isBotFaction(faction: string): faction is BotFactionId {
  return BOT_FACTION_IDS.some(
    (botFaction: BotFactionId): boolean => botFaction === faction,
  )
}

/** The faction whose pieces and art a bot uses: Mechanical Marquise → Marquise. */
export function baseFactionOf(faction: FactionId): HumanFactionId {
  return isBotFaction(faction) ? HUMAN_FACTION_OF_BOT[faction] : faction
}

/** Same as `baseFactionOf` for any faction text (unknown text comes back as is). */
export function artFactionOf(faction: string): string {
  return isBotFaction(faction) ? HUMAN_FACTION_OF_BOT[faction] : faction
}
