import { artFactionOf } from '@root/lib/bot-factions'
import type { ActionSpec, GameState } from '#api/client.ts'
import { readChoiceParams } from '#game/resolution/ActionComposer.ts'
import {
  battleRoleRemovingPieces,
  type BattleOverlayViewModel,
  type BattleRemoval,
  type BattleRole,
} from '#ui/BattleOverlay.ts'

export const ZERO_HIT_BATTLE_MESSAGE = 'Battle over — no hits'
export const BATTLE_OVER_MESSAGE = 'Battle over'

const BATTLE_RESULT_FLASH_MS = 5000

type BattlePending = {
  clearing: number
  stage: string
  attacker: number
  defender: number
  rolls: readonly [number, number] | null
  hits: { attacker: number; defender: number }
}

export type BattleTrackerState = {
  clearing: number
  attacker: number
  defender: number
  rolls: readonly [number, number] | null
  peakHits: { attacker: number; defender: number }
}

/** Final dice/hits held on overlay after battle pending clears. */
export type FinishedBattleOutcome = {
  clearing: number
  attacker: number
  defender: number
  rolls: readonly [number, number]
  hits: { attacker: number; defender: number }
}

export type BattleTrackerUpdate = {
  tracker: BattleTrackerState | null
  finishedOutcome: FinishedBattleOutcome | null
}

/** Ambush/foil use TurnBanner only — damage strip starts after rolls. */
const BATTLE_OVERLAY_HIDDEN_STAGES = new Set(['ambush', 'foil'])

/**
 * Read first pending battle into overlay view-model.
 * Null during ambush/foil so Ambush resolves before damage strip.
 */
export function buildBattleOverlayViewModel(
  state: GameState,
  prompt: string | null = null,
  legalActions: readonly ActionSpec[] = [],
): BattleOverlayViewModel | null {
  const battle = readBattlePending(state.pending[0])
  if (battle === null) {
    return null
  }
  if (BATTLE_OVERLAY_HIDDEN_STAGES.has(battle.stage)) {
    return null
  }
  const removal: BattleRemoval | null = battleRemovalOf(
    state,
    battle,
    legalActions,
  )
  return {
    removal,
    clearing: battle.clearing,
    stage: battle.stage,
    attackerFaction: factionLabel(state, battle.attacker),
    defenderFaction: factionLabel(state, battle.defender),
    rolls: battle.rolls,
    hits: hitsCostingPieces(battle, removal),
    prompt,
    outcomeMessage: null,
  }
}

export function buildFinishedBattleOverlayViewModel(
  state: GameState,
  outcome: FinishedBattleOutcome,
): BattleOverlayViewModel {
  const zeroHits =
    outcome.hits.attacker === 0 && outcome.hits.defender === 0
  return {
    clearing: outcome.clearing,
    stage: 'finished',
    attackerFaction: factionLabel(state, outcome.attacker),
    defenderFaction: factionLabel(state, outcome.defender),
    rolls: outcome.rolls,
    hits: outcome.hits,
    removal: null,
    prompt: null,
    outcomeMessage: zeroHits ? ZERO_HIT_BATTLE_MESSAGE : BATTLE_OVER_MESSAGE,
  }
}

const RESOLVE_EVENT_ACTION_TYPE = 'resolveEvent'
const VAGABOND_FACTION = 'vagabond'

/**
 * What the game asks of the side taking hits, read from its legal answers:
 * the pieces of one removal, or the Vagabond items to damage.
 */
function readLegalBattleRemoval(
  legalActions: readonly ActionSpec[],
): BattleRemoval | null {
  for (const spec of legalActions) {
    if (spec.type !== RESOLVE_EVENT_ACTION_TYPE) {
      continue
    }
    const params = readChoiceParams(spec)
    const itemCount: number | undefined = params.itemCount?.[0]
    if (itemCount !== undefined) {
      return { count: itemCount, unit: 'item' }
    }
    if (params.pieceIds !== undefined) {
      return { count: params.pieceIds.length, unit: 'piece' }
    }
  }
  return null
}

/**
 * What the side taking hits loses; null outside the removal stages.
 * Rule: 4.3.4 — hits past the pieces in the clearing are lost, so the legal
 * removal is the count, not the hits. Hits stand in when no answer is known.
 * Rule: 9.2.6 — the Vagabond damages items instead of removing pieces.
 */
function battleRemovalOf(
  state: GameState,
  battle: BattlePending,
  legalActions: readonly ActionSpec[],
): BattleRemoval | null {
  const removingRole: BattleRole | null = battleRoleRemovingPieces(battle.stage)
  if (removingRole === null) {
    return null
  }
  const isDefenderRemoving: boolean = removingRole === 'defender'
  const victim: number = isDefenderRemoving ? battle.defender : battle.attacker
  const hits: number = isDefenderRemoving
    ? battle.hits.attacker
    : battle.hits.defender
  const legalRemoval: BattleRemoval | null = readLegalBattleRemoval(legalActions)
  if (isVagabondSeat(state, victim)) {
    return legalRemoval?.unit === 'item'
      ? legalRemoval
      : { count: hits, unit: 'hit' }
  }
  return legalRemoval?.unit === 'piece'
    ? legalRemoval
    : { count: hits, unit: 'piece' }
}

/**
 * Hits as the damage marks show them: the side removing pieces now takes as
 * many as it removes, not the hits dealt.
 */
function hitsCostingPieces(
  battle: BattlePending,
  removal: BattleRemoval | null,
): BattlePending['hits'] {
  if (removal === null || removal.unit !== 'piece') {
    return battle.hits
  }
  return battleRoleRemovingPieces(battle.stage) === 'defender'
    ? { ...battle.hits, attacker: removal.count }
    : { ...battle.hits, defender: removal.count }
}

/** What the side taking hits loses in the battle on top of the queue. */
export function pendingBattleRemoval(
  state: GameState,
  legalActions: readonly ActionSpec[],
): BattleRemoval | null {
  const battle = readBattlePending(state.pending[0])
  return battle === null ? null : battleRemovalOf(state, battle, legalActions)
}

/** The two sides of a battle, worn by its clearing for as long as it lasts. */
export type BattleMark = {
  clearing: number
  attackerFaction: string
  defenderFaction: string
}

type BattleSides = {
  clearing: number
  attacker: number
  defender: number
}

export function buildBattleMark(
  state: GameState,
  battle: BattleSides,
): BattleMark {
  return {
    clearing: battle.clearing,
    attackerFaction: factionLabel(state, battle.attacker),
    defenderFaction: factionLabel(state, battle.defender),
  }
}

export function readBattleClearingId(state: GameState): number | null {
  const battle = readBattlePending(state.pending[0])
  return battle?.clearing ?? null
}

export function battleResultFlashDurationMs(): number {
  return BATTLE_RESULT_FLASH_MS
}

/**
 * Track pending battle peaks; when battle clears after rolls, signal result flash.
 */
export function updateBattleTracker(
  tracker: BattleTrackerState | null,
  state: GameState,
): BattleTrackerUpdate {
  const pending = readBattlePending(state.pending[0])
  if (pending !== null) {
    return {
      tracker: mergeBattleTracker(tracker, pending),
      finishedOutcome: null,
    }
  }
  const finishedOutcome = detectFinishedBattleOutcome(tracker)
  return { tracker: null, finishedOutcome }
}

function mergeBattleTracker(
  tracker: BattleTrackerState | null,
  pending: BattlePending,
): BattleTrackerState {
  const sameBattle =
    tracker !== null &&
    tracker.clearing === pending.clearing &&
    tracker.attacker === pending.attacker &&
    tracker.defender === pending.defender
  const peakHits = sameBattle
    ? {
        attacker: Math.max(tracker.peakHits.attacker, pending.hits.attacker),
        defender: Math.max(tracker.peakHits.defender, pending.hits.defender),
      }
    : { attacker: pending.hits.attacker, defender: pending.hits.defender }
  const rolls = pending.rolls ?? (sameBattle ? tracker.rolls : null)
  return {
    clearing: pending.clearing,
    attacker: pending.attacker,
    defender: pending.defender,
    rolls,
    peakHits,
  }
}

function detectFinishedBattleOutcome(
  tracker: BattleTrackerState | null,
): FinishedBattleOutcome | null {
  if (tracker === null || tracker.rolls === null) {
    return null
  }
  return {
    clearing: tracker.clearing,
    attacker: tracker.attacker,
    defender: tracker.defender,
    rolls: tracker.rolls,
    hits: { ...tracker.peakHits },
  }
}

/** A battle is waiting anywhere in the pending queue, not only on top. */
export function hasPendingBattle(state: GameState): boolean {
  return state.pending.some(
    (event: unknown): boolean => readBattlePending(event) !== null,
  )
}

const EVENT_LOG_ENTRY_TYPE = 'event'
const PIECES_LOG_ENTRY_TYPE = 'pieces'

function readLoggedBattle(entry: unknown): BattlePending | null {
  if (typeof entry !== 'object' || entry === null) {
    return null
  }
  if (Reflect.get(entry, 't') !== EVENT_LOG_ENTRY_TYPE) {
    return null
  }
  return readBattlePending(Reflect.get(entry, 'event'))
}

/** Pieces of a seat a `pieces` log entry removed from a clearing. */
function removedPieceCount(
  entry: unknown,
  clearing: number,
  owner: number,
): number {
  if (typeof entry !== 'object' || entry === null) {
    return 0
  }
  if (
    Reflect.get(entry, 't') !== PIECES_LOG_ENTRY_TYPE ||
    Reflect.get(entry, 'clearing') !== clearing
  ) {
    return 0
  }
  const removed: unknown = Reflect.get(entry, 'removed')
  if (!Array.isArray(removed)) {
    return 0
  }
  return removed.filter(
    (piece: unknown): boolean =>
      typeof piece === 'object' &&
      piece !== null &&
      Reflect.get(piece, 'owner') === owner,
  ).length
}

/**
 * Where the battle rolled at `rolledIndex` opened: the entry of the same
 * battle before it. Without one in these entries, the rolled entry itself.
 */
function battleOpenedIndex(
  entries: readonly unknown[],
  rolledIndex: number,
  battle: BattlePending,
): number {
  for (let index = rolledIndex - 1; index >= 0; index -= 1) {
    const earlier = readLoggedBattle(entries[index])
    if (earlier === null) {
      continue
    }
    // The nearest earlier battle entry: this battle opening, or another one.
    // The opening carries the dice too once the battle rolled.
    return isSameBattle(earlier, battle) ? index : rolledIndex
  }
  return rolledIndex
}

/**
 * The outcome with the pieces each side lost for hits, so the result shows
 * what left the map (Rule: 4.3.4 — hits past the pieces there are lost).
 * Rule: 9.2.6 — a Vagabond loses no piece: the hits it took stand.
 */
export function finishedOutcomeWithPiecesRemoved(
  state: GameState,
  outcome: FinishedBattleOutcome,
  entries: readonly unknown[],
): FinishedBattleOutcome {
  const logged = finishedBattleOutcomeFromLog(entries)
  if (logged === null || !isSameBattle(logged, outcome)) {
    return outcome
  }
  return {
    ...outcome,
    hits: {
      attacker: isVagabondSeat(state, outcome.defender)
        ? outcome.hits.attacker
        : logged.hits.attacker,
      defender: isVagabondSeat(state, outcome.attacker)
        ? outcome.hits.defender
        : logged.hits.defender,
    },
  }
}

/**
 * Result of the last rolled battle the log entries tell; null without one.
 * A battle nobody had to answer (no ambush, no piece to choose) opens and
 * ends inside one server update: it is never pending here, only logged.
 * Its hits are back to zero once taken, so removed pieces count as hits.
 */
export function finishedBattleOutcomeFromLog(
  entries: readonly unknown[],
): FinishedBattleOutcome | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const battle = readLoggedBattle(entries[index])
    if (battle === null || battle.rolls === null) {
      continue
    }
    // The pieces a battle removes are logged before its last roll entry.
    const sinceOpened = entries.slice(battleOpenedIndex(entries, index, battle))
    const removedOf = (owner: number): number =>
      sinceOpened.reduce(
        (count: number, entry: unknown): number =>
          count + removedPieceCount(entry, battle.clearing, owner),
        0,
      )
    return {
      clearing: battle.clearing,
      attacker: battle.attacker,
      defender: battle.defender,
      rolls: battle.rolls,
      hits: {
        attacker: Math.max(battle.hits.attacker, removedOf(battle.defender)),
        defender: Math.max(battle.hits.defender, removedOf(battle.attacker)),
      },
    }
  }
  return null
}

function isSameBattle(left: BattleSides, right: BattleSides): boolean {
  return (
    left.clearing === right.clearing &&
    left.attacker === right.attacker &&
    left.defender === right.defender
  )
}

/** The Vagabond, or the Vagabot (Rootbotics 7.2.5): hits damage items. */
function isVagabondSeat(state: GameState, seat: number): boolean {
  return artFactionOf(factionLabel(state, seat)) === VAGABOND_FACTION
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

/** Composer highlights plus ongoing battle clearing. */
export function mergeBattleClearingHighlight(
  clearingIds: readonly number[],
  state: GameState | null,
): number[] {
  if (state === null) {
    return [...clearingIds]
  }
  const battleClearing = readBattleClearingId(state)
  if (battleClearing === null) {
    return [...clearingIds]
  }
  const merged = new Set(clearingIds)
  merged.add(battleClearing)
  return [...merged]
}
