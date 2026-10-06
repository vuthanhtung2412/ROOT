import type { TurnBannerOptionPresentation } from '#ui/TurnBanner.ts'

export type CountStepperOption = {
  label: string
  value: string
}

/**
 * True when values are unique contiguous integers (e.g. 1..N warrior counts).
 */
export function isContiguousNumericOptionDomain(
  options: readonly CountStepperOption[],
): boolean {
  if (options.length === 0) {
    return false
  }
  const numbers: number[] = []
  for (const option of options) {
    const parsed = Number(option.value)
    if (!Number.isInteger(parsed)) {
      return false
    }
    numbers.push(parsed)
  }
  const unique = [...new Set(numbers)].sort((left, right) => left - right)
  if (unique.length !== numbers.length) {
    return false
  }
  const first = unique[0]
  if (first === undefined) {
    return false
  }
  for (let index = 0; index < unique.length; index += 1) {
    if (unique[index] !== first + index) {
      return false
    }
  }
  return true
}

export function shouldPresentAsCountStepper(
  options: readonly CountStepperOption[],
  presentation: TurnBannerOptionPresentation | undefined,
): boolean {
  if (options.length === 0) {
    return false
  }
  if (presentation === 'buttons' || presentation === 'grid') {
    return false
  }
  if (presentation === 'stepper') {
    return true
  }
  return isContiguousNumericOptionDomain(options)
}

/** Center label: prefer `N x noun` when value is an integer and label names a noun. */
export function formatCountStepperLabel(option: CountStepperOption): string {
  // Already in target form (incl. multi-part battle labels)
  if (/\d+\s+x\s+/i.test(option.label)) {
    return option.label.trim()
  }
  const count = Number(option.value)
  if (!Number.isInteger(count)) {
    return option.label
  }
  const warriorMatch = /^(\d+)\s+warriors?$/i.exec(option.label.trim())
  if (warriorMatch !== null) {
    return `${String(count)} x warriors`
  }
  const nounMatch = /^(\d+)\s+(.+)$/i.exec(option.label.trim())
  if (nounMatch !== null) {
    const noun = nounMatch[2]
    if (noun !== undefined && noun.length > 0) {
      return `${String(count)} x ${noun}`
    }
  }
  return option.label
}

export type CountStepperState = {
  options: readonly CountStepperOption[]
  selectedIndex: number
}

export function clampStepperIndex(
  selectedIndex: number,
  optionCount: number,
): number {
  if (optionCount <= 0) {
    return 0
  }
  if (selectedIndex < 0) {
    return 0
  }
  if (selectedIndex >= optionCount) {
    return optionCount - 1
  }
  return selectedIndex
}

export function stepCountStepper(
  state: CountStepperState,
  direction: -1 | 1,
): CountStepperState {
  const nextIndex = clampStepperIndex(
    state.selectedIndex + direction,
    state.options.length,
  )
  return {
    options: state.options,
    selectedIndex: nextIndex,
  }
}

export function selectedCountStepperOption(
  state: CountStepperState,
): CountStepperOption | null {
  return state.options[state.selectedIndex] ?? null
}
