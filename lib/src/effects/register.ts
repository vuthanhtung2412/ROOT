import { EFFECTS } from '../triggers/effects.js'
import { boatBuildersEffect } from './boatBuilders.js'
import { charmOffensiveEffect } from './charmOffensive.js'
import { coffinMakersEffect } from './coffinMakers.js'
import { corvidPlannersEffect } from './corvidPlanners.js'
import { foxPartisansEffect } from './partisans.js'
import { masterEngraversEffect } from './masterEngravers.js'
import { murineBrokerEffect } from './murineBroker.js'
import { soupKitchensEffect } from './soupKitchens.js'
import { swapMeetEffect } from './swapMeet.js'
import { tunnelsEffect } from './tunnels.js'

const ALL_EFFECTS = [
  masterEngraversEffect,
  murineBrokerEffect,
  boatBuildersEffect,
  soupKitchensEffect,
  foxPartisansEffect,
  swapMeetEffect,
  corvidPlannersEffect,
  tunnelsEffect,
  charmOffensiveEffect,
  coffinMakersEffect,
]

export function registerEffects(): void {
  for (const effect of ALL_EFFECTS) {
    EFFECTS[effect.defId] = effect
  }
}

registerEffects()
