/**
 * Frontend action under resolution = composer draft not idle.
 * Not in GameState until POST. See resources/notes/frontend-vs-registered-actions.md.
 * Flows live in frontend/phaser/src/game/resolution/.
 */
export const COMPOSER_DRAFT_IDLE_TYPE = 'idle'

export type ComposerDraftView = {
  type: string
}

/** True while any faction/event composer holds a non-idle draft. */
export function isActionUnderResolution(
  drafts: ReadonlyArray<ComposerDraftView>,
): boolean {
  return drafts.some((draft) => draft.type !== COMPOSER_DRAFT_IDLE_TYPE)
}
