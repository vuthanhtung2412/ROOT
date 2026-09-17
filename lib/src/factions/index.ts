import type { FactionId } from '../pieces/types.js'
import { Faction } from './Faction.js'
import { MARQUISE } from './Marquise.js'

/** GP1 registry — Marquise only; Eyrie/Alliance/Vagabond added in later GPs. */
export const FACTIONS: Record<FactionId, Faction> = {
  marquise: MARQUISE,
  eyrie: MARQUISE, // stub until GP2
  alliance: MARQUISE, // stub until GP3
  vagabond: MARQUISE, // stub until GP4
}

export { Faction } from './Faction.js'
export { Marquise, MARQUISE, keepCornerFor } from './Marquise.js'
