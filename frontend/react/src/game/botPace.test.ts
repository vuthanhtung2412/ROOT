import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  botStepDelaySeconds,
  DEFAULT_BOT_STEP_DELAY_SECONDS,
  nextBotStepDelaySeconds,
  setBotStepDelaySeconds,
  subscribeBotPace,
  waitBotStepDelay,
} from '#game/botPace.ts'

const UNKNOWN_PACE_SECONDS = 3
const FAST_PACE_SECONDS = 1
const MEDIUM_PACE_SECONDS = 2
const SLOW_PACE_SECONDS = 5
const FAST_PACE_MILLISECONDS = 1000

describe('bot pace', () => {
  afterEach(() => {
    setBotStepDelaySeconds(DEFAULT_BOT_STEP_DELAY_SECONDS)
    vi.useRealTimers()
  })

  it('waits 5 seconds after a bot action by default', () => {
    expect(botStepDelaySeconds()).toBe(DEFAULT_BOT_STEP_DELAY_SECONDS)
  })

  it('keeps a pace that is not one of the choices out', () => {
    setBotStepDelaySeconds(UNKNOWN_PACE_SECONDS)

    expect(botStepDelaySeconds()).toBe(DEFAULT_BOT_STEP_DELAY_SECONDS)
  })

  it('tells listeners about a new pace', () => {
    const listener = vi.fn<() => void>()
    const unsubscribe: () => void = subscribeBotPace(listener)

    setBotStepDelaySeconds(FAST_PACE_SECONDS)
    unsubscribe()

    expect(listener).toHaveBeenCalledOnce()
    expect(botStepDelaySeconds()).toBe(FAST_PACE_SECONDS)
  })

  it('steps to the next faster pace, then back to the slowest', () => {
    expect(nextBotStepDelaySeconds(SLOW_PACE_SECONDS)).toBe(MEDIUM_PACE_SECONDS)
    expect(nextBotStepDelaySeconds(MEDIUM_PACE_SECONDS)).toBe(FAST_PACE_SECONDS)
    expect(nextBotStepDelaySeconds(FAST_PACE_SECONDS)).toBe(SLOW_PACE_SECONDS)
  })

  it('shortens a running wait when a faster pace is picked', async () => {
    vi.useFakeTimers()
    let waited = false
    void waitBotStepDelay().then((): void => {
      waited = true
    })

    setBotStepDelaySeconds(FAST_PACE_SECONDS)
    await vi.advanceTimersByTimeAsync(FAST_PACE_MILLISECONDS)

    expect(waited).toBe(true)
  })
})
