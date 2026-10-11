import { describe, expect, it } from 'vitest'
import type { ActionSpec } from '#actions/types.js'
import type { Card } from '#cards/types.js'
import '#effects/register.js'
import {
  propagandaBureauEffect,
  tryApplyPropagandaBureau,
} from '#effects/propagandaBureau.js'
import { fieldHospitalResolver } from '#events/fieldHospital.js'
import { FALL } from '#map/fall.js'
import { isFieldHospitalEvent } from '#typeGuards.js'
import type { ClearingId } from '#map/types.js'
import type { Seat } from '#pieces/types.js'
import { warriors } from '#queries/pieces.js'
import { warriorSupplyOf } from '#queries/supply.js'
import { RuleError } from '#rules/RuleError.js'
import type { GameState } from '#state/types.js'
import {
  buildCraftContext,
  card,
  createPlayingGame,
  eyrieBoard,
  minimalState,
  player,
  withPieces,
} from '#test/fixtures.js'

describe('Propaganda Bureau', () => {
  it('Rule: Propaganda Bureau — spend matching card to replace enemy warrior', () => {
    const game = createPlayingGame({ seed: 23 })

    game.apply({ type: 'endPhase' })
    game.apply({ type: 'endPhase' })

    const seat = game.state.currentSeat
    const enemy = seat === 0 ? 1 : 0
    game.state.players[seat]!.playArea.push(card('ROOT-86'))

    // Fox clearing 0: place enemy warrior; give owner a fox card.
    const foxClearing = 0
    expect(FALL.clearings[foxClearing]!.suit).toBe('fox')
    game.state.clearings[foxClearing]!.pieces.push({
      id: 'enemy-w',
      kind: 'warrior',
      owner: enemy,
    })
    const foxCard = card('ROOT-72')
    game.state.players[seat]!.hand.push(foxCard)

    expect(game.legalActions().some((spec) => spec.type === 'propagandaBureau')).toBe(true)
    const ownerBefore = warriors(game.state, foxClearing, seat)
    game.apply({
      type: 'propagandaBureau',
      cardId: foxCard.id,
      clearing: foxClearing,
      pieceId: 'enemy-w',
    })

    expect(game.state.turnScratch.propagandaUsed).toBe(true)
    expect(
      game.state.clearings[foxClearing]!.pieces.some((piece) => piece.id === 'enemy-w'),
    ).toBe(false)
    expect(warriors(game.state, foxClearing, seat)).toBe(ownerBefore + 1)
    expect(game.state.players[seat]!.hand.some((handCard) => handCard.id === foxCard.id)).toBe(
      false,
    )
  })
})

const MARQUISE_SEAT: Seat = 0
const EYRIE_SEAT: Seat = 1
const KEEP_CLEARING: ClearingId = 2
const MOUSE_CLEARING: ClearingId = 6
const PROPAGANDA_BUREAU_DEF_ID = 'ROOT-86'
const RABBIT_CARD_DEF_ID = 'ROOT-206'
const MOUSE_CARD_DEF_ID = 'ROOT-218'
const KEEP_WARRIOR_ID = 'cat-in-keep'
const MOUSE_WARRIOR_ID = 'cat-on-mouse'

type BureauStateOptions = {
  eyrieWarriorSupply?: number
  marquiseHand?: Card[]
  eyriePlayArea?: Card[]
}

/** Eyrie owns Propaganda Bureau in Daylight; Marquise warriors on 2 (Keep) and 6. */
function bureauState(options: BureauStateOptions = {}): GameState {
  const base: GameState = minimalState({
    currentSeat: EYRIE_SEAT,
    players: [
      player(MARQUISE_SEAT, 'marquise', { hand: options.marquiseHand ?? [] }),
      player(EYRIE_SEAT, 'eyrie', {
        playArea: options.eyriePlayArea ?? [card(PROPAGANDA_BUREAU_DEF_ID)],
        hand: [card(RABBIT_CARD_DEF_ID), card(MOUSE_CARD_DEF_ID)],
        board: eyrieBoard({
          supply: { warriors: options.eyrieWarriorSupply ?? 20 },
        }),
      }),
    ],
  })
  const withKeep: GameState = withPieces(base, KEEP_CLEARING, [
    { id: 'keep', kind: 'token', type: 'keep', owner: MARQUISE_SEAT },
    { id: KEEP_WARRIOR_ID, kind: 'warrior', owner: MARQUISE_SEAT },
  ])
  return withPieces(withKeep, MOUSE_CLEARING, [
    { id: MOUSE_WARRIOR_ID, kind: 'warrior', owner: MARQUISE_SEAT },
  ])
}

function grantedSpecs(state: GameState): ActionSpec[] {
  return propagandaBureauEffect.grants?.(state) ?? []
}

describe('Propaganda Bureau — Rule: G.1.21 Replace must be completable', () => {
  it('is not offered when the owner has no warrior left in supply', () => {
    const state: GameState = bureauState({ eyrieWarriorSupply: 0 })

    expect(grantedSpecs(state)).toEqual([])
  })

  it('rejects the action with an empty supply and changes nothing', () => {
    const state: GameState = bureauState({ eyrieWarriorSupply: 0 })
    const before: GameState = structuredClone(state)

    expect(() =>
      tryApplyPropagandaBureau(
        state,
        {
          type: 'propagandaBureau',
          cardId: card(MOUSE_CARD_DEF_ID).id,
          clearing: MOUSE_CLEARING,
          pieceId: MOUSE_WARRIOR_ID,
        },
        buildCraftContext(state),
      ),
    ).toThrow(RuleError)
    expect(state).toEqual(before)
  })

  it('Rule: 6.2.2 The Keep — rejects a warrior in the Keep clearing and changes nothing', () => {
    const state: GameState = bureauState()
    const before: GameState = structuredClone(state)

    expect(() =>
      tryApplyPropagandaBureau(
        state,
        {
          type: 'propagandaBureau',
          cardId: card(RABBIT_CARD_DEF_ID).id,
          clearing: KEEP_CLEARING,
          pieceId: KEEP_WARRIOR_ID,
        },
        buildCraftContext(state),
      ),
    ).toThrow(RuleError)
    expect(state).toEqual(before)
  })

  it('is not offered when the only matching clearing is the Keep clearing', () => {
    const state: GameState = bureauState()
    const eyrie = state.players[EYRIE_SEAT]!
    eyrie.hand = [card(RABBIT_CARD_DEF_ID)]

    expect(grantedSpecs(state)).toEqual([])
  })
})

describe('Propaganda Bureau — Rule: G.1.21 Replace is remove then place', () => {
  function replaceMouseWarrior(state: GameState): void {
    tryApplyPropagandaBureau(
      state,
      {
        type: 'propagandaBureau',
        cardId: card(MOUSE_CARD_DEF_ID).id,
        clearing: MOUSE_CLEARING,
        pieceId: MOUSE_WARRIOR_ID,
      },
      buildCraftContext(state),
    )
  }

  it('Rule: 6.2.3 Field Hospitals — the Marquise may answer the removal', () => {
    const state: GameState = bureauState({
      marquiseHand: [card(MOUSE_CARD_DEF_ID, 2)],
    })

    replaceMouseWarrior(state)

    expect(state.pending).toEqual([
      {
        type: 'fieldHospital',
        victim: MARQUISE_SEAT,
        clearing: MOUSE_CLEARING,
        count: 1,
        replaced: true,
      },
    ])
    expect(warriors(state, MOUSE_CLEARING, EYRIE_SEAT)).toBe(1)
    expect(warriors(state, MOUSE_CLEARING, MARQUISE_SEAT)).toBe(0)
  })

  it('returns the warrior to its supply when Field Hospitals cannot answer', () => {
    const state: GameState = bureauState()
    const marquiseBoardBefore = state.players[MARQUISE_SEAT]!.board
    const supplyBefore: number =
      warriorSupplyOf(marquiseBoardBefore)?.warriors ?? 0

    replaceMouseWarrior(state)

    expect(state.pending).toEqual([])
    expect(warriorSupplyOf(state.players[MARQUISE_SEAT]!.board)?.warriors).toBe(
      supplyBefore + 1,
    )
    expect(warriors(state, MOUSE_CLEARING, EYRIE_SEAT)).toBe(1)
  })
})

describe('Propaganda Bureau — Coffin Makers: "Warriors removed, not replaced"', () => {
  const COFFIN_MAKERS_DEF_ID = 'ROOT-62'

  function stateWithCoffinMakers(marquiseHand: Card[]): {
    state: GameState
    coffinMakers: Card
  } {
    const coffinMakers: Card = card(COFFIN_MAKERS_DEF_ID)
    const state: GameState = bureauState({
      marquiseHand,
      eyriePlayArea: [card(PROPAGANDA_BUREAU_DEF_ID), coffinMakers],
    })
    return { state, coffinMakers }
  }

  function replaceMouseWarrior(state: GameState): void {
    tryApplyPropagandaBureau(
      state,
      {
        type: 'propagandaBureau',
        cardId: card(MOUSE_CARD_DEF_ID).id,
        clearing: MOUSE_CLEARING,
        pieceId: MOUSE_WARRIOR_ID,
      },
      buildCraftContext(state),
    )
  }

  it('does not put the replaced warrior on Coffin Makers', () => {
    const { state, coffinMakers } = stateWithCoffinMakers([])

    replaceMouseWarrior(state)

    expect(coffinMakers.heldWarriors ?? 0).toBe(0)
  })

  it('does not put it there either when Field Hospitals is declined', () => {
    const { state, coffinMakers } = stateWithCoffinMakers([
      card(MOUSE_CARD_DEF_ID, 2),
    ])
    replaceMouseWarrior(state)
    const fieldHospital = state.pending[0]
    if (fieldHospital === undefined || !isFieldHospitalEvent(fieldHospital)) {
      throw new Error('expected a Field Hospitals prompt')
    }

    fieldHospitalResolver.apply(
      state,
      {
        event: fieldHospital,
        action: { type: 'resolveEvent', decline: true },
        actor: MARQUISE_SEAT,
      },
      buildCraftContext(state),
    )

    expect(coffinMakers.heldWarriors ?? 0).toBe(0)
  })
})
