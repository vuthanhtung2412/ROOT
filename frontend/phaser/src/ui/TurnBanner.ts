import type Phaser from 'phaser'
import { gameViewSize } from '#game/hiDpi.ts'
import {
  formatCountStepperLabel,
  selectedCountStepperOption,
  shouldPresentAsCountStepper,
  stepCountStepper,
  type CountStepperOption,
  type CountStepperState,
} from '#ui/countStepper.ts'
import type { TurnBannerViewModel } from '#ui/TurnBannerViewModel.ts'

export { buildTurnBannerViewModel } from '#ui/TurnBannerViewModel.ts'
export type { TurnBannerViewModel } from '#ui/TurnBannerViewModel.ts'

export type TurnBannerOption = {
  label: string
  value: string
}

export type TurnBannerHandlers = {
  onConfirm: () => void
  onCancel: () => void
  onPickOption?: (value: string) => void
}

export type TurnBannerComposerView = {
  message: string
  canConfirm: boolean
  canCancel: boolean
  options: readonly TurnBannerOption[]
  /** Force stepper chrome; default auto for contiguous numeric counts. */
  optionPresentation?: 'stepper' | 'buttons'
}

const BANNER_STATUS_FONT_SIZE_PIXELS = 20
const BANNER_CONTROL_FONT_SIZE_PIXELS = 15
const BANNER_OPTION_FONT_SIZE_PIXELS = 14
const BANNER_STEPPER_ARROW_FONT_SIZE_PIXELS = 18
const BANNER_STEPPER_VALUE_FONT_SIZE_PIXELS = 16
const BANNER_PANEL_HEIGHT_STATUS_PIXELS = 44
const BANNER_PANEL_HEIGHT_COMPOSER_PIXELS = 68
const BANNER_ROOT_Y_PIXELS = 32
const BANNER_COMPOSER_STATUS_OFFSET_Y_PIXELS = -16
const BANNER_OPTION_ROW_Y_PIXELS = 16
/** Inset from panel left/right edge to control button center. */
const BANNER_CONTROL_CORNER_INSET_PIXELS = 28
/** Reserve each side so status text clears corner controls. */
const BANNER_STATUS_SIDE_RESERVE_PIXELS = 48
const BANNER_CANCEL_LABEL = 'X'
const BANNER_CONFIRM_LABEL = 'OK'

/**
 * Single top strip: turn status, or composer prompt + controls when staging.
 */
export class TurnBanner {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private readonly panel: Phaser.GameObjects.Rectangle
  private readonly statusText: Phaser.GameObjects.Text
  private readonly confirmButton: Phaser.GameObjects.Text
  private readonly cancelButton: Phaser.GameObjects.Text
  private optionNodes: Phaser.GameObjects.GameObject[] = []
  private handlers: TurnBannerHandlers
  private lastView: TurnBannerViewModel | null = null
  private lastComposer: TurnBannerComposerView | null = null
  private countStepper: CountStepperState | null = null
  private lastPaintKey: string | null = null

  constructor(scene: Phaser.Scene, handlers: TurnBannerHandlers) {
    this.scene = scene
    this.handlers = handlers
    const { width } = gameViewSize()
    const bannerWidth = Math.min(640, width - 24)

    this.panel = scene.add
      .rectangle(0, 0, bannerWidth, BANNER_PANEL_HEIGHT_STATUS_PIXELS, 0x0a0a0a, 0.45)
      .setStrokeStyle(1, 0xf0e6d3, 0.25)

    this.statusText = scene.add
      .text(0, 0, '', {
        fontFamily: 'Georgia, serif',
        fontSize: `${String(BANNER_STATUS_FONT_SIZE_PIXELS)}px`,
        color: '#f0e6d3',
        align: 'center',
        wordWrap: {
          width: bannerWidth - BANNER_STATUS_SIDE_RESERVE_PIXELS * 2,
        },
      })
      .setOrigin(0.5)

    this.confirmButton = scene.add
      .text(0, 0, BANNER_CONFIRM_LABEL, {
        fontFamily: 'monospace',
        fontSize: `${String(BANNER_CONTROL_FONT_SIZE_PIXELS)}px`,
        color: '#1a1a1a',
        backgroundColor: '#a8d8a8',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)

    this.cancelButton = scene.add
      .text(0, 0, BANNER_CANCEL_LABEL, {
        fontFamily: 'monospace',
        fontSize: `${String(BANNER_CONTROL_FONT_SIZE_PIXELS)}px`,
        color: '#1a1a1a',
        backgroundColor: '#d8a8a8',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)

    this.confirmButton.on('pointerdown', () => {
      this.handleConfirm()
    })
    this.cancelButton.on('pointerdown', () => {
      this.handlers.onCancel()
    })

    this.root = scene.add
      .container(width / 2, BANNER_ROOT_Y_PIXELS, [
        this.panel,
        this.statusText,
        this.confirmButton,
        this.cancelButton,
      ])
      .setDepth(130)
  }

  setHandlers(handlers: TurnBannerHandlers): void {
    this.handlers = handlers
  }

  syncTurn(viewModel: TurnBannerViewModel): void {
    this.lastView = viewModel
    this.repaint()
  }

  syncComposer(composer: TurnBannerComposerView | null): void {
    this.lastComposer = composer
    this.syncCountStepperFromComposer(composer)
    this.repaint()
  }

  private syncCountStepperFromComposer(
    composer: TurnBannerComposerView | null,
  ): void {
    if (composer === null) {
      this.countStepper = null
      return
    }
    const options: CountStepperOption[] = composer.options.map((option) => ({
      label: option.label,
      value: option.value,
    }))
    if (
      !shouldPresentAsCountStepper(options, composer.optionPresentation)
    ) {
      this.countStepper = null
      return
    }
    const previousValue =
      this.countStepper !== null
        ? selectedCountStepperOption(this.countStepper)?.value
        : undefined
    const previousIndex =
      previousValue === undefined
        ? 0
        : options.findIndex((option) => option.value === previousValue)
    this.countStepper = {
      options,
      selectedIndex: previousIndex >= 0 ? previousIndex : 0,
    }
  }

  private handleConfirm(): void {
    if (this.countStepper !== null) {
      const selected = selectedCountStepperOption(this.countStepper)
      if (selected !== null) {
        this.handlers.onPickOption?.(selected.value)
        return
      }
    }
    this.handlers.onConfirm()
  }

  private repaint(): void {
    const paintKey = JSON.stringify({
      view: this.lastView,
      composer: this.lastComposer,
      stepperIndex: this.countStepper?.selectedIndex ?? null,
    })
    if (paintKey === this.lastPaintKey) {
      return
    }
    this.lastPaintKey = paintKey

    for (const node of this.optionNodes) {
      node.destroy()
    }
    this.optionNodes = []

    const view = this.lastView
    if (view === null) {
      return
    }

    const composer = this.lastComposer
    const halfWidth = this.panel.width / 2

    if (composer === null) {
      this.statusText.setText(
        `${view.actorFaction} · ${view.phase}/${view.step} — ${view.prompt}`,
      )
      this.statusText.setPosition(0, 0)
      this.confirmButton.setVisible(false)
      this.cancelButton.setVisible(false)
      this.panel.setSize(this.panel.width, BANNER_PANEL_HEIGHT_STATUS_PIXELS)
      return
    }

    const useStepper = this.countStepper !== null
    const hasOptionRow = useStepper || composer.options.length > 0
    const statusOffsetY = hasOptionRow ? BANNER_COMPOSER_STATUS_OFFSET_Y_PIXELS : 0
    this.statusText.setText(`${view.actorFaction} · ${composer.message}`)
    this.statusText.setPosition(0, statusOffsetY)

    const showConfirm = composer.canConfirm || useStepper
    const showCancel = composer.canCancel
    this.confirmButton.setVisible(showConfirm)
    this.cancelButton.setVisible(showCancel)
    this.layoutControlButtons({
      halfWidth,
      statusOffsetY,
      showConfirm,
      showCancel,
    })

    if (useStepper && this.countStepper !== null) {
      this.paintCountStepper(this.countStepper)
      this.panel.setSize(this.panel.width, BANNER_PANEL_HEIGHT_COMPOSER_PIXELS)
      return
    }

    composer.options.forEach((option, index) => {
      const button = this.scene.add
        .text(
          (index - (composer.options.length - 1) / 2) * 100,
          BANNER_OPTION_ROW_Y_PIXELS,
          option.label,
          {
            fontFamily: 'monospace',
            fontSize: `${String(BANNER_OPTION_FONT_SIZE_PIXELS)}px`,
            color: '#1a1a1a',
            backgroundColor: '#c8d8f0',
            padding: { x: 8, y: 4 },
          },
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      button.on('pointerdown', () => {
        this.handlers.onPickOption?.(option.value)
      })
      this.root.add(button)
      this.optionNodes.push(button)
    })

    this.panel.setSize(
      this.panel.width,
      hasOptionRow
        ? BANNER_PANEL_HEIGHT_COMPOSER_PIXELS
        : BANNER_PANEL_HEIGHT_STATUS_PIXELS,
    )
  }

  /**
   * X left corner, OK right corner.
   */
  private layoutControlButtons(input: {
    halfWidth: number
    statusOffsetY: number
    showConfirm: boolean
    showCancel: boolean
  }): void {
    const { halfWidth, statusOffsetY, showConfirm, showCancel } = input
    if (showCancel) {
      this.cancelButton.setPosition(
        -halfWidth + BANNER_CONTROL_CORNER_INSET_PIXELS,
        statusOffsetY,
      )
    }
    if (showConfirm) {
      this.confirmButton.setPosition(
        halfWidth - BANNER_CONTROL_CORNER_INSET_PIXELS,
        statusOffsetY,
      )
    }
  }

  private paintCountStepper(state: CountStepperState): void {
    const selected = selectedCountStepperOption(state)
    if (selected === null) {
      return
    }
    const atMin = state.selectedIndex <= 0
    const atMax = state.selectedIndex >= state.options.length - 1

    const previousButton = this.scene.add
      .text(-96, BANNER_OPTION_ROW_Y_PIXELS, '<', {
        fontFamily: 'monospace',
        fontSize: `${String(BANNER_STEPPER_ARROW_FONT_SIZE_PIXELS)}px`,
        color: atMin ? '#6a6a6a' : '#1a1a1a',
        backgroundColor: atMin ? '#9a9a9a' : '#c8d8f0',
        padding: { x: 12, y: 5 },
      })
      .setOrigin(0.5)
    if (!atMin) {
      previousButton.setInteractive({ useHandCursor: true })
      previousButton.on('pointerdown', () => {
        if (this.countStepper === null) {
          return
        }
        this.countStepper = stepCountStepper(this.countStepper, -1)
        this.repaint()
      })
    }

    const center = this.scene.add
      .text(0, BANNER_OPTION_ROW_Y_PIXELS, formatCountStepperLabel(selected), {
        fontFamily: 'monospace',
        fontSize: `${String(BANNER_STEPPER_VALUE_FONT_SIZE_PIXELS)}px`,
        color: '#f0e6d3',
        backgroundColor: '#1a1408cc',
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5)

    const nextButton = this.scene.add
      .text(96, BANNER_OPTION_ROW_Y_PIXELS, '>', {
        fontFamily: 'monospace',
        fontSize: `${String(BANNER_STEPPER_ARROW_FONT_SIZE_PIXELS)}px`,
        color: atMax ? '#6a6a6a' : '#1a1a1a',
        backgroundColor: atMax ? '#9a9a9a' : '#c8d8f0',
        padding: { x: 12, y: 5 },
      })
      .setOrigin(0.5)
    if (!atMax) {
      nextButton.setInteractive({ useHandCursor: true })
      nextButton.on('pointerdown', () => {
        if (this.countStepper === null) {
          return
        }
        this.countStepper = stepCountStepper(this.countStepper, 1)
        this.repaint()
      })
    }

    this.root.add(previousButton)
    this.root.add(center)
    this.root.add(nextButton)
    this.optionNodes.push(previousButton, center, nextButton)
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
