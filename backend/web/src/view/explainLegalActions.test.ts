import { ACTION_GUIDE, type ActionGuideEntry } from '@root/lib'
import { describe, expect, it } from 'vitest'
import { loadRulebook, type RuleSection } from '#aiPlayer/rulebook.js'
import {
  createPlayingTwoPlayerGame,
  FIRST_TEST_PLAYER_ID,
  SECOND_TEST_PLAYER_ID,
} from '#test/gameStateFixtures.js'
import {
  explainLegalActions,
  type ExplainedAction,
} from '#view/explainLegalActions.js'

const MARQUISE_SEAT = 0

describe('ACTION_GUIDE against the Law of Root', () => {
  it('cites only rule numbers the rulebook has', () => {
    const sectionNumbers: Set<string | null> = new Set(
      loadRulebook().map((section: RuleSection): string | null => section.sectionNumber),
    )
    const staleCitations: string[] = Object.values(ACTION_GUIDE).flatMap(
      (entry: ActionGuideEntry): string[] =>
        entry.ruleSections.filter(
          (ruleSection: string): boolean => !sectionNumbers.has(ruleSection),
        ),
    )

    expect(staleCitations).toEqual([])
  })
})

describe('explainLegalActions', () => {
  it('explains the Marquise march with kind, titled rules and schema, no params', () => {
    const game = createPlayingTwoPlayerGame()

    const explained: ExplainedAction[] = explainLegalActions(
      game,
      FIRST_TEST_PLAYER_ID,
      loadRulebook(),
    )
    const march: ExplainedAction | undefined = explained.find(
      (action: ExplainedAction): boolean => action.type === 'march',
    )

    expect(march).toMatchObject({
      type: 'march',
      actor: MARQUISE_SEAT,
      kind: 'March',
      rules: [
        { section: '6.5.2', title: 'March' },
        { section: '4.2', title: 'Move' },
      ],
      schema: { properties: { moves: { type: 'array' } } },
    })
    expect(march).not.toHaveProperty('params')
  })

  it('drops the actions of other seats', () => {
    const game = createPlayingTwoPlayerGame()

    expect(
      explainLegalActions(game, SECOND_TEST_PLAYER_ID, loadRulebook()),
    ).toEqual([])
    expect(explainLegalActions(game, 'stranger', loadRulebook())).toEqual([])
  })

  it('keeps every seat when no player scopes the list', () => {
    const game = createPlayingTwoPlayerGame()

    expect(
      explainLegalActions(game, null, loadRulebook()).map(
        (action: ExplainedAction): string => action.type,
      ),
    ).toEqual(game.legalActions().map((spec): string => spec.type))
  })
})
