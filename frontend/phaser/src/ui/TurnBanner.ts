export { buildTurnBannerViewModel } from '#ui/TurnBannerViewModel.ts'
export type { TurnBannerViewModel } from '#ui/TurnBannerViewModel.ts'

export type TurnBannerOption = {
  label: string
  value: string
}

export type TurnBannerComposerView = {
  message: string
  canConfirm: boolean
  canCancel: boolean
  options: readonly TurnBannerOption[]
  /** Force stepper chrome; default auto for contiguous numeric counts. */
  optionPresentation?: 'stepper' | 'buttons'
}
