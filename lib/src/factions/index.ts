import type { FactionId } from '#pieces/types.js'
import { Faction } from '#factions/Faction.js'
import { EYRIE } from '#factions/Eyrie.js'
import { MARQUISE } from '#factions/Marquise.js'

export const FACTIONS: Record<FactionId, Faction> = {
  marquise: MARQUISE,
  eyrie: EYRIE,
  alliance: MARQUISE, // stub until GP3
  vagabond: MARQUISE, // stub until GP4
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
export { Eyrie, EYRIE, eyrieStartClearing, tuckViziersFor, placeEyrieRoostSetup, assignEyrieLeader } from '#factions/Eyrie.js'
