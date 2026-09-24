import type { Ctx } from '#game/ctx.js'
import type { GameState } from '#state/types.js'
import type { Listener } from '#triggers/effects.js'
import { EFFECTS } from '#triggers/effects.js'
import type { GameSignal } from '#triggers/signals.js'

export class SignalBus {
  private listeners: Listener[] = []

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /** Sync dispatch to subscribers, then active card listeners in seat order. */
  emit(state: GameState, signal: GameSignal, ctx: Ctx): void {
    for (const listener of this.listeners) {
      listener(state, signal, ctx)
    }
    const players = [...state.players].sort(
      (left, right): number => left.seat - right.seat,
    )
    for (const player of players) {
      for (const card of player.playArea) {
        EFFECTS[card.defId]?.onSignal?.(state, signal, ctx)
      }
    }
  }
}
