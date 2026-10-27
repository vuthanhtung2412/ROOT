import { artFactionOf, isBotFaction } from '@root/lib/bot-factions'
import {
  GAME_ASSET_KEYS,
  WARM_GAME_IMAGE_ASSETS,
  type GameImageAsset,
} from '#assets/gameAssets.ts'
import { RIVERFOLK_EXPANSION_ASSET_KEYS } from '#assets/riverfolkExpansionAssets.ts'

/**
 * Art only one faction uses: its board, buildings, tokens and warriors.
 * Faction icons are left out — the menu lobby shows every one of them.
 */
const FACTION_OWNED_IMAGE_ASSET_KEYS: Readonly<
  Record<string, readonly string[]>
> = {
  marquise: [
    GAME_ASSET_KEYS.characterBoardMarquise,
    GAME_ASSET_KEYS.tokenMarquiseSawmill,
    GAME_ASSET_KEYS.tokenMarquiseWorkshop,
    GAME_ASSET_KEYS.tokenMarquiseRecruiter,
    GAME_ASSET_KEYS.tokenMarquiseWood,
    GAME_ASSET_KEYS.tokenMarquiseKeep,
    GAME_ASSET_KEYS.tokenMarquiseWarrior,
  ],
  eyrie: [
    GAME_ASSET_KEYS.characterBoardEyrie,
    GAME_ASSET_KEYS.tokenEyrieRoost,
    GAME_ASSET_KEYS.tokenEyrieWarrior,
  ],
  alliance: [
    GAME_ASSET_KEYS.characterBoardAlliance,
    GAME_ASSET_KEYS.tokenAllianceSympathy,
    GAME_ASSET_KEYS.tokenAllianceBaseFox,
    GAME_ASSET_KEYS.tokenAllianceBaseMouse,
    GAME_ASSET_KEYS.tokenAllianceBaseRabbit,
    GAME_ASSET_KEYS.tokenAllianceWarrior,
  ],
  vagabond: [
    GAME_ASSET_KEYS.characterBoardVagabond,
    GAME_ASSET_KEYS.characterCardVagabondThief,
    GAME_ASSET_KEYS.characterCardVagabondTinker,
    GAME_ASSET_KEYS.characterCardVagabondRanger,
    GAME_ASSET_KEYS.tokenVagabondPawn,
    GAME_ASSET_KEYS.tokenVagabondPawnTinker,
    GAME_ASSET_KEYS.tokenVagabondPawnRanger,
  ],
  lizard: [
    RIVERFOLK_EXPANSION_ASSET_KEYS.characterBoardLizard,
    RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardWarrior,
    RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardGardenFox,
    RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardGardenMouse,
    RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardGardenRabbit,
    RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardOutcast,
    RIVERFOLK_EXPANSION_ASSET_KEYS.tokenLizardOutcastHated,
  ],
  // A bot also uses the tokens of the faction it replaces (see below).
  mechanicalMarquise: [GAME_ASSET_KEYS.characterBoardMechanicalMarquise],
  electricEyrie: [GAME_ASSET_KEYS.characterBoardElectricEyrie, GAME_ASSET_KEYS.cardLoyalVizier],
  automatedAlliance: [GAME_ASSET_KEYS.characterBoardAutomatedAlliance],
  vagabot: [
    GAME_ASSET_KEYS.characterBoardVagabot,
    GAME_ASSET_KEYS.characterCardVagabotThief,
    GAME_ASSET_KEYS.characterCardVagabotTinker,
    GAME_ASSET_KEYS.characterCardVagabotRanger,
  ],
  riverfolk: [
    RIVERFOLK_EXPANSION_ASSET_KEYS.characterBoardRiverfolk,
    RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkWarrior,
    RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkTradePostFox,
    RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkTradePostMouse,
    RIVERFOLK_EXPANSION_ASSET_KEYS.tokenRiverfolkTradePostRabbit,
  ],
}

const ALL_FACTION_OWNED_IMAGE_ASSET_KEYS: ReadonlySet<string> = new Set(
  Object.values(FACTION_OWNED_IMAGE_ASSET_KEYS).flat(),
)

/** Game art every game uses (suits, items, ruins): fetched on the menu. */
export const SHARED_GAME_IMAGE_ASSETS: readonly GameImageAsset[] =
  WARM_GAME_IMAGE_ASSETS.filter(
    (asset: GameImageAsset): boolean =>
      !ALL_FACTION_OWNED_IMAGE_ASSET_KEYS.has(asset.key),
  )

/**
 * Boards and tokens of the factions in play, fetched once the game knows
 * them — not the whole box.
 */
export function factionImageAssetsFor(
  factionIds: readonly string[],
): readonly GameImageAsset[] {
  const activeFactionKeys: ReadonlySet<string> = new Set(
    factionIds.flatMap((factionId: string): readonly string[] => [
      ...(FACTION_OWNED_IMAGE_ASSET_KEYS[factionId] ?? []),
      ...(isBotFaction(factionId)
        ? (FACTION_OWNED_IMAGE_ASSET_KEYS[artFactionOf(factionId)] ?? [])
        : []),
    ]),
  )
  return WARM_GAME_IMAGE_ASSETS.filter((asset: GameImageAsset): boolean =>
    activeFactionKeys.has(asset.key),
  )
}
