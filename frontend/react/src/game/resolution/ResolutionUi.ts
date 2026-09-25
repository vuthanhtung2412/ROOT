import type { ComposerPrompt } from '#game/resolution/ActionComposer.ts'

export type ResolutionPromptOption = {
  label: string
  value: string
}

export type ClearingPickPrompt = {
  message: string
  clearings: number[]
  canConfirm?: boolean
  canCancel?: boolean
}

export type OptionPickPrompt = {
  message: string
  clearings: number[]
  options: ResolutionPromptOption[]
  canConfirm?: boolean
  canCancel?: boolean
}

export type ClearingPickResult =
  | { kind: 'clearing'; clearingId: number }
  | { kind: 'confirm' }

export type MarchMove = {
  from: number
  to: number
  count: number
}

/**
 * Temporal-like UI activities for procedural resolution workflows.
 * Each pick paints HUD then awaits player input.
 */
export type ResolutionUi = {
  pickClearing: (prompt: ClearingPickPrompt) => Promise<ClearingPickResult>
  pickOption: (prompt: OptionPickPrompt) => Promise<string>
  setMarchPreview: (move: MarchMove | null) => void
}

export type ResolutionPaint = {
  prompt: ComposerPrompt
  options: ResolutionPromptOption[]
}

export class ResolutionCancelled extends Error {
  readonly name = 'ResolutionCancelled'

  constructor() {
    super('Resolution cancelled')
  }
}

export function isResolutionCancelled(error: unknown): error is ResolutionCancelled {
  return error instanceof ResolutionCancelled
}

export function clearingPickPromptToComposer(
  prompt: ClearingPickPrompt,
): ComposerPrompt {
  return {
    message: prompt.message,
    highlightClearings: prompt.clearings,
    enabledCardIds: null,
    canConfirm: prompt.canConfirm === true,
    canCancel: prompt.canCancel !== false,
  }
}

export function optionPickPromptToComposer(
  prompt: OptionPickPrompt,
): ComposerPrompt {
  return {
    message: prompt.message,
    highlightClearings: prompt.clearings,
    enabledCardIds: null,
    canConfirm: prompt.canConfirm === true,
    canCancel: prompt.canCancel !== false,
  }
}
