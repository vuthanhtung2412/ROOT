import type { AiModels, AiPlayer } from '#api/client.ts'

/** AI seats of the game on screen, and the models a host may give them. */
export type AiPlayerStoreState = {
  aiPlayers: readonly AiPlayer[]
  /** Offered models as `<provider>:<modelId>`; empty until loaded. */
  models: readonly string[]
  defaultModel: string | null
}

type AiPlayerStoreListener = () => void

const INITIAL_AI_PLAYER_STORE_STATE: AiPlayerStoreState = {
  aiPlayers: [],
  models: [],
  defaultModel: null,
}

let aiPlayerStoreState: AiPlayerStoreState = INITIAL_AI_PLAYER_STORE_STATE
const listeners = new Set<AiPlayerStoreListener>()

function publish(next: AiPlayerStoreState): void {
  aiPlayerStoreState = next
  for (const listener of listeners) {
    listener()
  }
}

function isSameAiPlayer(left: AiPlayer, right: AiPlayer | undefined): boolean {
  return (
    right !== undefined &&
    left.seat === right.seat &&
    left.model === right.model &&
    left.status === right.status
  )
}

export function getAiPlayerSnapshot(): AiPlayerStoreState {
  return aiPlayerStoreState
}

export function subscribeAiPlayers(listener: AiPlayerStoreListener): () => void {
  listeners.add(listener)
  return (): void => {
    listeners.delete(listener)
  }
}

/** Every game push carries the AI seats; unchanged lists do not re-render. */
export function setAiPlayers(aiPlayers: readonly AiPlayer[]): void {
  const current: readonly AiPlayer[] = aiPlayerStoreState.aiPlayers
  const isUnchanged: boolean =
    current.length === aiPlayers.length &&
    aiPlayers.every((aiPlayer: AiPlayer, index: number): boolean =>
      isSameAiPlayer(aiPlayer, current[index]),
    )
  if (!isUnchanged) {
    publish({ ...aiPlayerStoreState, aiPlayers })
  }
}

export function setAiModels(aiModels: AiModels): void {
  publish({
    ...aiPlayerStoreState,
    models: aiModels.models,
    defaultModel: aiModels.defaultModel,
  })
}

export function findAiPlayer(
  aiPlayers: readonly AiPlayer[],
  seat: number,
): AiPlayer | null {
  return (
    aiPlayers.find((aiPlayer: AiPlayer): boolean => aiPlayer.seat === seat) ??
    null
  )
}

const MODEL_PROVIDER_SEPARATOR = ':'

/** `anthropic:claude-opus-5-5` reads as `claude-opus-5-5` on a seat. */
export function modelDisplayName(model: string): string {
  const separatorIndex: number = model.indexOf(MODEL_PROVIDER_SEPARATOR)
  return separatorIndex < 0
    ? model
    : model.slice(separatorIndex + MODEL_PROVIDER_SEPARATOR.length)
}
