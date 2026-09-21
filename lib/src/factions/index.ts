import type { FactionId } from '../pieces/types.js'
import { Faction } from './Faction.js'
import { EYRIE } from './Eyrie.js'
import { MARQUISE } from './Marquise.js'

export const FACTIONS: Record<FactionId, Faction> = {
  marquise: MARQUISE,
  eyrie: EYRIE,
  alliance: MARQUISE, // stub until GP3
  vagabond: MARQUISE, // stub until GP4
}

export { Faction } from './Faction.js'
export { Marquise, MARQUISE, keepCornerFor, placeMarquiseSetup } from './Marquise.js'
export { Eyrie, EYRIE, eyrieStartClearing, tuckViziersFor, placeEyrieRoostSetup, assignEyrieLeader } from './Eyrie.js'
