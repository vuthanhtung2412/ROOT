/**
 * `message`: text sent to the model. `reply`: text the model wrote.
 * `reasoning`: the thinking behind a reply, as the provider summarises it.
 * `toolCall` / `toolResult`: a tool the model ran and what it got back.
 * `failure`: why the session stopped and the seat is stuck.
 */
export const AI_PLAYER_ACTIVITY_KINDS = [
  'message',
  'reasoning',
  'reply',
  'toolCall',
  'toolResult',
  'failure',
] as const

export type AiPlayerActivityKind = (typeof AI_PLAYER_ACTIVITY_KINDS)[number]

/** One thing a session did, as the session itself knows it. */
export type AiPlayerSessionActivity = {
  kind: AiPlayerActivityKind
  /** Tool of a `toolCall` / `toolResult`, else null. */
  toolName: string | null
  /** Message, reply, tool input as JSON, tool result or failure reason. */
  text: string
  /** True for a `failure` and for a tool result the tool rejected. */
  isError: boolean
}

/** A session activity plus the AI seat it comes from. */
export type AiPlayerSeatActivity = AiPlayerSessionActivity & {
  seat: number
  model: string
}

/** What observers receive: numbered and dated by the feed. */
export type AiPlayerActivity = AiPlayerSeatActivity & {
  sequence: number
  /** ISO 8601 time. */
  at: string
}

export type AiPlayerActivityListener = (activity: AiPlayerActivity) => void

/** An observer that connects mid-turn still sees how the turn went so far. */
export const RECENT_ACTIVITY_LIMIT = 200

const FIRST_SEQUENCE = 1

/** Live output of the AI players, for the observers of the server. */
export class AiPlayerActivityFeed {
  private readonly listeners = new Set<AiPlayerActivityListener>()
  private recent: readonly AiPlayerActivity[] = []
  private nextSequence = FIRST_SEQUENCE

  publish(seatActivity: AiPlayerSeatActivity, now: Date = new Date()): void {
    const activity: AiPlayerActivity = {
      ...seatActivity,
      sequence: this.nextSequence,
      at: now.toISOString(),
    }
    this.nextSequence += 1
    this.recent = [...this.recent, activity].slice(-RECENT_ACTIVITY_LIMIT)
    for (const listener of this.listeners) {
      listener(activity)
    }
  }

  /** Returns the function that ends the subscription. */
  subscribe(listener: AiPlayerActivityListener): () => void {
    this.listeners.add(listener)
    return (): void => {
      this.listeners.delete(listener)
    }
  }

  /** Latest activities, oldest first. */
  recentActivities(): readonly AiPlayerActivity[] {
    return this.recent
  }
}

/** The feed of the server's single game slot. */
export const aiPlayerActivityFeed = new AiPlayerActivityFeed()
