import { setTimeout as wait } from 'node:timers/promises'
import type { AiPlayerActivity } from '@root/web-client/ai-player-api'
import { aiPlayerApi } from '#api/client.js'

/** A `show` result is a whole board: one screen of it is enough to follow. */
const MAXIMUM_TEXT_LENGTH = 600
const TRUNCATION_MARK = ' …'
const RECONNECT_DELAY_MILLISECONDS = 2000
const TIME_START_INDEX = 11
const TIME_END_INDEX = 19
const CONTINUATION_INDENT = '    '

const KIND_LABELS: Record<AiPlayerActivity['kind'], string> = {
  message: 'TOLD',
  reasoning: 'THINKS',
  reply: 'SAYS',
  toolCall: 'CALL',
  toolResult: 'GOT',
  failure: 'FAILED',
}

export type AiStreamOptions = {
  /** Print every text whole instead of cutting long ones. */
  showFullText: boolean
}

function shorten(text: string, options: AiStreamOptions): string {
  if (options.showFullText || text.length <= MAXIMUM_TEXT_LENGTH) {
    return text
  }
  return `${text.slice(0, MAXIMUM_TEXT_LENGTH)}${TRUNCATION_MARK}`
}

export function formatAiPlayerActivity(
  activity: AiPlayerActivity,
  options: AiStreamOptions,
): string {
  const time = activity.at.slice(TIME_START_INDEX, TIME_END_INDEX)
  const tool = activity.toolName === null ? '' : ` ${activity.toolName}`
  const error =
    activity.isError && activity.kind !== 'failure' ? ' (error)' : ''
  const text = shorten(activity.text, options).replaceAll(
    '\n',
    `\n${CONTINUATION_INDENT}`,
  )
  return `${time} seat ${String(activity.seat)} ${activity.model} ${KIND_LABELS[activity.kind]}${tool}${error}\n${CONTINUATION_INDENT}${text}`
}

/**
 * Print what the AI players do, as they do it. Never ends by itself: when the
 * server is down or restarts, it waits and connects again.
 */
export async function cmdAiStream(options: AiStreamOptions): Promise<void> {
  let lastSequence = 0
  let previousAt = ''
  // Said once per outage, not on every attempt to connect again.
  let lastNotice = ''
  const notice = (text: string): void => {
    if (text !== lastNotice) {
      console.error(`ai-stream: ${text}`)
    }
    lastNotice = text
  }
  for (;;) {
    try {
      await aiPlayerApi.streamAiPlayerActivity(
        (activity: AiPlayerActivity): void => {
          // After a reconnect the server sends its latest activities again.
          // A restarted server counts from one again, at a later time.
          const isRepeated =
            activity.sequence <= lastSequence && activity.at <= previousAt
          if (isRepeated) {
            return
          }
          lastSequence = activity.sequence
          previousAt = activity.at
          lastNotice = ''
          console.log(formatAiPlayerActivity(activity, options))
        },
      )
      notice('server closed the stream, connecting again')
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error)
      notice(`waiting for the server (${reason})`)
    }
    await wait(RECONNECT_DELAY_MILLISECONDS)
  }
}
