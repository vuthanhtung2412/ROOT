import { EFFECTS } from '../triggers/effects.js'
import { boatBuildersEffect } from './boatBuilders.js'
import { charmOffensiveEffect } from './charmOffensive.js'
import { coffinMakersEffect } from './coffinMakers.js'
import { corvidPlannersEffect } from './corvidPlanners.js'
import { eyrieEmigreEffect } from './eyrieEmigre.js'
import { falseOrdersEffect } from './falseOrders.js'
import { foxPartisansEffect } from './partisans.js'
import { informantsEffect } from './informants.js'
import { leagueOfAdventurousMiceEffect } from './leagueOfAdventurousMice.js'
import { masterEngraversEffect } from './masterEngravers.js'
import { murineBrokerEffect } from './murineBroker.js'
import { propagandaBureauEffect } from './propagandaBureau.js'
import { saboteursEffect } from './saboteurs.js'
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
  informantsEffect,
  leagueOfAdventurousMiceEffect,
  propagandaBureauEffect,
  saboteursEffect,
  falseOrdersEffect,
  eyrieEmigreEffect,
]

export function registerEffects(): void {
  for (const effect of ALL_EFFECTS) {
    EFFECTS[effect.defId] = effect
  }
}

registerEffects()
