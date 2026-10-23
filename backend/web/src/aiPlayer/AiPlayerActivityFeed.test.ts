import { describe, expect, it, vi } from 'vitest'
import {
  AiPlayerActivityFeed,
  RECENT_ACTIVITY_LIMIT,
  type AiPlayerActivityListener,
  type AiPlayerRoomActivity,
} from '#aiPlayer/AiPlayerActivityFeed.js'

const PUBLISHED_AT = new Date('2026-10-13T20:00:00.000Z')

function makeSeatActivity(text: string): AiPlayerRoomActivity {
  return {
    kind: 'reply',
    toolName: null,
    text,
    isError: false,
    roomCode: null,
    seat: 1,
    model: 'anthropic:claude-opus-5-5',
  }
}

describe('AiPlayerActivityFeed', () => {
  it('numbers and dates an activity and hands it to every subscriber', () => {
    const feed = new AiPlayerActivityFeed()
    const listener = vi.fn<AiPlayerActivityListener>()
    feed.subscribe(listener)

    feed.publish(makeSeatActivity('I march to the roost'), PUBLISHED_AT)

    expect(listener).toHaveBeenCalledWith({
      ...makeSeatActivity('I march to the roost'),
      sequence: 1,
      at: '2026-10-13T20:00:00.000Z',
    })
  })

  it('stops handing activities to a subscriber that left', () => {
    const feed = new AiPlayerActivityFeed()
    const listener = vi.fn<AiPlayerActivityListener>()
    const unsubscribe = feed.subscribe(listener)

    unsubscribe()
    feed.publish(makeSeatActivity('unseen'))

    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps only the latest activities for late observers', () => {
    const feed = new AiPlayerActivityFeed()
    const publishedCount = RECENT_ACTIVITY_LIMIT + 1

    for (let index = 0; index < publishedCount; index += 1) {
      feed.publish(makeSeatActivity(`reply ${String(index)}`))
    }

    const recent = feed.recentActivities()
    expect(recent).toHaveLength(RECENT_ACTIVITY_LIMIT)
    expect(recent[0]?.sequence).toBe(2)
    expect(recent.at(-1)?.sequence).toBe(publishedCount)
  })
})
