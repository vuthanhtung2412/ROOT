import type { FactionId } from '#pieces/types.js'
import { Faction } from '#factions/Faction.js'
import { ALLIANCE } from '#factions/Alliance.js'
import { EYRIE } from '#factions/Eyrie.js'
import { MARQUISE } from '#factions/Marquise.js'
import { RuleError } from '#rules/RuleError.js'

export const FACTIONS: Partial<Record<FactionId, Faction>> = {
  marquise: MARQUISE,
  eyrie: EYRIE,
  alliance: ALLIANCE,
}

export function factionFor(faction: FactionId): Faction {
  const implementation = FACTIONS[faction]
  if (implementation === undefined) {
    throw new RuleError('UNSUPPORTED_FACTION', { faction })
  }
  return implementation
}

export { Faction } from '#factions/Faction.js'
export {
  Marquise,
  MARQUISE,
  keepCornerFor,
  placeMarquiseSetup,
  placeMarquiseKeepAndGarrison,
  placeMarquiseStartingBuilding,
  fillMarquiseSetupTracks,
  legalStartingBuildingClearings,
  startingBuildingZone,
} from '#factions/Marquise.js'
export {
  Eyrie,
  EYRIE,
  eyrieStartClearing,
  tuckViziersFor,
  placeEyrieRoostSetup,
  assignEyrieLeader,
} from '#factions/Eyrie.js'
export { Alliance, ALLIANCE } from '#factions/Alliance.js'
export { placeAllianceSetup } from '#factions/alliance/setup.js'
