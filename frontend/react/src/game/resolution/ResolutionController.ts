import type { ComposerOutcome } from '#game/resolution/ActionComposer.ts'
import {
  clearingPickPromptToComposer,
  isResolutionCancelled,
  optionPickPromptToComposer,
  ResolutionCancelled,
  type ClearingPickPrompt,
  type ClearingPickResult,
  type MarchMove,
  type OptionPickPrompt,
  type ResolutionPaint,
  type ResolutionPromptOption,
  type ResolutionUi,
} from '#game/resolution/ResolutionUi.ts'

type ClearingWaiter = {
  kind: 'clearing'
  allowedClearings: ReadonlySet<number>
  allowConfirm: boolean
  resolve: (result: ClearingPickResult) => void
  reject: (error: ResolutionCancelled) => void
}

type OptionWaiter = {
  kind: 'option'
  allowedValues: ReadonlySet<string>
  resolve: (value: string) => void
  reject: (error: ResolutionCancelled) => void
}

type Waiter = ClearingWaiter | OptionWaiter

export type ResolutionControllerDeps = {
  /** Called synchronously when a pick starts (before Promise settles). */
  onPaint: (paint: ResolutionPaint) => void
}

/**
 * Promise bridge: procedural workflows await picks; UI events resolve waiters.
 */
export class ResolutionController implements ResolutionUi {
  private readonly onPaint: (paint: ResolutionPaint) => void
  private waiter: Waiter | null = null
  private active = false
  private marchPreview: MarchMove | null = null
  private lastOptions: ResolutionPromptOption[] = []
  private lastOutcome: ComposerOutcome = { kind: 'idle' }

  constructor(deps: ResolutionControllerDeps) {
    this.onPaint = deps.onPaint
  }

  isActive(): boolean {
    return this.active
  }

  getMarchPreviewMove(): MarchMove | null {
    return this.marchPreview
  }

  getPromptOptions(): ResolutionPromptOption[] {
    return this.lastOptions
  }

  getLastOutcome(): ComposerOutcome {
    return this.lastOutcome
  }

  beginSession(): void {
    this.active = true
    this.marchPreview = null
    this.lastOptions = []
  }

  endSession(): void {
    this.active = false
    this.waiter = null
    this.marchPreview = null
    this.lastOptions = []
    this.lastOutcome = { kind: 'idle' }
  }

  setMarchPreview(move: MarchMove | null): void {
    this.marchPreview = move
  }

  pickClearing(prompt: ClearingPickPrompt): Promise<ClearingPickResult> {
    const composerPrompt = clearingPickPromptToComposer(prompt)
    this.lastOptions = []
    this.lastOutcome = { kind: 'incomplete', prompt: composerPrompt }
    this.onPaint({ prompt: composerPrompt, options: [] })
    return new Promise<ClearingPickResult>((resolve, reject) => {
      this.waiter = {
        kind: 'clearing',
        allowedClearings: new Set(prompt.clearings),
        allowConfirm: prompt.canConfirm === true,
        resolve,
        reject,
      }
    })
  }

  pickOption(prompt: OptionPickPrompt): Promise<string> {
    const composerPrompt = optionPickPromptToComposer(prompt)
    this.lastOptions = prompt.options
    this.lastOutcome = { kind: 'incomplete', prompt: composerPrompt }
    this.onPaint({ prompt: composerPrompt, options: prompt.options })
    return new Promise<string>((resolve, reject) => {
      this.waiter = {
        kind: 'option',
        allowedValues: new Set(prompt.options.map((option) => option.value)),
        resolve,
        reject,
      }
    })
  }

  chooseClearing(clearingId: number): ComposerOutcome | null {
    if (this.waiter === null || this.waiter.kind !== 'clearing') {
      return null
    }
    if (!this.waiter.allowedClearings.has(clearingId)) {
      return this.lastOutcome.kind === 'incomplete' ? this.lastOutcome : null
    }
    const { resolve } = this.waiter
    this.waiter = null
    resolve({ kind: 'clearing', clearingId })
    return this.lastOutcome
  }

  chooseOption(value: string): ComposerOutcome | null {
    if (this.waiter === null || this.waiter.kind !== 'option') {
      return null
    }
    if (!this.waiter.allowedValues.has(value)) {
      return this.lastOutcome.kind === 'incomplete' ? this.lastOutcome : null
    }
    const { resolve } = this.waiter
    this.waiter = null
    resolve(value)
    return this.lastOutcome
  }

  confirm(): ComposerOutcome | null {
    if (this.waiter === null || this.waiter.kind !== 'clearing') {
      return null
    }
    if (!this.waiter.allowConfirm) {
      return null
    }
    const { resolve } = this.waiter
    this.waiter = null
    resolve({ kind: 'confirm' })
    return this.lastOutcome
  }

  cancel(): ComposerOutcome {
    const waiter = this.waiter
    this.waiter = null
    this.marchPreview = null
    this.lastOptions = []
    this.active = false
    this.lastOutcome = { kind: 'idle' }
    if (waiter !== null) {
      waiter.reject(new ResolutionCancelled())
    }
    return { kind: 'idle' }
  }
}

export { isResolutionCancelled, ResolutionCancelled }
