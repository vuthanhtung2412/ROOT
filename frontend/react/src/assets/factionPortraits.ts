import { publicAssetUrl } from '#assets/publicAssetUrl.ts'

/** Head art of each faction, shown on the player rail seat tiles. */
const FACTION_PORTRAIT_PATHS: Readonly<Record<string, string>> = {
  marquise: '/assets/portraits/marquise.webp',
  eyrie: '/assets/portraits/eyrie.webp',
  alliance: '/assets/portraits/alliance.webp',
  vagabond: '/assets/portraits/vagabond.webp',
  lizard: '/assets/portraits/lizard.webp',
  riverfolk: '/assets/portraits/riverfolk.webp',
}

/** Public path of a faction's portrait; null when the faction has none. */
export function factionPortraitPath(factionId: string): string | null {
  const portraitPath: string | undefined = FACTION_PORTRAIT_PATHS[factionId]
  return portraitPath === undefined ? null : publicAssetUrl(portraitPath)
}
