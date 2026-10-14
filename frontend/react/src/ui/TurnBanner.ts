export { buildTurnBannerViewModel } from '#ui/TurnBannerViewModel.ts'
export type { TurnBannerViewModel } from '#ui/TurnBannerViewModel.ts'

/** Vagabond item shown as board artwork instead of a text button. */
export type TurnBannerOptionItem = {
  type: string
  exhausted: boolean
  damaged: boolean
  selected: boolean
}

/** Map piece (warrior / building / token) shown as click-to-remove artwork. */
export type TurnBannerOptionPiece = {
  kind: string
  type?: string
  selected: boolean
  /** Pre-resolved so warriors can use faction meeple art. */
  imagePath: string | null
  /** When true, tile is shown but cannot be toggled (forced removals). */
  locked?: boolean
}

export type TurnBannerOption = {
  label: string
  value: string
  item?: TurnBannerOptionItem
  piece?: TurnBannerOptionPiece
  /** Suit drawn as its icon in place of the label (fox / mouse / rabbit / bird). */
  suit?: string
  /** Icon drawn before the label (see `optionIconFor`). */
  iconId?: string
  /** Grid presentation: the row this option belongs to (one pick per row). */
  group?: string
  /** Grid presentation: the option picked in its row. */
  selected?: boolean
}

/**
 * `stepper` / `buttons` sit in the banner (default: auto for contiguous
 * numeric counts); `grid` opens one modal with a row of options per group.
 */
export type TurnBannerOptionPresentation = 'stepper' | 'buttons' | 'grid'

export type TurnBannerComposerView = {
  message: string
  canConfirm: boolean
  canCancel: boolean
  options: readonly TurnBannerOption[]
  optionPresentation?: TurnBannerOptionPresentation
}
