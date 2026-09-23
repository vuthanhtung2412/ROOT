import type { ComposerOutcome } from '#game/ActionComposer.ts'
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
    deps.setEnabledCards(outcome.prompt.enabledCardIds)
    deps.setCardSelection(deps.getDiscardSelection())
    deps.syncBattleOverlay(outcome.prompt.message)
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
  if (state !== null) {
    deps.syncBattleClearingHighlight(state)
  } else {
    deps.setHighlightedClearings([])
  }
  if (snapshot !== null) {
    deps.syncBoardPieces(snapshot)
  }
}
