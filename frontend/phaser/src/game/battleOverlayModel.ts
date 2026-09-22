import type { GameState } from '#api/client.ts'
import type { BattleOverlayViewModel } from '#ui/BattleOverlay.ts'

type BattlePending = {
  clearing: number
  stage: string
  attacker: number
  defender: number
  rolls: readonly [number, number] | null
  hits: { attacker: number; defender: number }
}

/**
 * Read first pending battle into overlay view-model.
 */
export function buildBattleOverlayViewModel(
  state: GameState,
  prompt: string | null = null,
): BattleOverlayViewModel | null {
  const battle = readBattlePending(state.pending[0])
  if (battle === null) {
    return null
  }
  return {
    clearing: battle.clearing,
    stage: battle.stage,
    attackerFaction: factionLabel(state, battle.attacker),
    defenderFaction: factionLabel(state, battle.defender),
    rolls: battle.rolls,
    hits: battle.hits,
    prompt,
  }
}

function factionLabel(state: GameState, seat: number): string {
  const player = state.players.find((entry) => entry.seat === seat)
  return player?.faction ?? state.factions[seat] ?? `seat ${String(seat)}`
}

function readBattlePending(event: unknown): BattlePending | null {
  if (typeof event !== 'object' || event === null) {
    return null
  }
  if (Reflect.get(event, 'type') !== 'battle') {
    return null
  }
  const clearing = Reflect.get(event, 'clearing')
  const stage = Reflect.get(event, 'stage')
  const attacker = Reflect.get(event, 'attacker')
  const defender = Reflect.get(event, 'defender')
  const hitsRaw = Reflect.get(event, 'hits')
  if (
    typeof clearing !== 'number' ||
    typeof stage !== 'string' ||
    typeof attacker !== 'number' ||
    typeof defender !== 'number' ||
    typeof hitsRaw !== 'object' ||
    hitsRaw === null
  ) {
    return null
  }
  const attackerHits = Reflect.get(hitsRaw, 'attacker')
  const defenderHits = Reflect.get(hitsRaw, 'defender')
  if (typeof attackerHits !== 'number' || typeof defenderHits !== 'number') {
    return null
  }

  return {
    clearing,
    stage,
    attacker,
    defender,
    rolls: readRolls(Reflect.get(event, 'rolls')),
    hits: { attacker: attackerHits, defender: defenderHits },
  }
}

function readRolls(value: unknown): readonly [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null
  }
  const high = value[0]
  const low = value[1]
  if (typeof high !== 'number' || typeof low !== 'number') {
    return null
  }
  return [high, low]
}
