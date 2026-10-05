import { addVictoryPoints } from '#rules/dominance.js'
import type { CardEffect } from '#triggers/effects.js'
import type { Card } from '#cards/types.js'
import type { GameState } from '#state/types.js'
import type { Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import { warriorSupplyOf } from '#queries/supply.js'

const COFFIN_MAKERS_DEF_ID = 'ROOT-62'
const WARRIORS_PER_VICTORY_POINT = 5

function findCoffinMakersCard(
  state: GameState,
): { ownerSeat: Seat; playCard: Card } | null {
  for (const player of state.players) {
    for (const playCard of player.playArea) {
      if (playCard.defId === COFFIN_MAKERS_DEF_ID) {
        return { ownerSeat: player.seat, playCard }
      }
    }
  }
  return null
}

/** Rule: Cards > Craft — Coffin Makers: supply removals pile on card; Birdsong scores. */
export const coffinMakersEffect: CardEffect = {
  defId: COFFIN_MAKERS_DEF_ID,
  onSignal(state, signal, ctx) {
    const found = findCoffinMakersCard(state)
    if (!found) return

    if (signal.s === 'warriors.removed' && signal.toSupply) {
      const supply = warriorSupplyOf(playerOf(state, signal.victim).board)
      if (!supply) return
      const moved = Math.min(signal.count, supply.warriors)
      supply.warriors -= moved
      found.playCard.heldWarriors = (found.playCard.heldWarriors ?? 0) + moved
      return
    }

    if (signal.s === 'phase.start' && signal.phase === 'birdsong') {
      if (signal.actor !== found.ownerSeat) return
      const held = found.playCard.heldWarriors ?? 0
      const victoryPoints = Math.floor(held / WARRIORS_PER_VICTORY_POINT)
      if (victoryPoints > 0) {
        const scored = addVictoryPoints(state, found.ownerSeat, victoryPoints)
        if (scored > 0) ctx.emit({ s: 'vp', actor: found.ownerSeat, delta: scored })
      }
      found.playCard.heldWarriors = 0
    }
  },
}
