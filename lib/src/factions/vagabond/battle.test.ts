import { describe, expect, it, beforeEach } from 'vitest'
import type { VagabondItemChoice } from '#actions/types.js'
import { battleResolver, openBattle } from '#events/battle.js'
import { boardOf, undamagedSwords } from '#factions/vagabond/items.js'
import { VAGABOND } from '#factions/Vagabond.js'
import { FALL } from '#map/fall.js'
import { resetPlaceIds } from '#rules/place.js'
import { SeededRng } from '#rules/Rng.js'
import { isBattleEvent } from '#typeGuards.js'
import {
  minimalState,
  player,
  testContext,
  withPieces,
} from '#test/fixtures.js'

describe('Vagabond battle item damage', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Vagabond Items — battle hits damage items; pawn stays', () => {
    let state = minimalState({
      factions: ['marquise', 'vagabond'],
      players: [player(0, 'marquise'), player(1, 'vagabond')],
      currentSeat: 0,
      phase: 'daylight',
      step: 'actions',
    })
    VAGABOND.setup(
      state,
      1,
      testContext({ state, rng: new SeededRng({ seed: 1, cursor: 0 }) }),
    )
    const board = boardOf(state, 1)
    board.forest = null
    const clearing = FALL.forests[FALL.vagabondForest]![0]!
    state = withPieces(state, clearing, [
      { id: 'pawn-1', kind: 'pawn', owner: 1 },
      { id: 'w0a', kind: 'warrior', owner: 0 },
      { id: 'w0b', kind: 'warrior', owner: 0 },
    ])
    const undamagedBefore = undamagedSwords(board) + board.satchel.length +
      board.tracks.tea.length
    expect(undamagedSwords(board)).toBeGreaterThanOrEqual(1)

    const context = testContext({
      state,
      // Attacker high die 3, defender 0 → VB takes hits as defender
      dice: [3, 0],
    })
    openBattle(state, { clearing, attacker: 0, defender: 1 }, context)

    let chosenItems: VagabondItemChoice[] = []
    // Skip ambush (forced drain may leave ambush for player)
    let guard = 0
    while (state.pending[0] && isBattleEvent(state.pending[0]) && guard < 20) {
      guard += 1
      const event = state.pending[0]
      if (event.stage === 'ambush') {
        battleResolver.apply(
          state,
          {
            event,
            action: { type: 'resolveEvent', decline: true },
            actor: event.defender,
          },
          context,
        )
        continue
      }
      if (event.stage === 'foil') {
        battleResolver.apply(
          state,
          {
            event,
            action: { type: 'resolveEvent', decline: true },
            actor: event.attacker,
          },
          context,
        )
        continue
      }
      if (event.stage === 'removeDefender' || event.stage === 'removeAttacker') {
        const victim =
          event.stage === 'removeDefender' ? event.defender : event.attacker
        // Rule: 9.2.6 — Vagabond picks the damaged items: choose the last offered.
        const params = battleResolver.legalActions(state, event, context)[0]?.params
        const offered = params?.vagabondItems ?? []
        const count = params?.itemCount?.[0] ?? 0
        chosenItems = offered.slice(offered.length - count)
        battleResolver.apply(
          state,
          {
            event,
            action: { type: 'resolveEvent', items: chosenItems },
            actor: victim,
          },
          context,
        )
        continue
      }
      if (event.stage === 'effects') {
        const actor = event.attacker
        battleResolver.apply(
          state,
          {
            event,
            action: { type: 'resolveEvent', useEffect: false },
            actor,
          },
          context,
        )
        continue
      }
      break
    }

    expect(
      state.clearings[clearing]!.pieces.some(
        (piece) => piece.kind === 'pawn' && piece.owner === 1,
      ),
    ).toBe(true)
    // Die 3 vs swords ≥1 → at least 1 hit → ≥1 damaged item
    expect(chosenItems.length).toBeGreaterThanOrEqual(1)
    expect(board.damaged).toEqual(chosenItems)
    void undamagedBefore
  })
})
