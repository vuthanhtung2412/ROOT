import { describe, expect, it } from 'vitest'
import {
  actionJsonSchema,
  assertActionShape,
  describeActionShape,
  type ActionFieldValue,
} from '#actions/actionShape.js'
import type { Action } from '#actions/types.js'
import { RuleError } from '#rules/RuleError.js'
import { createLobbyGame } from '#test/fixtures.js'

type UncheckedAction = { type: string } & Record<string, ActionFieldValue>

/** An action as a client sends it: JSON whose fields nobody checked yet. */
function isSentAsAction(sent: { type: string }): sent is Action {
  return typeof sent.type === 'string'
}

function sentAction(sent: UncheckedAction): Action {
  if (!isSentAsAction(sent)) {
    throw new Error('fixture needs a "type"')
  }
  return sent
}

function malformedDetailOf(action: Action): RuleError['detail'] {
  try {
    assertActionShape(action)
  } catch (error) {
    if (error instanceof RuleError && error.code === 'MALFORMED_ACTION') {
      return error.detail
    }
    throw error
  }
  return null
}

describe('assertActionShape', () => {
  it('accepts well-formed actions, optional fields present or not', () => {
    const actions: Action[] = [
      { type: 'endPhase' },
      { type: 'addToDecree', cards: [{ cardId: 'ROOT-226#1', column: 'build' }] },
      { type: 'march', moves: [{ from: 1, to: 2, count: 3 }] },
      { type: 'slip', to: 'forest:2' },
      { type: 'slip', to: 4 },
      { type: 'resolveEvent', leader: 'commander' },
      { type: 'resolveEvent' },
      { type: 'eyrieEmigre', from: 1, to: 2, count: 1 },
    ]

    for (const action of actions) {
      expect(malformedDetailOf(action)).toBeNull()
    }
  })

  it('names the missing field and the expected shape', () => {
    const flatDecreeAdd = sentAction({
      type: 'addToDecree',
      cardId: 'ROOT-226#1',
      column: 'build',
    })

    expect(malformedDetailOf(flatDecreeAdd)).toEqual({
      field: 'cards',
      expected:
        '{type: "addToDecree", cards: list of {cardId: text, column: text}}',
      action: flatDecreeAdd,
    })
  })

  it('rejects a field that holds the wrong kind of value', () => {
    const wrongKinds: Action[] = [
      sentAction({ type: 'battle', clearing: '5', defender: 1 }),
      sentAction({ type: 'discard', cardIds: 'ROOT-1#1' }),
      sentAction({ type: 'march', moves: [{ from: 1, to: 2 }] }),
      sentAction({ type: 'riverfolkCraft', cardId: 'ROOT-1#1', exportCard: 1 }),
      sentAction({ type: 'resolveEvent', order: ['0', '1'] }),
      sentAction({ type: 'crusadeMove', from: 1, to: 2, count: Number.NaN }),
      sentAction({ type: 'march', moves: [{ from: 1, to: 2, count: 1.5 }] }),
      sentAction({ type: 'crusadeMove', from: 1, to: 2, count: 0 }),
    ]

    expect(wrongKinds.map(malformedDetailOf)).toMatchObject([
      { field: 'clearing' },
      { field: 'cardIds' },
      { field: 'moves' },
      { field: 'exportCard' },
      { field: 'order' },
      { field: 'count' },
      { field: 'moves' },
      { field: 'count' },
    ])
  })

  it('takes null on an optional field as the field left out', () => {
    const action = sentAction({
      type: 'eyrieEmigre',
      from: 1,
      to: 2,
      count: 1,
      defender: null,
    })

    expect(malformedDetailOf(action)).toBeNull()
  })

  it('rejects an action type the game does not know', () => {
    expect(malformedDetailOf(sentAction({ type: 'summonDragon' }))).toMatchObject(
      { field: 'type' },
    )
  })
})

describe('describeActionShape', () => {
  it('writes the fields an action takes, optional ones marked', () => {
    expect(describeActionShape('discard')).toBe(
      '{type: "discard", cardIds: list of text}',
    )
    expect(describeActionShape('endPhase')).toBe('{type: "endPhase"}')
    expect(describeActionShape('decree')).toContain('clearing?: number')
  })

  it('keeps only the offered optional fields, and every required one', () => {
    expect(describeActionShape('resolveEvent', ['clearing'])).toBe(
      '{type: "resolveEvent", clearing?: number}',
    )
    expect(describeActionShape('decree', [])).toBe(
      '{type: "decree", column: text, cardId: text}',
    )
  })

  it('knows nothing about a type the game does not have', () => {
    expect(describeActionShape('teleport')).toBeNull()
  })
})

describe('Game.apply', () => {
  it('refuses a malformed action as a rule error, the game unchanged', () => {
    const game = createLobbyGame()
    const historyLengthBefore = game.history.length

    expect(() =>
      game.apply(sentAction({ type: 'addToDecree', cardId: 'ROOT-226#1' })),
    ).toThrow(RuleError)
    expect(game.history.length).toBe(historyLengthBefore)
  })
})

describe('actionJsonSchema', () => {
  it('writes the march moves as numbered from, to and a whole count', () => {
    expect(actionJsonSchema('march')).toMatchObject({
      type: 'object',
      properties: {
        type: { const: 'march' },
        moves: {
          type: 'array',
          items: {
            properties: {
              from: { type: 'number' },
              to: { type: 'number' },
              count: { type: 'integer', minimum: 1, maximum: 25 },
            },
            required: ['from', 'to', 'count'],
          },
        },
      },
      required: ['type', 'moves'],
    })
  })

  it('leaves out the dialect and the closed-object noise', () => {
    const schemaText: string = JSON.stringify(actionJsonSchema('march'))

    expect(schemaText).not.toContain('$schema')
    expect(schemaText).not.toContain('additionalProperties')
  })

  it('knows nothing about a type the game does not have', () => {
    expect(actionJsonSchema('teleport')).toBeNull()
  })
})
