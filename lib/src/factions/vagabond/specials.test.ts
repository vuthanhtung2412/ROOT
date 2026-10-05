import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionSpec, VagabondItemChoice } from '#actions/types.js'
import { EP_CARD_DEFS } from '#cards/ep.generated.js'
import type { Card, CardSuit } from '#cards/types.js'
import { VAGABOND, assignVagabondCharacter } from '#factions/Vagabond.js'
import { boardOf } from '#factions/vagabond/items.js'
import { Game } from '#game/Game.js'
import { FALL } from '#map/fall.js'
import { resetPlaceIds } from '#rules/place.js'
import { RuleError } from '#rules/RuleError.js'
import type { VagabondCharacter } from '#state/boards.js'
import type { GameState } from '#state/types.js'
import {
  card,
  finishSetup,
  minimalState,
  player,
  testContext,
  withPieces,
} from '#test/fixtures.js'

const VAGABOND_SEAT = 1

function clearingOfSuit(suit: string): number {
  const clearing = FALL.clearings.find((entry) => entry.suit === suit)
  if (clearing === undefined) throw new Error(`no ${suit} clearing`)
  return clearing.id
}

function cardOfSuit(suit: CardSuit): Card {
  const definition = EP_CARD_DEFS.find((entry) => entry.suit === suit)
  if (definition === undefined) throw new Error(`no ${suit} card`)
  return card(definition.defId)
}

/** Vagabond of `character` on a fox clearing in Daylight, with start items. */
function daylightStateFor(
  character: VagabondCharacter,
  discard: Card[],
): GameState {
  const state = withPieces(
    minimalState({
      factions: ['marquise', 'vagabond'],
      players: [player(0, 'marquise'), player(VAGABOND_SEAT, 'vagabond')],
      currentSeat: VAGABOND_SEAT,
      phase: 'daylight',
      step: 'actions',
      deck: { draw: [], discard },
    }),
    clearingOfSuit('fox'),
    [
      { id: 'pawn-1', kind: 'pawn', owner: VAGABOND_SEAT },
      { id: 'warrior-0', kind: 'warrior', owner: 0 },
    ],
  )
  assignVagabondCharacter(state, VAGABOND_SEAT, character)
  state.players[0]!.hand = [card('ROOT-1')]
  return state
}

function specOfType(state: GameState, type: string): ActionSpec | undefined {
  return VAGABOND.legalActions(state, testContext({ state })).find(
    (spec) => spec.type === type,
  )
}

describe('Vagabond character specials', () => {
  beforeEach(() => resetPlaceIds())

  it('Rule: Appendix D — each character only gets its own special action', () => {
    const fox = cardOfSuit('fox')
    const specials = (character: VagabondCharacter): string[] => {
      const state = daylightStateFor(character, [fox])
      boardOf(state, VAGABOND_SEAT).damaged = [{ type: 'sword', exhausted: false }]
      return ['steal', 'dayLabor', 'hideout'].filter(
        (type) => specOfType(state, type) !== undefined,
      )
    }

    expect(specials('thief')).toEqual(['steal'])
    expect(specials('tinker')).toEqual(['dayLabor'])
    expect(specials('ranger')).toEqual(['hideout'])
  })

  it('Rule: D.2.2 Day Labor — offers discard cards matching the clearing, plus birds', () => {
    const fox = cardOfSuit('fox')
    const mouse = cardOfSuit('mouse')
    const bird = cardOfSuit('bird')
    const state = daylightStateFor('tinker', [fox, mouse, bird])

    expect(specOfType(state, 'dayLabor')?.params?.cardIds).toEqual([
      fox.id,
      bird.id,
    ])
  })

  it('Rule: D.2.2 Day Labor — exhaust a torch, take the card into hand', () => {
    const fox = cardOfSuit('fox')
    const mouse = cardOfSuit('mouse')
    const state = daylightStateFor('tinker', [fox, mouse])

    VAGABOND.apply(
      state,
      { type: 'dayLabor', cardId: fox.id },
      testContext({ state }),
    )

    const board = boardOf(state, VAGABOND_SEAT)
    expect(state.players[VAGABOND_SEAT]!.hand).toEqual([fox])
    expect(state.deck.discard).toEqual([mouse])
    expect(board.satchel.find((item) => item.type === 'torch')?.exhausted).toBe(
      true,
    )
    expect(specOfType(state, 'dayLabor')).toBeUndefined()
  })

  it('Rule: D.2.2 Day Labor — rejects a card whose suit does not match', () => {
    const mouse = cardOfSuit('mouse')
    const state = daylightStateFor('tinker', [mouse])

    expect(() => {
      VAGABOND.apply(
        state,
        { type: 'dayLabor', cardId: mouse.id },
        testContext({ state }),
      )
    }).toThrow(RuleError)
    expect(state.deck.discard).toEqual([mouse])
  })

  it('Rule: D.3.2 Hideout — choose three of the damaged items', () => {
    const state = daylightStateFor('ranger', [])
    boardOf(state, VAGABOND_SEAT).damaged = [
      { type: 'sword', exhausted: false },
      { type: 'boot', exhausted: true },
      { type: 'hammer', exhausted: false },
      { type: 'tea', exhausted: false },
    ]

    const params = specOfType(state, 'hideout')?.params

    expect(params?.itemCount).toEqual([3])
    expect(params?.vagabondItems).toHaveLength(4)
  })

  it('Rule: D.3.2 Hideout — rejects the wrong number of items', () => {
    const state = daylightStateFor('ranger', [])
    const board = boardOf(state, VAGABOND_SEAT)
    board.damaged = [
      { type: 'sword', exhausted: false },
      { type: 'boot', exhausted: false },
    ]
    const tooFew: VagabondItemChoice[] = [
      { type: 'sword', exhausted: false, damaged: true },
    ]

    expect(() => {
      VAGABOND.apply(
        state,
        { type: 'hideout', items: tooFew },
        testContext({ state }),
      )
    }).toThrow(RuleError)
    expect(board.damaged).toHaveLength(2)
  })

  it('Rule: D.3.2 Hideout — repairs the items, then Daylight ends', () => {
    const game = Game.create({ seed: 11, factions: ['marquise', 'vagabond'] })
    game.join('a')
    game.join('b')
    game.start()
    finishSetup(game, { character: 'ranger' })
    const { state } = game
    const board = boardOf(state, VAGABOND_SEAT)
    const clearing = state.clearings[clearingOfSuit('fox')]!
    clearing.pieces = [
      ...clearing.pieces,
      { id: 'pawn-1', kind: 'pawn', owner: VAGABOND_SEAT },
    ]
    board.forest = null
    board.damaged = [
      { type: 'sword', exhausted: true },
      { type: 'hammer', exhausted: false },
    ]
    state.currentSeat = VAGABOND_SEAT
    state.phase = 'daylight'
    state.step = 'actions'
    const items: VagabondItemChoice[] = [
      { type: 'sword', exhausted: true, damaged: true },
      { type: 'hammer', exhausted: false, damaged: true },
    ]

    game.apply({ type: 'hideout', items })

    expect(board.damaged).toEqual([])
    expect(board.satchel).toContainEqual({ type: 'sword', exhausted: true })
    expect(board.satchel).toContainEqual({ type: 'hammer', exhausted: false })
    expect(board.satchel.find((item) => item.type === 'torch')?.exhausted).toBe(
      true,
    )
    expect(state.phase).toBe('evening')
  })
})
