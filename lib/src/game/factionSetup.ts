import { placeEyrieRoostSetup } from '#factions/Eyrie.js'
import { factionFor } from '#factions/index.js'
import type { Ctx } from '#game/ctx.js'
import type { FactionId } from '#pieces/types.js'
import {
  RIVERFOLK_SERVICES,
  RIVERFOLK_STARTING_WARRIORS,
} from '#state/riverfolkBoard.js'
import type { GameState, PlayerState } from '#state/types.js'

/** Rule: 5.1.7 — factions set up in setup order (A, B, C, ...). */
export const FACTION_SETUP_ORDER: readonly FactionId[] = [
  'marquise',
  'eyrie',
  'alliance',
  'vagabond',
  'lizard',
  'riverfolk',
]

function playersInSetupOrder(state: GameState): PlayerState[] {
  return [...state.players].sort(
    (left: PlayerState, right: PlayerState): number =>
      FACTION_SETUP_ORDER.indexOf(left.faction) -
      FACTION_SETUP_ORDER.indexOf(right.faction),
  )
}

/**
 * Rule: 5.1.7 — start faction setup. The Marquise chooses her keep first;
 * without her the other factions set up right away.
 */
export function beginFactionSetup(state: GameState, ctx: Ctx): void {
  const marquise = state.players.find(
    (player: PlayerState): boolean => player.faction === 'marquise',
  )
  if (marquise !== undefined) {
    state.pending.push({ type: 'chooseKeep', seat: marquise.seat })
    return
  }
  setUpFactionsAfterMarquise(state, ctx)
}

/** Set up every faction but the Marquise; queue the choices they must make. */
export function setUpFactionsAfterMarquise(state: GameState, ctx: Ctx): void {
  const seats = [...state.players].sort(
    (left: PlayerState, right: PlayerState): number => left.seat - right.seat,
  )
  for (const player of seats) {
    if (player.faction === 'marquise') continue
    if (player.faction === 'eyrie') {
      placeEyrieRoostSetup(state, player.seat)
    } else {
      factionFor(player.faction).setup(state, player.seat, ctx)
    }
  }

  for (const player of playersInSetupOrder(state)) {
    if (player.faction === 'eyrie') {
      state.pending.push({
        type: 'chooseLeader',
        seat: player.seat,
        reason: 'setup',
      })
    }
    if (player.faction === 'vagabond') {
      // Rule: Vagabond > Setup 1, 2 — character, then forest, after earlier factions.
      state.pending.push({ type: 'chooseCharacter', seat: player.seat })
      state.pending.push({ type: 'chooseForest', seat: player.seat })
    }
    if (player.faction === 'lizard') {
      // Rule: 10.3.2, 10.3.3 — starting corner, then the Outcast suit.
      state.pending.push({ type: 'chooseCultCorner', seat: player.seat })
      state.pending.push({ type: 'chooseOutcast', seat: player.seat })
    }
    if (player.faction === 'riverfolk') {
      // Rule: 11.3.2, 11.3.5 — starting warriors, then starting prices.
      state.pending.push({
        type: 'placeRiverfolkWarrior',
        seat: player.seat,
        remaining: RIVERFOLK_STARTING_WARRIORS,
      })
      for (const service of RIVERFOLK_SERVICES) {
        state.pending.push({
          type: 'setStartingCost',
          seat: player.seat,
          service,
        })
      }
    }
  }
}
