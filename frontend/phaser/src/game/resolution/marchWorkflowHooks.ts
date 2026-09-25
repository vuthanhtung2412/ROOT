import type { ActionSpec } from '#api/client.ts'
import type {
  ActionComposerHooks,
  ClientAction,
  ComposerOutcome,
} from '#game/resolution/ActionComposer.ts'
import {
  isResolutionCancelled,
  ResolutionController,
} from '#game/resolution/ResolutionController.ts'
import type { MarchMove } from '#game/resolution/ResolutionUi.ts'
import {
  resolveMarch,
  type MarchBoardSource,
} from '#game/resolution/workflows/march.ts'

export type MarchWorkflowHooks = {
  hooks: ActionComposerHooks
  isActive: () => boolean
  getMarchPreviewMove: () => MarchMove | null
  getPromptOptions: () => Array<{ label: string; value: string }>
  /** Wire after GameScene can apply outcomes (paints + ready). */
  setOnOutcome: (handler: (outcome: ComposerOutcome) => void) => void
}

/**
 * Adapts procedural resolveMarch into ActionComposerHooks.
 */
export function createMarchWorkflowHooks(
  board?: MarchBoardSource,
): MarchWorkflowHooks {
  let onOutcome: (outcome: ComposerOutcome) => void = () => undefined

  const controller = new ResolutionController({
    onPaint: (paint) => {
      onOutcome({
        kind: 'incomplete',
        prompt: paint.prompt,
      })
    },
  })

  const hooks: ActionComposerHooks = {
    begin: (spec: ActionSpec): ComposerOutcome | null => {
      if (spec.type !== 'march') {
        return null
      }
      if (controller.isActive()) {
        controller.cancel()
      }
      controller.beginSession()
      void resolveMarch(spec, controller, board)
        .then((action: ClientAction) => {
          controller.endSession()
          onOutcome({ kind: 'ready', action })
        })
        .catch((error: unknown) => {
          if (isResolutionCancelled(error)) {
            return
          }
          controller.endSession()
          throw error
        })
      return controller.getLastOutcome()
    },

    chooseClearing: (clearingId: number): ComposerOutcome | null => {
      if (!controller.isActive()) {
        return null
      }
      return controller.chooseClearing(clearingId)
    },

    chooseColumn: (value: string): ComposerOutcome | null => {
      if (!controller.isActive()) {
        return null
      }
      return controller.chooseOption(value)
    },

    confirm: (): ComposerOutcome | null => {
      if (!controller.isActive()) {
        return null
      }
      return controller.confirm()
    },

    cancel: (): ComposerOutcome | null => {
      if (!controller.isActive()) {
        return null
      }
      return controller.cancel()
    },
  }

  return {
    hooks,
    isActive: () => controller.isActive(),
    getMarchPreviewMove: () => controller.getMarchPreviewMove(),
    getPromptOptions: () => controller.getPromptOptions(),
    setOnOutcome: (handler) => {
      onOutcome = handler
    },
  }
}
