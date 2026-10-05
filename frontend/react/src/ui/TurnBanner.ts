export { buildTurnBannerViewModel } from '#ui/TurnBannerViewModel.ts'
export type { TurnBannerViewModel } from '#ui/TurnBannerViewModel.ts'

/** Vagabond item shown as board artwork instead of a text button. */
export type TurnBannerOptionItem = {
  type: string
  exhausted: boolean
  damaged: boolean
  selected: boolean
}

export type TurnBannerOption = {
  label: string
  value: string
  item?: TurnBannerOptionItem
}

export type TurnBannerComposerView = {
  message: string
  canConfirm: boolean
  canCancel: boolean
  options: readonly TurnBannerOption[]
  /** Force stepper chrome; default auto for contiguous numeric counts. */
  optionPresentation?: 'stepper' | 'buttons'
}
