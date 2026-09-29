import type { ComposerOutcome } from '#game/resolution/ActionComposer.ts'
import { mergeBattleClearingHighlight } from '#game/battleOverlayModel.ts'
import type { GameState } from '#api/client.ts'
import type { GameSessionSnapshot } from '#game/GameSession.ts'

export type ComposerOutcomeApplierDeps = {
  getLatestSnapshot: () => GameSessionSnapshot | null
  syncComposerBanner: (input: {
    message: string
    canConfirm: boolean
    canCancel: boolean
    options: Array<{ label: string; value: string }>
    optionPresentation?: 'stepper' | 'buttons'
  } | null) => void
  syncLeaderPick: (leaders: string[] | null) => void
  setHighlightedClearings: (clearingIds: number[]) => void
  setHighlightedForests: (forestIndexes: number[]) => void
  syncBattleClearingHighlight: (state: GameState) => void
  setEnabledCards: (cardIds: string[] | null) => void
  setCardSelection: (cardIds: string[]) => void
  syncBattleOverlay: (prompt: string | null) => void
  syncBoardPieces: (snapshot: GameSessionSnapshot) => void
  resetComposer: () => void
  submitAction: (action: { type: string; [key: string]: unknown }) => void
  getLeaderPickLeaders: () => string[] | null
  getOptionPresentation: () => 'stepper' | 'buttons' | undefined
  getPromptOptions: () => Array<{ label: string; value: string }>
  getDiscardSelection: () => string[]
  /** Skip battle overlay when Field Hospitals owns the prompt. */
  getOverlayKind: () => 'fieldHospital' | 'battle' | null
}

/** Apply ActionComposer outcome to HUD widgets + optional action submit. */
export function applyComposerOutcomeToHud(
  outcome: ComposerOutcome,
  deps: ComposerOutcomeApplierDeps,
): void {
  const snapshot = deps.getLatestSnapshot()
  const state = snapshot?.state ?? null

  if (outcome.kind === 'ready') {
    deps.syncComposerBanner(null)
    deps.syncLeaderPick(null)
    if (state !== null) {
      deps.syncBattleClearingHighlight(state)
    } else {
      deps.setHighlightedClearings([])
    }
    deps.setHighlightedForests([])
    deps.setEnabledCards(null)
    deps.setCardSelection([])
    deps.resetComposer()
    if (snapshot !== null) {
      deps.syncBoardPieces(snapshot)
    }
    deps.submitAction(outcome.action)
    return
  }

  if (outcome.kind === 'incomplete') {
    const pickingLeader = deps.getLeaderPickLeaders()
    deps.syncLeaderPick(pickingLeader)
    const overlayKind = deps.getOverlayKind()
    const optionPresentation = deps.getOptionPresentation()
    deps.syncComposerBanner({
      message: outcome.prompt.message,
      canConfirm: outcome.prompt.canConfirm,
      canCancel: outcome.prompt.canCancel,
      options: pickingLeader !== null ? [] : deps.getPromptOptions(),
      ...(optionPresentation !== undefined ? { optionPresentation } : {}),
    })
    deps.setHighlightedClearings(
      mergeBattleClearingHighlight(outcome.prompt.highlightClearings, state),
    )
    deps.setHighlightedForests(outcome.prompt.highlightForests ?? [])
    deps.setEnabledCards(outcome.prompt.enabledCardIds)
    deps.setCardSelection(deps.getDiscardSelection())
    if (overlayKind !== 'fieldHospital') {
      deps.syncBattleOverlay(outcome.prompt.message)
    }
    if (snapshot !== null) {
      deps.syncBoardPieces(snapshot)
    }
    return
  }

  deps.syncComposerBanner(null)
  deps.syncLeaderPick(null)
  deps.setEnabledCards(null)
  deps.setCardSelection([])
  deps.syncBattleOverlay(null)
  deps.setHighlightedForests([])
  if (state !== null) {
    deps.syncBattleClearingHighlight(state)
  } else {
    deps.setHighlightedClearings([])
  }
  if (snapshot !== null) {
    deps.syncBoardPieces(snapshot)
  }
}
