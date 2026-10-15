import { describe, expect, it, vi } from 'vitest'
import type { Game } from '@root/lib'
import {
  ACT_TOOL_NAME,
  ACTION_CHOICES_TOOL_NAME,
  ACTIONS_TOOL_NAME,
  AI_PLAYER_TOOL_DEFINITIONS,
  LOG_TOOL_NAME,
  PREVIEW_TOOL_NAME,
  RULES_TOOL_NAME,
  runAiPlayerTool,
  SHOW_TOOL_NAME,
  type AiPlayerToolContext,
  type AiPlayerToolDefinition,
} from '#aiPlayer/aiPlayerTools.js'
import { listDescribedLegalActions } from '#aiPlayer/aiPlayerActionReport.js'
import type { RuleSection } from '#aiPlayer/rulebook.js'
import {
  createPlayingTwoPlayerGame,
  createStartedTwoPlayerGame,
  FIRST_TEST_PLAYER_ID,
  KEEP_CORNER_ACTION,
  SECOND_TEST_PLAYER_ID,
} from '#test/gameStateFixtures.js'
import { listPlayerLegalActions } from '#view/playerView.js'

const RULEBOOK_FIXTURE: RuleSection[] = [
  { sectionNumber: '4.2', title: 'Move.', text: 'Move from a clearing you rule.' },
  { sectionNumber: '4.3', title: 'Battle', text: 'Roll two dice.' },
]

function createToolContext(
  game: Game,
  playerId: string,
): AiPlayerToolContext {
  return {
    game,
    playerId,
    rulebook: RULEBOOK_FIXTURE,
    onGameChanged: vi.fn<() => void>(),
  }
}

describe('AI player tools', () => {
  it('offers the core tools first, then the helpers, each with an object input schema', () => {
    expect(
      AI_PLAYER_TOOL_DEFINITIONS.map(
        (definition: AiPlayerToolDefinition): string => definition.name,
      ),
    ).toEqual(['show', 'actions', 'rules', 'act', 'actionChoices', 'log', 'card', 'clearing', 'score', 'workshops', 'sympathy', 'decree', 'preview'])
    for (const definition of AI_PLAYER_TOOL_DEFINITIONS) {
      expect(definition.inputJsonSchema.type).toBe('object')
    }
  })

  it('show: own hand in full, the other hand and join id hidden', () => {
    const game = createStartedTwoPlayerGame()
    const otherHandSize = game.state.players[0]?.hand.length ?? 0

    const result = runAiPlayerTool(
      createToolContext(game, SECOND_TEST_PLAYER_ID),
      { name: SHOW_TOOL_NAME, input: {} },
    )

    expect(result.isError).toBe(false)
    expect(otherHandSize).toBeGreaterThan(0)
    expect(result.content).toContain(SECOND_TEST_PLAYER_ID)
    expect(result.content).not.toContain(FIRST_TEST_PLAYER_ID)
    expect(result.content.match(/HIDDEN#hand-0-/g)).toHaveLength(otherHandSize)
    expect(result.content).not.toContain('HIDDEN#hand-1-')
    expect(result.content).toContain('paths (clearing-clearing):')
  })

  it('actionChoices: only the actions of the own seat', () => {
    const game = createStartedTwoPlayerGame()

    const waiting = runAiPlayerTool(
      createToolContext(game, SECOND_TEST_PLAYER_ID),
      { name: ACTION_CHOICES_TOOL_NAME, input: {} },
    )
    const acting = runAiPlayerTool(
      createToolContext(game, FIRST_TEST_PLAYER_ID),
      { name: ACTION_CHOICES_TOOL_NAME, input: {} },
    )

    expect(JSON.parse(waiting.content)).toEqual([])
    expect(JSON.parse(acting.content)).toMatchObject([
      { type: 'resolveEvent', actor: 0 },
    ])
  })

  it('actions: the own action types with kind, rules and schema, no values', () => {
    const game = createPlayingTwoPlayerGame()

    const waiting = runAiPlayerTool(
      createToolContext(game, SECOND_TEST_PLAYER_ID),
      { name: ACTIONS_TOOL_NAME, input: {} },
    )
    const acting = runAiPlayerTool(
      createToolContext(game, FIRST_TEST_PLAYER_ID),
      { name: ACTIONS_TOOL_NAME, input: {} },
    )

    expect(JSON.parse(waiting.content)).toEqual([])
    expect(JSON.parse(acting.content)).toContainEqual({
      type: 'march',
      actor: 0,
      kind: 'March',
      rules: [{ section: '4.2', title: 'Move' }],
      schema: expect.objectContaining({ required: ['type', 'moves'] }),
    })
    expect(acting.content).not.toContain('"params"')
  })

  it('log: no join id of any seat, newest lines only', () => {
    const game = createStartedTwoPlayerGame()

    const result = runAiPlayerTool(
      createToolContext(game, SECOND_TEST_PLAYER_ID),
      { name: LOG_TOOL_NAME, input: { limit: 1 } },
    )
    const fullLog = runAiPlayerTool(
      createToolContext(game, SECOND_TEST_PLAYER_ID),
      { name: LOG_TOOL_NAME, input: {} },
    )

    expect(result.content.split('\n')).toHaveLength(1)
    expect(fullLog.content).toContain('JOIN (marquise)')
    expect(fullLog.content).not.toContain(FIRST_TEST_PLAYER_ID)
  })

  it('rules: returns matching sections', () => {
    const context = createToolContext(
      createStartedTwoPlayerGame(),
      SECOND_TEST_PLAYER_ID,
    )

    const found = runAiPlayerTool(context, {
      name: RULES_TOOL_NAME,
      input: { query: '4.3' },
    })
    const missing = runAiPlayerTool(context, {
      name: RULES_TOOL_NAME,
      input: { query: 'submarine' },
    })

    expect(found.content).toBe('4.3 Battle\nRoll two dice.')
    expect(missing.isError).toBe(false)
    expect(missing.content).toContain('No rule matches')
  })

  it('act: applies a legal action of the own seat and reports the change', () => {
    const game = createStartedTwoPlayerGame()
    const context = createToolContext(game, FIRST_TEST_PLAYER_ID)
    const historyLengthBefore = game.history.length

    const result = runAiPlayerTool(context, {
      name: ACT_TOOL_NAME,
      input: { action: { ...KEEP_CORNER_ACTION } },
    })

    expect(result).toMatchObject({ isError: false, appliedAction: true })
    expect(game.history.length).toBe(historyLengthBefore + 1)
    expect(context.onGameChanged).toHaveBeenCalledTimes(1)
  })

  it('act: the result carries the next legal actions of the seat', () => {
    const game = createStartedTwoPlayerGame()
    const context = createToolContext(game, FIRST_TEST_PLAYER_ID)

    const result = runAiPlayerTool(context, {
      name: ACT_TOOL_NAME,
      input: { action: { ...KEEP_CORNER_ACTION } },
    })

    const nextLegalActions = listDescribedLegalActions(
      game,
      FIRST_TEST_PLAYER_ID,
    )
    expect(nextLegalActions.length).toBeGreaterThan(0)
    // Only the field on offer, not every field an answer may ever take.
    expect(nextLegalActions[0]?.shape).toBe(
      '{type: "resolveEvent", clearing?: number}',
    )
    expect(JSON.parse(result.content)).toEqual({
      applied: 'RESOLVE EVENT',
      log: expect.any(Array),
      phase: `${game.state.phase}/${game.state.step}`,
      yourTurn: true,
      legalActions: nextLegalActions,
    })
  })

  it('act: with nothing left to do, the result names who the game waits for', () => {
    const game = createStartedTwoPlayerGame()
    const context = createToolContext(game, FIRST_TEST_PLAYER_ID)
    let lastContent = ''

    while (listPlayerLegalActions(game, FIRST_TEST_PLAYER_ID).length > 0) {
      const clearing: number | undefined = listPlayerLegalActions(
        game,
        FIRST_TEST_PLAYER_ID,
      )[0]?.params?.clearing?.[0]
      lastContent = runAiPlayerTool(context, {
        name: ACT_TOOL_NAME,
        input: { action: { type: 'resolveEvent', clearing: clearing ?? 0 } },
      }).content
    }

    expect(JSON.parse(lastContent)).toMatchObject({
      legalActions: [],
      waitingFor: ['eyrie'],
    })
    expect(lastContent).not.toContain(SECOND_TEST_PLAYER_ID)
  })

  it('preview: answers like act but applies nothing', () => {
    const game = createStartedTwoPlayerGame()
    const context = createToolContext(game, FIRST_TEST_PLAYER_ID)
    const historyLengthBefore = game.history.length

    const legal = runAiPlayerTool(context, {
      name: PREVIEW_TOOL_NAME,
      input: { action: { ...KEEP_CORNER_ACTION } },
    })
    const illegal = runAiPlayerTool(context, {
      name: PREVIEW_TOOL_NAME,
      input: { action: { type: 'resolveEvent', clearing: 5 } },
    })
    const otherSeat = runAiPlayerTool(
      createToolContext(game, SECOND_TEST_PLAYER_ID),
      { name: PREVIEW_TOOL_NAME, input: { action: { ...KEEP_CORNER_ACTION } } },
    )

    expect(legal).toMatchObject({ isError: false, appliedAction: false })
    expect(JSON.parse(legal.content)).toMatchObject({
      legal: true,
      nextLegalActionTypes: ['resolveEvent'],
    })
    expect(illegal).toMatchObject({ isError: true, appliedAction: false })
    expect(otherSeat.content).toContain('NOT_YOUR_SEAT')
    expect(game.history.length).toBe(historyLengthBefore)
    expect(context.onGameChanged).not.toHaveBeenCalled()
  })

  it('act: refuses an action that belongs to another seat', () => {
    const game = createStartedTwoPlayerGame()
    const context = createToolContext(game, SECOND_TEST_PLAYER_ID)
    const historyLengthBefore = game.history.length

    const result = runAiPlayerTool(context, {
      name: ACT_TOOL_NAME,
      input: { action: { ...KEEP_CORNER_ACTION } },
    })

    expect(result).toMatchObject({ isError: true, appliedAction: false })
    expect(result.content).toContain('NOT_YOUR_SEAT')
    expect(game.history.length).toBe(historyLengthBefore)
    expect(context.onGameChanged).not.toHaveBeenCalled()
  })

  it('act: returns a rule error without changing the game', () => {
    const game = createStartedTwoPlayerGame()
    const context = createToolContext(game, FIRST_TEST_PLAYER_ID)
    const historyLengthBefore = game.history.length

    const result = runAiPlayerTool(context, {
      name: ACT_TOOL_NAME,
      input: { action: { type: 'resolveEvent', clearing: 5 } },
    })

    expect(result).toMatchObject({ isError: true, appliedAction: false })
    expect(result.content).toContain('not applied')
    expect(game.history.length).toBe(historyLengthBefore)
  })

  it('act: a malformed action comes back with the shape the engine expects', () => {
    const game = createStartedTwoPlayerGame()
    const context = createToolContext(game, FIRST_TEST_PLAYER_ID)

    const result = runAiPlayerTool(context, {
      name: ACT_TOOL_NAME,
      input: { action: { type: 'resolveEvent', clearing: 'top left' } },
    })

    expect(result).toMatchObject({ isError: true, appliedAction: false })
    expect(result.content).toContain('MALFORMED_ACTION')
    expect(result.content).toContain('clearing?: number')
  })

  it('act: an action that crashes the engine comes back as an error to correct', () => {
    const game = createStartedTwoPlayerGame()
    const context = createToolContext(game, FIRST_TEST_PLAYER_ID)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(game, 'apply').mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'length')")
    })

    const result = runAiPlayerTool(context, {
      name: ACT_TOOL_NAME,
      input: { action: KEEP_CORNER_ACTION },
    })

    expect(result).toMatchObject({ isError: true, appliedAction: false })
    expect(result.content).toContain('ENGINE_ERROR')
    expect(result.content).toContain("reading 'length'")
    expect(context.onGameChanged).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('reports bad input and unknown tools as errors', () => {
    const context = createToolContext(
      createStartedTwoPlayerGame(),
      FIRST_TEST_PLAYER_ID,
    )

    expect(
      runAiPlayerTool(context, { name: ACT_TOOL_NAME, input: {} }).isError,
    ).toBe(true)
    expect(
      runAiPlayerTool(context, { name: RULES_TOOL_NAME, input: {} }).isError,
    ).toBe(true)
    expect(
      runAiPlayerTool(context, { name: 'snapshot', input: {} }).isError,
    ).toBe(true)
  })
})
