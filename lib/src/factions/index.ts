import type { FactionId } from '#pieces/types.js'
import { Faction } from '#factions/Faction.js'
import { ALLIANCE } from '#factions/Alliance.js'
import { EYRIE } from '#factions/Eyrie.js'
import { LIZARD } from '#factions/Lizard.js'
import { MARQUISE } from '#factions/Marquise.js'
import { RIVERFOLK } from '#factions/Riverfolk.js'
import { VAGABOND } from '#factions/Vagabond.js'
import { AUTOMATED_ALLIANCE } from '#factions/bots/AutomatedAlliance.js'
import { ELECTRIC_EYRIE } from '#factions/bots/ElectricEyrie.js'
import { MECHANICAL_MARQUISE } from '#factions/bots/MechanicalMarquise.js'
import { VAGABOT } from '#factions/bots/Vagabot.js'
import { RuleError } from '#rules/RuleError.js'

export const FACTIONS: Partial<Record<FactionId, Faction>> = {
  marquise: MARQUISE,
  eyrie: EYRIE,
  alliance: ALLIANCE,
  vagabond: VAGABOND,
  lizard: LIZARD,
  riverfolk: RIVERFOLK,
  mechanicalMarquise: MECHANICAL_MARQUISE,
  electricEyrie: ELECTRIC_EYRIE,
  automatedAlliance: AUTOMATED_ALLIANCE,
  vagabot: VAGABOT,
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
export { Vagabond, VAGABOND, placeVagabondForest } from '#factions/Vagabond.js'
export { Lizard, LIZARD } from '#factions/Lizard.js'
export { Riverfolk, RIVERFOLK } from '#factions/Riverfolk.js'
