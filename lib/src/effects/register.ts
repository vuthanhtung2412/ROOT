import { EFFECTS } from '#triggers/effects.js'
import { boatBuildersEffect } from '#effects/boatBuilders.js'
import { charmOffensiveEffect } from '#effects/charmOffensive.js'
import { coffinMakersEffect } from '#effects/coffinMakers.js'
import { corvidPlannersEffect } from '#effects/corvidPlanners.js'
import { eyrieEmigreEffect } from '#effects/eyrieEmigre.js'
import { falseOrdersEffect } from '#effects/falseOrders.js'
import { foxPartisansEffect } from '#effects/partisans.js'
import { informantsEffect } from '#effects/informants.js'
import { leagueOfAdventurousMiceEffect } from '#effects/leagueOfAdventurousMice.js'
import { masterEngraversEffect } from '#effects/masterEngravers.js'
import { murineBrokerEffect } from '#effects/murineBroker.js'
import { propagandaBureauEffect } from '#effects/propagandaBureau.js'
import { saboteursEffect } from '#effects/saboteurs.js'
import { soupKitchensEffect } from '#effects/soupKitchens.js'
import { swapMeetEffect } from '#effects/swapMeet.js'
import { tunnelsEffect } from '#effects/tunnels.js'

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
