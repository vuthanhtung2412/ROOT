import {
  ACTION_GUIDE,
  actionJsonSchema,
  type ActionGuideEntry,
  type ActionSpec,
  type Game,
  type Seat,
} from '@root/lib'
import type { z } from 'zod'
import type { RuleSection } from '#aiPlayer/rulebook.js'
import { redactLegalActionsForViewer } from '#view/redactLegalActionsForViewer.js'

export type ExplainedRule = {
  section: string
  title: string
}

/** A legal action type in plain words: what it is called, its rules, its JSON Schema. */
export type ExplainedAction = {
  type: string
  actor: Seat
  kind: string
  rules: ExplainedRule[]
  schema: z.core.JSONSchema.JSONSchema | null
}

/** Rule titles end with a full stop in the Law of Root (`6.5.2 March.`). */
const TITLE_TRAILING_STOP_PATTERN = /\.$/

function isGuidedActionType(type: string): type is keyof typeof ACTION_GUIDE {
  return Object.hasOwn(ACTION_GUIDE, type)
}

function guideEntryOf(type: string): ActionGuideEntry {
  return isGuidedActionType(type)
    ? ACTION_GUIDE[type]
    : { kind: type, ruleSections: [] }
}

function explainedRulesOf(
  ruleSections: readonly string[],
  rulebook: readonly RuleSection[],
): ExplainedRule[] {
  return ruleSections.flatMap((sectionNumber: string): ExplainedRule[] => {
    const found: RuleSection | undefined = rulebook.find(
      (section: RuleSection): boolean => section.sectionNumber === sectionNumber,
    )
    return found === undefined
      ? []
      : [
          {
            section: sectionNumber,
            title: found.title.replace(TITLE_TRAILING_STOP_PATTERN, ''),
          },
        ]
  })
}

function isFirstOfTypeAndActor(
  spec: ActionSpec,
  index: number,
  specs: readonly ActionSpec[],
): boolean {
  return (
    specs.findIndex(
      (candidate: ActionSpec): boolean =>
        candidate.type === spec.type && candidate.actor === spec.actor,
    ) === index
  )
}

/**
 * The legal action types of `GET /game/actions` (`params` left out), each
 * with its plain name, the rules that cover it and its JSON Schema. A
 * `playerId` keeps the actions of that player's seat only; null keeps all.
 */
export function explainLegalActions(
  game: Game,
  playerId: string | null,
  rulebook: readonly RuleSection[],
): ExplainedAction[] {
  const specs: ActionSpec[] =
    playerId === null
      ? game.legalActions()
      : redactLegalActionsForViewer(game.legalActions(), game.state, playerId)
  return specs
    .filter(isFirstOfTypeAndActor)
    .map((spec: ActionSpec): ExplainedAction => {
      const guideEntry: ActionGuideEntry = guideEntryOf(spec.type)
      return {
        type: spec.type,
        actor: spec.actor,
        kind: guideEntry.kind,
        rules: explainedRulesOf(guideEntry.ruleSections, rulebook),
        schema: actionJsonSchema(spec.type),
      }
    })
}
