import { artFactionOf } from '@root/lib/bot-factions'
import { publicAssetUrl } from '#assets/publicAssetUrl.ts'

/** Head art of each faction, shown on the player rail seat tiles. */
const FACTION_PORTRAIT_PATHS: Readonly<Record<string, string>> = {
  marquise: '/assets/portraits/marquise.webp',
  eyrie: '/assets/portraits/eyrie.webp',
  alliance: '/assets/portraits/alliance.webp',
  vagabond: '/assets/portraits/vagabond.webp',
  lizard: '/assets/portraits/lizard.webp',
  riverfolk: '/assets/portraits/riverfolk.webp',
  mechanicalMarquise: '/assets/portraits/mechanicalMarquise.webp',
  electricEyrie: '/assets/portraits/electricEyrie.webp',
  automatedAlliance: '/assets/portraits/automatedAlliance.webp',
  vagabot: '/assets/portraits/vagabot.webp',
}

/**
 * Public path of a faction's portrait; a bot with no portrait of its own
 * wears the one of the faction it replaces; null when there is none.
 */
export function factionPortraitPath(factionId: string): string | null {
  const portraitPath: string | undefined =
    FACTION_PORTRAIT_PATHS[factionId] ?? FACTION_PORTRAIT_PATHS[artFactionOf(factionId)]
  return portraitPath === undefined ? null : publicAssetUrl(portraitPath)
}
