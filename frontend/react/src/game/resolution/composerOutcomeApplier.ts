import type { ComposerOutcome } from '#game/resolution/ActionComposer.ts'
import type { AllianceSupporterPilePick } from '#game/resolution/allianceActionComposer.ts'
import { mergeBattleClearingHighlight } from '#game/battleOverlayModel.ts'
import type { GameState } from '#api/client.ts'
import type { GameSessionSnapshot } from '#game/GameSession.ts'
import type {
  TurnBannerClearingStepper,
  TurnBannerOption,
  TurnBannerOptionPresentation,
} from '#ui/TurnBanner.ts'

export type ComposerOutcomeApplierDeps = {
  getLatestSnapshot: () => GameSessionSnapshot | null
  syncComposerBanner: (input: {
    message: string
    canConfirm: boolean
    canCancel: boolean
    options: TurnBannerOption[]
    optionPresentation?: TurnBannerOptionPresentation
    clearingSteppers?: readonly TurnBannerClearingStepper[]
    clearingStepperBudget?: number
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
  getOptionPresentation: () => TurnBannerOptionPresentation | undefined
  getPromptOptions: () => TurnBannerOption[]
  getDiscardSelection: () => string[]
  getSupporterPilePick: () => AllianceSupporterPilePick | null
  syncSupporterPilePick: (pick: AllianceSupporterPilePick | null) => void
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
    deps.syncSupporterPilePick(null)
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
      ...(outcome.prompt.clearingSteppers !== undefined
        ? { clearingSteppers: outcome.prompt.clearingSteppers }
        : {}),
      ...(outcome.prompt.clearingStepperBudget !== undefined
        ? { clearingStepperBudget: outcome.prompt.clearingStepperBudget }
        : {}),
    })
    deps.setHighlightedClearings(
      mergeBattleClearingHighlight(outcome.prompt.highlightClearings, state),
    )
    deps.setHighlightedForests(outcome.prompt.highlightForests ?? [])
    deps.setEnabledCards(outcome.prompt.enabledCardIds)
    deps.setCardSelection(deps.getDiscardSelection())
    deps.syncSupporterPilePick(deps.getSupporterPilePick())
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
  deps.syncSupporterPilePick(null)
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
