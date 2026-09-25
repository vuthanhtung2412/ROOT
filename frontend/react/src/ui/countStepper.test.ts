import { describe, expect, it } from 'vitest'
import {
  formatCountStepperLabel,
  isContiguousNumericOptionDomain,
  selectedCountStepperOption,
  shouldPresentAsCountStepper,
  stepCountStepper,
  type CountStepperOption,
} from '#ui/countStepper.ts'

const warriorCounts: CountStepperOption[] = [
  { label: '1 warrior', value: '1' },
  { label: '2 warriors', value: '2' },
  { label: '3 warriors', value: '3' },
]

describe('isContiguousNumericOptionDomain', () => {
  it('accepts 1..N warrior counts', () => {
    expect(isContiguousNumericOptionDomain(warriorCounts)).toBe(true)
  })

  it('rejects gaps and non-numeric values', () => {
    expect(
      isContiguousNumericOptionDomain([
        { label: '1', value: '1' },
        { label: '3', value: '3' },
      ]),
    ).toBe(false)
    expect(
      isContiguousNumericOptionDomain([
        { label: 'recruit', value: 'recruit' },
        { label: 'move', value: 'move' },
      ]),
    ).toBe(false)
  })
})

describe('shouldPresentAsCountStepper', () => {
  it('auto-detects contiguous numeric domains', () => {
    expect(shouldPresentAsCountStepper(warriorCounts, undefined)).toBe(true)
  })

  it('honors explicit presentation', () => {
    expect(
      shouldPresentAsCountStepper(
        [{ label: '1 x sawmill', value: 'b1' }],
        'stepper',
      ),
    ).toBe(true)
    expect(shouldPresentAsCountStepper(warriorCounts, 'buttons')).toBe(false)
  })
})

describe('formatCountStepperLabel', () => {
  it('formats warrior labels as N x warriors', () => {
    expect(formatCountStepperLabel({ label: '2 warriors', value: '2' })).toBe(
      '2 x warriors',
    )
  })

  it('keeps typed x labels', () => {
    expect(
      formatCountStepperLabel({ label: '1 x sawmill', value: 'b1' }),
    ).toBe('1 x sawmill')
  })
})

describe('stepCountStepper', () => {
  it('clamps at ends', () => {
    const start = { options: warriorCounts, selectedIndex: 0 }
    expect(stepCountStepper(start, -1).selectedIndex).toBe(0)
    const atEnd = { options: warriorCounts, selectedIndex: 2 }
    expect(stepCountStepper(atEnd, 1).selectedIndex).toBe(2)
    expect(selectedCountStepperOption(stepCountStepper(start, 1))?.value).toBe(
      '2',
    )
  })
})
