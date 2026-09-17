import { EFFECTS } from '../triggers/effects.js'
import { boatBuildersEffect } from './boatBuilders.js'
import { foxPartisansEffect } from './partisans.js'
import { masterEngraversEffect } from './masterEngravers.js'
import { murineBrokerEffect } from './murineBroker.js'
import { soupKitchensEffect } from './soupKitchens.js'
import { swapMeetEffect } from './swapMeet.js'

const ALL_EFFECTS = [
  masterEngraversEffect,
  murineBrokerEffect,
  boatBuildersEffect,
  soupKitchensEffect,
  foxPartisansEffect,
  swapMeetEffect,
]

export function registerEffects(): void {
  for (const effect of ALL_EFFECTS) {
    EFFECTS[effect.defId] = effect
  }
}

registerEffects()
