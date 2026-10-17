import { botHasTrait } from '#factions/bots/botSettings.js'
import type { Ctx } from '#game/ctx.js'
import type { LogEntry } from '#log/types.js'
import type { Piece, Seat } from '#pieces/types.js'
import { playerOf } from '#queries/seat.js'
import type { GameState } from '#state/types.js'

/** Trait War Tax — points the owner of a destroyed building or token loses. */
const WAR_TAX_VICTORY_POINTS = 1

/** Trait War Tax — each building or token the Eyrie destroys costs its owner 1 VP. */
export function warTax(
  state: GameState,
  destruction: { remover: Seat; removed: readonly Piece[] },
  ctx: Ctx | undefined,
): LogEntry[] {
  const { remover, removed } = destruction
  if (!botHasTrait(state, remover, 'warTax')) return []
  const logs: LogEntry[] = []
  for (const piece of removed) {
    if (piece.owner === remover || (piece.kind !== 'building' && piece.kind !== 'token')) continue
    const owner = playerOf(state, piece.owner)
    // Rule: 7.7.1 — the score track has no space below zero.
    const lost = Math.min(WAR_TAX_VICTORY_POINTS, owner.vp)
    if (lost === 0) continue
    owner.vp -= lost
    logs.push({ t: 'vp', actor: piece.owner, delta: -lost, reason: 'war tax' })
    ctx?.emit({ s: 'vp', actor: piece.owner, delta: -lost })
  }
  return logs
}
