import { describe, expect, it } from 'vitest'
import {
  shouldDisableActionTray,
  type ActionTrayDisableInput,
} from '#game/actionTrayDisable.ts'

const IDLE_LOCAL: ActionTrayDisableInput = {
  isComposerStaging: false,
  isAnyModalOpen: false,
  isLocalActor: true,
  isGameFinished: false,
}

describe('shouldDisableActionTray', () => {
  it('keeps tray on for idle local actor', () => {
    expect(shouldDisableActionTray(IDLE_LOCAL)).toBe(false)
  })

  it('disables during composer staging including Field Hospitals', () => {
    expect(
      shouldDisableActionTray({
        ...IDLE_LOCAL,
        isComposerStaging: true,
      }),
    ).toBe(true)
  })

  it('disables when a modal is open', () => {
    expect(
      shouldDisableActionTray({
        ...IDLE_LOCAL,
        isAnyModalOpen: true,
      }),
    ).toBe(true)
  })

  it('disables when not local actor', () => {
    expect(
      shouldDisableActionTray({
        ...IDLE_LOCAL,
        isLocalActor: false,
      }),
    ).toBe(true)
  })

  it('disables when game finished', () => {
    expect(
      shouldDisableActionTray({
        ...IDLE_LOCAL,
        isGameFinished: true,
      }),
    ).toBe(true)
  })
})
