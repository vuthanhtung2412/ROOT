import type { ActionSpec, GameState } from '#api/client.ts'
import { CHOOSE_CHARACTER_PROMPT } from '#assets/vagabondBoardCatalog.ts'
import {
  isChooseCharacterPendingEvent,
  isChooseForestPendingEvent,
  isChooseKeepPendingEvent,
  isChooseLeaderPendingEvent,
  isPlaceStartingBuildingPendingEvent,
  parseKnownPendingEvent,
  type BattlePendingEvent,
  type BattleStage,
} from '#game/pendingEventGuards.ts'

export type TurnBannerViewModel = {
  actorSeat: number
  actorFaction: string
  phase: string
  step: string
  prompt: string
}

/**
 * Prefer pending event responder over currentSeat.
 * Pass legalActions when available — battle `effects` stage needs it.
 */
export function buildTurnBannerViewModel(
  state: GameState,
  legalActions: readonly ActionSpec[] = [],
): TurnBannerViewModel {
  const pendingActor = readPendingActor(state.pending, legalActions)
  const actorSeat = pendingActor ?? state.currentSeat
  const actorPlayer = state.players.find((player) => player.seat === actorSeat)
  const actorFaction = actorPlayer?.faction ?? state.factions[actorSeat] ?? '?'
  const prompt = buildPrompt(state, actorSeat, pendingActor !== null)

  return {
    actorSeat,
    actorFaction,
    phase: state.phase,
    step: state.step,
    prompt,
  }
}

function readPendingActor(
  pending: unknown[],
  legalActions: readonly ActionSpec[],
): number | null {
  if (pending.length === 0) {
    return null
  }
  const fromLegal = legalActions[0]?.actor
  if (typeof fromLegal === 'number') {
    return fromLegal
  }
  return readPendingActorFromEvent(pending[0])
}

function readPendingActorFromEvent(event: unknown): number | null {
  const pending = parseKnownPendingEvent(event)
  if (pending === null) {
    return null
  }
  if (pending.type === 'fieldHospital') {
    return pending.victim
  }
  if (
    pending.type === 'chooseKeep' ||
    pending.type === 'chooseLeader' ||
    pending.type === 'placeStartingBuilding' ||
    pending.type === 'chooseCharacter' ||
    pending.type === 'chooseForest'
  ) {
    return pending.seat
  }
  if (pending.type !== 'battle') {
    return null
  }
  if (pending.stage === 'ambush' || pending.stage === 'removeDefender') {
    return pending.defender
  }
  if (
    pending.stage === 'foil' ||
    pending.stage === 'effectsOrder' ||
    pending.stage === 'removeAttacker'
  ) {
    return pending.attacker
  }
  if (pending.stage === 'effects') {
    return nextBattleEffectSeat(pending)
  }
  return null
}

function nextBattleEffectSeat(event: BattlePendingEvent): number | null {
  const order = event.effectsOrder ?? [event.attacker, event.defender]
  const used = event.effectsUsed ?? {}
  for (const seat of order) {
    const side = seat === event.attacker ? 'attacker' : 'defender'
    if (used[side] === undefined) {
      return seat
    }
  }
  return null
}

function buildPrompt(
  state: GameState,
  actorSeat: number,
  fromPending: boolean,
): string {
  if (state.status === 'finished') {
    return 'Game over'
  }
  if (state.status === 'setup') {
    return setupPrompt(state.pending[0]) ?? 'Setup'
  }
  if (fromPending) {
    const pendingPrompt = pendingEventPrompt(state.pending[0], actorSeat)
    if (pendingPrompt !== null) {
      return pendingPrompt
    }
  }
  if (state.step === 'craft') {
    return 'Craft step — craft or end craft'
  }
  if (state.step === 'decreeAdd' || state.step === 'addToDecree') {
    return 'Add to Decree (1–2 cards)'
  }
  if (state.step === 'decree') {
    return 'Resolve decree columns'
  }
  if (state.phase === 'birdsong') {
    return 'Birdsong'
  }
  if (state.phase === 'evening') {
    return 'Evening'
  }
  return 'Daylight actions'
}

const BATTLE_STAGE_PROMPTS: Record<BattleStage, string> = {
  ambush: 'Battle — play Ambush or skip',
  foil: 'Battle — foil Ambush or skip',
  roll: 'Battle — rolling dice',
  effectsOrder: 'Battle — choose card effects order',
  effects: 'Battle — use card effect or skip',
  removeDefender: 'Battle — remove defender pieces',
  removeAttacker: 'Battle — remove attacker pieces',
}

function pendingEventPrompt(pending: unknown, actorSeat: number): string | null {
  const event = parseKnownPendingEvent(pending)
  if (event === null) {
    return `Pending choice · seat ${String(actorSeat)}`
  }
  // Field Hospitals: forced prompt — banner + hand (like Ambush).
  if (event.type === 'fieldHospital') {
    return 'Field Hospitals — pay matching suit or Decline'
  }
  if (event.type === 'battle') {
    return BATTLE_STAGE_PROMPTS[event.stage]
  }
  if (event.type === 'chooseKeep') {
    return 'Choose keep corner'
  }
  if (event.type === 'placeStartingBuilding') {
    return `Place ${event.building}`
  }
  if (event.type === 'chooseLeader') {
    return 'Choose Eyrie leader'
  }
  if (event.type === 'chooseCharacter') {
    return CHOOSE_CHARACTER_PROMPT
  }
  if (event.type === 'chooseForest') {
    return 'Choose starting forest'
  }
  return `Pending choice · seat ${String(actorSeat)}`
}

function setupPrompt(pending: unknown): string | null {
  if (isChooseKeepPendingEvent(pending)) {
    return 'Choose keep corner'
  }
  if (isPlaceStartingBuildingPendingEvent(pending)) {
    return `Place ${pending.building}`
  }
  if (isChooseLeaderPendingEvent(pending)) {
    return 'Choose Eyrie leader'
  }
  if (isChooseCharacterPendingEvent(pending)) {
    return CHOOSE_CHARACTER_PROMPT
  }
  if (isChooseForestPendingEvent(pending)) {
    return 'Choose starting forest'
  }
  return null
}
