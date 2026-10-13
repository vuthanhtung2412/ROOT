import { assertActionShape } from '#actions/actionShape.js'
import type { Action, ActionResult, ActionSpec } from '#actions/types.js'
import { factionFor } from '#factions/index.js'
import { beginFactionSetup } from '#game/factionSetup.js'
import {
  markHiddenInformation,
  revealedHiddenInformation,
  type HiddenInformationMark,
} from '#game/hiddenInformation.js'
import { createInitialState, runSharedSetup } from '#game/setup.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import { factionOf, playerOf } from '#queries/seat.js'
import { syncPlaceIdsFromState } from '#rules/place.js'
import { RuleError } from '#rules/RuleError.js'
import { SeededRng } from '#rules/Rng.js'
import {
  applyActivateDominance,
  applyTakeDominance,
  checkActivatedDominanceWin,
  finishGameWithWinner,
  pushActivateDominanceActions,
  pushTakeDominanceActions,
} from '#rules/dominance.js'
import { DEFAULT_FACTIONS } from '#state/constants.js'
import { createFactionBoard } from '#state/boards.js'
import type { GameSnapshot } from '#state/snapshot.js'
import type { FactionId, Seat } from '#pieces/types.js'
import type { GameState, Phase, PlayerState } from '#state/types.js'
import { createTurnScratch } from '#state/turnScratch.js'
import { eyrieEmigreForcedMove } from '#effects/eyrieEmigre.js'
import '#effects/register.js'
import { offerRiverfolkServices } from '#events/buyServices.js'
import { RESOLVERS } from '#events/resolvers.js'
import { EFFECTS, effectForAction } from '#triggers/effects.js'
import type { Listener } from '#triggers/effects.js'
import { buildRuleHooks } from '#triggers/buildHooks.js'
import { isBattleEvent, requireSeat } from '#typeGuards.js'
import type { Ctx } from '#game/ctx.js'
import { SignalBus } from '#triggers/SignalBus.js'

const PHASES: Phase[] = ['birdsong', 'daylight', 'evening']
/** Seats at the table (`Seat` is 0–3). */
const MAX_PLAYERS = 4
/** The lobby creator joins first: seat 0 hosts and cannot be expelled. */
const LOBBY_HOST_SEAT = 0

type UndoCheckpoint = {
  wasPlaying: boolean
  turn: number
  /** Seat sending the action: the pending event's responder, else the turn's. */
  actingSeat: Seat
  battlePending: boolean
  hiddenInformation: HiddenInformationMark
  /** False for a phase end taken with no other action on offer. */
  isChoice: boolean
}

/** Actions that leave the player "at the start of" the phase they are in. */
const START_OF_PHASE_NEUTRAL_ACTIONS: ReadonlySet<Action['type']> = new Set<
  Action['type']
>(['resolveEvent', 'join', 'expel', 'start', 'saboteurs', 'charmOffensive'])

export class Game {
  state: GameState
  history: Action[]
  log: LogEntry[]
  /** Per action of `history`: false for a phase end that was the only action. */
  private choiceHistory: boolean[]
  private rng: SeededRng
  private signalBus: SignalBus

  private constructor(args: {
    state: GameState
    history: Action[]
    log: LogEntry[]
    rng: SeededRng
    signalBus?: SignalBus
    /** Parallel to `history`. Absent or wrong length: every action counts. */
    choiceHistory?: boolean[]
  }) {
    this.state = args.state
    this.history = args.history
    this.choiceHistory =
      args.choiceHistory !== undefined &&
      args.choiceHistory.length === args.history.length
        ? [...args.choiceHistory]
        : args.history.map((): boolean => true)
    this.log = args.log
    this.rng = args.rng
    this.signalBus = args.signalBus ?? new SignalBus()
  }

  /**
   * `factions` decides the seats in advance; an empty list opens the lobby:
   * each player then picks an untaken faction when joining.
   */
  static create(args: { seed: number; factions?: GameState['factions']; id?: string }): Game {
    const factions = args.factions ?? [...DEFAULT_FACTIONS]
    for (const faction of factions) {
      factionFor(faction)
    }
    const initialState: GameState = createInitialState({
      id: args.id ?? `game-${args.seed}`,
      seed: args.seed,
      factions,
    })
    return new Game({
      state:
        factions.length === 0 ? { ...initialState, openLobby: true } : initialState,
      history: [],
      log: [],
      rng: new SeededRng({ seed: args.seed, cursor: 0 }),
    })
  }

  static replay(
    seed: number,
    actions: Action[],
    factions?: GameState['factions'],
  ): Game {
    const game =
      factions === undefined
        ? Game.create({ seed })
        : Game.create({ seed, factions: [...factions] })
    for (const action of actions) {
      game.apply(action)
    }
    return game
  }

  static fromJSON(snapshot: GameSnapshot): Game {
    const game = new Game({
      state: structuredClone(snapshot.state),
      history: [...snapshot.history],
      log: [...snapshot.log],
      rng: SeededRng.fromJSON(snapshot.rng),
      ...(snapshot.choiceHistory === undefined
        ? {}
        : { choiceHistory: [...snapshot.choiceHistory] }),
    })
    syncPlaceIdsFromState(game.state)
    // Snapshot may land mid-step (evening score, birdsong wood) — fire pending autos.
    if (game.state.status === 'playing' && game.state.pending.length === 0) {
      const autoLogs = game.runAutoActions()
      if (autoLogs.length > 0) game.log.push(...autoLogs)
    }
    return game
  }

  toJSON(): GameSnapshot {
    return {
      state: structuredClone(this.state),
      history: [...this.history],
      log: [...this.log],
      rng: this.rng.toJSON(),
      choiceHistory: [...this.choiceHistory],
    }
  }

  join(playerId: string): ActionResult {
    return this.apply({ type: 'join', playerId })
  }

  start(): ActionResult {
    return this.apply({ type: 'start' })
  }

  legalActions(): ActionSpec[] {
    const { state } = this

    if (state.status === 'waiting') {
      const specs: ActionSpec[] = []
      if (state.players.length < this.lobbySeatCount()) {
        specs.push({ type: 'join', actor: requireSeat(state.players.length) })
      }
      if (state.players.length > 1) {
        specs.push({ type: 'start', actor: 0 })
      }
      return specs
    }

    if (state.status === 'finished') return []

    if (state.pending.length > 0) {
      return this.pendingLegalActions()
    }

    const ctx = this.makeCtx()
    if (state.turnScratch.endOfBirdsong && state.phase === 'birdsong') {
      // Birdsong is over: the forced Eyrie Émigré move, then on to Daylight.
      const forcedMove: ActionSpec | null = eyrieEmigreForcedMove(state, ctx.hooks)
      return [forcedMove ?? { type: 'endPhase', actor: state.currentSeat }]
    }
    const specs = factionFor(factionOf(state, state.currentSeat)).legalActions(
      state,
      ctx,
    )
    pushTakeDominanceActions(state, state.currentSeat, specs)
    pushActivateDominanceActions(state, state.currentSeat, specs)
    return this.withHeldAutoActions(specs)
  }

  /**
   * An automatic step a card holds back (Evening draw behind Informants or
   * Charm Offensive) is the player's to take by hand: "may" stays a choice.
   * The step itself is not optional, so the phase cannot end before it.
   */
  private withHeldAutoActions(specs: ActionSpec[]): ActionSpec[] {
    const { state } = this
    const faction = factionFor(factionOf(state, state.currentSeat))
    const heldTypes: Action['type'][] = faction
      .autoActions(state, state.phase, state.step)
      .filter((auto: Action): boolean => this.isAutoBlocked(auto))
      .map((auto: Action): Action['type'] => auto.type)
    if (heldTypes.length === 0) return specs

    const heldSpecs: ActionSpec[] = heldTypes
      .filter(
        (heldType: Action['type']): boolean =>
          !specs.some((spec: ActionSpec): boolean => spec.type === heldType),
      )
      .map(
        (heldType: Action['type']): ActionSpec => ({
          type: heldType,
          actor: state.currentSeat,
        }),
      )
    return [
      ...specs.filter((spec: ActionSpec): boolean => spec.type !== 'endPhase'),
      ...heldSpecs,
    ]
  }

  apply(action: Action): ActionResult {
    const logs: LogEntry[] = []

    assertActionShape(action)
    if (this.state.status === 'finished') {
      throw new RuleError('GAME_FINISHED')
    }

    if (
      this.state.pending.length > 0 &&
      action.type !== 'resolveEvent' &&
      action.type !== 'join' &&
      action.type !== 'start'
    ) {
      throw new RuleError('PENDING_EVENT', { head: this.state.pending[0] })
    }

    this.validate(action)
    const before: UndoCheckpoint = this.undoCheckpoint(action)
    logs.push(...this.execute(action))
    // "At the start of Birdsong / Evening" lasts until the player takes an
    // action in that phase. Answers to pending events and the start-of-phase
    // effects themselves do not end it; a new phase starts it again.
    if (!START_OF_PHASE_NEUTRAL_ACTIONS.has(action.type)) {
      this.state.turnScratch.phaseActionTaken = true
    }

    if (this.state.status === 'playing') {
      logs.push(...this.checkWin())
    }

    // Rule: D.3.2 Hideout — "immediately end Daylight and begin Evening".
    if (
      (action.type === 'endPhase' || action.type === 'hideout') &&
      this.state.status === 'playing'
    ) {
      logs.push(...this.advanceOrHoldAtEndOfBirdsong())
      logs.push(...checkActivatedDominanceWin(this.state, this.makeCtx()))
      if (this.state.status === 'playing') {
        logs.push(...this.runAutoActions())
      }
    }

    if (
      (action.type === 'addToDecree' || action.type === 'newRoost') &&
      this.state.status === 'playing'
    ) {
      logs.push(...this.advanceOrHoldAtEndOfBirdsong())
      logs.push(...this.runAutoActions())
    }

    if (action.type === 'turmoil' && this.state.status === 'playing') {
      logs.push(...this.runAutoActions())
    }

    // A card action can unblock an automatic step it was holding back
    // (Charm Offensive holds the Evening draw).
    if (
      effectForAction(action) !== undefined &&
      this.state.status === 'playing'
    ) {
      logs.push(...this.runAutoActions())
    }

    this.history.push(action)
    this.choiceHistory.push(before.isChoice)
    this.log.push(...logs)
    if (!this.keepsUndoHistory(before)) {
      this.state.undoableActions = 0
    } else if (before.isChoice) {
      this.state.undoableActions = (this.state.undoableActions ?? 0) + 1
    }

    return { state: this.state, log: logs }
  }

  /** What decides, before an action, whether it can be taken back later. */
  private undoCheckpoint(action: Action): UndoCheckpoint {
    const { state } = this
    const answeringSeat: Seat | undefined =
      state.pending.length > 0 ? this.pendingLegalActions()[0]?.actor : undefined
    // Ending a phase with nothing else to do is no decision to take back.
    const isForcedEndPhase: boolean =
      action.type === 'endPhase' &&
      this.legalActions().every(
        (spec: ActionSpec): boolean => spec.type === 'endPhase',
      )
    return {
      wasPlaying: state.status === 'playing',
      turn: state.turn,
      actingSeat: answeringSeat ?? state.currentSeat,
      battlePending: state.pending.some(isBattleEvent),
      hiddenInformation: markHiddenInformation(state, this.rng),
      isChoice: !isForcedEndPhase,
    }
  }

  /**
   * An action stays undoable while the turn goes on with nothing others saw
   * resolved and nothing hidden revealed: no battle, no prompt for another
   * player, no dice, no draw, no change to another player's hand, same turn.
   */
  private keepsUndoHistory(before: UndoCheckpoint): boolean {
    const { state } = this
    const pendingActor: Seat | undefined =
      state.pending.length > 0 ? this.pendingLegalActions()[0]?.actor : undefined
    return (
      before.wasPlaying &&
      state.status === 'playing' &&
      state.turn === before.turn &&
      before.actingSeat === state.currentSeat &&
      !before.battlePending &&
      !state.pending.some(isBattleEvent) &&
      (pendingActor === undefined || pendingActor === state.currentSeat) &&
      !revealedHiddenInformation(before.hiddenInformation, state, this.rng)
    )
  }

  /** The player whose turn it is has an action of this turn to take back. */
  canUndoTurnAction(): boolean {
    return (this.state.undoableActions ?? 0) > 0 && this.history.length > 0
  }

  /**
   * Take back the latest decision of the current turn (see `undoableActions`),
   * with the forced phase ends that followed it: the player is back where
   * that decision was made.
   */
  undoTurnAction(): void {
    if (!this.canUndoTurnAction()) {
      throw new RuleError('NOTHING_TO_UNDO')
    }
    let tookBackChoice = false
    while (!tookBackChoice && this.history.length > 0) {
      tookBackChoice = this.choiceHistory.at(-1) ?? true
      this.undo()
    }
  }

  /** Subscribe to emitted game signals (tests / diagnostics). */
  subscribeSignals(listener: Listener): () => void {
    return this.signalBus.subscribe(listener)
  }

  undo(): void {
    if (this.history.length === 0) {
      throw new RuleError('NOTHING_TO_UNDO')
    }
    const seed = this.state.seed
    const actions = this.history.slice(0, -1)
    // An open lobby is rebuilt open: its joins carry the faction picks.
    const restored = Game.replay(
      seed,
      actions,
      this.state.openLobby === true ? [] : this.state.factions,
    )
    this.state = restored.state
    this.history = restored.history
    this.choiceHistory = restored.choiceHistory
    this.log = restored.log
    this.rng = restored.rng
  }

  private makeCtx(): Ctx {
    const hooks = buildRuleHooks(this.state, FALL)
    const ctx: Ctx = {
      map: FALL,
      rng: this.rng,
      hooks,
      emit: (signal) => {
        this.signalBus.emit(this.state, signal, ctx)
      },
      grantedActions: () => this.grantedActions(),
    }
    return ctx
  }

  private grantedActions(): ActionSpec[] {
    const specs: ActionSpec[] = []
    for (const player of this.state.players) {
      for (const card of player.playArea) {
        const effect = EFFECTS[card.defId]
        if (!effect?.grants) continue
        specs.push(...effect.grants(this.state))
      }
    }
    return specs
  }

  private pendingLegalActions(): ActionSpec[] {
    const head = this.state.pending[0]
    if (!head) return []
    const ctx = this.makeCtx()
    return RESOLVERS[head.type].legalActions(this.state, head, ctx)
  }

  private validate(action: Action): void {
    if (action.type === 'join') {
      if (this.state.status !== 'waiting') throw new RuleError('NOT_WAITING')
      // Seat and faction checks: `applyJoin` (an open lobby lets a seated
      // player pick again).
      return
    }
    if (action.type === 'expel') {
      // Lobby, seat and host checks: `applyExpel`.
      return
    }
    if (action.type === 'start') {
      if (this.state.status !== 'waiting') throw new RuleError('NOT_WAITING')
      if (this.state.players.length <= 1) {
        throw new RuleError('NOT_ENOUGH_PLAYERS', { count: this.state.players.length })
      }
      return
    }

    const legal = this.legalActions()
    if (action.type === 'resolveEvent') {
      const head = this.state.pending[0]
      if (!head) throw new RuleError('NO_PENDING_EVENT')
      const ctx = this.makeCtx()
      if (!RESOLVERS[head.type].matchesAction(this.state, head, action, ctx)) {
        throw new RuleError('ILLEGAL_ACTION', { action })
      }
      return
    }
    const ok = legal.some(
      (spec) => spec.type === action.type && spec.actor === this.state.currentSeat,
    )
    if (!ok) throw new RuleError('ILLEGAL_ACTION', { action })

    if (effectForAction(action) !== undefined) return

    // The faction already ended its Birdsong; this only leaves the hold.
    if (action.type === 'endPhase' && this.state.turnScratch.endOfBirdsong) return

    if (action.type === 'takeDominance' || action.type === 'activateDominance') {
      return
    }

    const ctx = this.makeCtx()
    const faction = factionFor(factionOf(this.state, this.state.currentSeat))
    faction.validate(this.state, action, ctx)
  }

  private execute(action: Action): LogEntry[] {
    switch (action.type) {
      case 'join':
        return this.applyJoin(action.playerId, action.faction)
      case 'expel':
        return this.applyExpel(action.seat)
      case 'start':
        return this.applyStart()
      case 'endPhase':
        return this.applyEndPhase()
      case 'resolveEvent':
        return this.applyResolveEvent(action)
      case 'takeDominance':
        return applyTakeDominance(this.state, this.state.currentSeat, action.cardId)
      case 'activateDominance':
        return applyActivateDominance(this.state, this.state.currentSeat, action)
      default: {
        const ctx = this.makeCtx()
        const effect = effectForAction(action)
        if (effect?.action !== undefined) {
          if (!effect.action.apply(this.state, action, ctx)) {
            throw new RuleError('ILLEGAL_ACTION', { action })
          }
          return [{ t: 'action', actor: this.state.currentSeat, action }]
        }
        const faction = factionFor(factionOf(this.state, this.state.currentSeat))
        return faction.apply(this.state, action, ctx)
      }
    }
  }

  /** Seats of the lobby: the preset factions, or the table size when open. */
  private lobbySeatCount(): number {
    return this.state.openLobby === true
      ? MAX_PLAYERS
      : this.state.factions.length
  }

  /**
   * Open lobby: a player picks an untaken faction, and may pick again while
   * the game has not started.
   */
  private pickFactionInOpenLobby(playerId: string, faction: FactionId): LogEntry[] {
    const { state } = this
    factionFor(faction)
    const takenBy = state.players.find(
      (player: PlayerState): boolean => player.faction === faction,
    )
    if (takenBy !== undefined && takenBy.playerId !== playerId) {
      throw new RuleError('FACTION_TAKEN', { faction })
    }
    const seated = state.players.find(
      (player: PlayerState): boolean => player.playerId === playerId,
    )
    if (seated !== undefined) {
      seated.faction = faction
      seated.board = createFactionBoard(faction)
      state.factions[seated.seat] = faction
      return [{ t: 'join', playerId, faction }]
    }
    if (state.players.length >= MAX_PLAYERS) throw new RuleError('LOBBY_FULL')
    state.factions.push(faction)
    return this.seatPlayer(playerId, faction)
  }

  private applyJoin(playerId: string, pickedFaction?: FactionId): LogEntry[] {
    const { state } = this
    if (state.status !== 'waiting') throw new RuleError('NOT_WAITING')
    if (state.openLobby === true) {
      if (pickedFaction === undefined) throw new RuleError('MISSING_FACTION')
      return this.pickFactionInOpenLobby(playerId, pickedFaction)
    }
    if (state.players.length >= state.factions.length) {
      throw new RuleError('LOBBY_FULL')
    }
    const faction = state.factions[state.players.length]!
    if (pickedFaction !== undefined && pickedFaction !== faction) {
      throw new RuleError('WRONG_FACTION', { faction: pickedFaction })
    }
    return this.seatPlayer(playerId, faction)
  }

  /**
   * Open lobby: the player at `seat` leaves the table and its faction is free
   * again. Later seats move down one, so seats stay 0..n-1 in join order.
   */
  private applyExpel(seat: Seat): LogEntry[] {
    const { state } = this
    if (state.status !== 'waiting') throw new RuleError('NOT_WAITING')
    if (state.openLobby !== true) throw new RuleError('NOT_OPEN_LOBBY')
    if (seat === LOBBY_HOST_SEAT) throw new RuleError('CANNOT_EXPEL_HOST')
    const expelled = state.players.find(
      (player: PlayerState): boolean => player.seat === seat,
    )
    if (expelled === undefined) throw new RuleError('NO_PLAYER_AT_SEAT', { seat })
    state.players = state.players
      .filter((player: PlayerState): boolean => player.seat !== seat)
      .map(
        (player: PlayerState, index: number): PlayerState => ({
          ...player,
          seat: requireSeat(index),
        }),
      )
    state.factions = state.players.map(
      (player: PlayerState): FactionId => player.faction,
    )
    return [
      { t: 'expel', playerId: expelled.playerId, faction: expelled.faction },
    ]
  }

  private seatPlayer(playerId: string, faction: FactionId): LogEntry[] {
    const { state } = this
    const seat = requireSeat(state.players.length)
    state.players.push({
      playerId,
      seat,
      faction,
      vp: 0,
      scoresVictoryPoints: true,
      hand: [],
      playArea: [],
      activatedDominance: null,
      coalitionWith: null,
      craftedItems: [],
      board: createFactionBoard(faction),
    })
    return [{ t: 'join', playerId, faction }]
  }

  private applyStart(): LogEntry[] {
    const { state } = this
    if (state.status !== 'waiting') throw new RuleError('NOT_WAITING')
    if (state.players.length <= 1) {
      throw new RuleError('NOT_ENOUGH_PLAYERS', { count: state.players.length })
    }
    runSharedSetup(state, this.rng)
    state.status = 'setup'

    beginFactionSetup(state, this.makeCtx())

    const logs: LogEntry[] = [{ t: 'start' }]
    if (state.pending.length === 0) {
      logs.push(...this.beginPlaying())
    }
    return logs
  }

  private beginPlaying(): LogEntry[] {
    const { state } = this
    state.status = 'playing'
    state.currentSeat = 0
    const first = factionFor(factionOf(state, 0))
    state.phase = 'birdsong'
    state.step = first.steps.birdsong[0]!
    state.turnScratch = createTurnScratch()

    const ctx = this.makeCtx()
    ctx.emit({ s: 'phase.start', actor: 0, phase: 'birdsong' })
    offerRiverfolkServices(state)

    const autoLogs = this.runAutoActions()
    return [
      { t: 'phase', actor: 0, phase: 'birdsong', step: state.step },
      ...checkActivatedDominanceWin(state, ctx),
      ...autoLogs,
    ]
  }

  private applyEndPhase(): LogEntry[] {
    // Held at the end of Birdsong: the faction ended its phase before the hold.
    if (this.state.turnScratch.endOfBirdsong) return []
    const ctx = this.makeCtx()
    const faction = factionFor(factionOf(this.state, this.state.currentSeat))
    faction.validate(this.state, { type: 'endPhase' }, ctx)
    return faction.apply(this.state, { type: 'endPhase' }, ctx)
  }

  /**
   * Leave the current step, unless Birdsong is ending and Eyrie Émigré still
   * forces a move ("At end of Birdsong, you must take a move…"): then Birdsong
   * is held until that move is taken.
   */
  private advanceOrHoldAtEndOfBirdsong(): LogEntry[] {
    const { state } = this
    const birdsongSteps = factionFor(factionOf(state, state.currentSeat)).steps
      .birdsong
    const isLeavingBirdsong: boolean =
      state.phase === 'birdsong' && state.step === birdsongSteps.at(-1)
    if (
      isLeavingBirdsong &&
      eyrieEmigreForcedMove(state, this.makeCtx().hooks) !== null
    ) {
      state.turnScratch.endOfBirdsong = true
      return []
    }
    return this.advanceStepOrPhase()
  }

  private advanceStepOrPhase(): LogEntry[] {
    const { state } = this
    const ctx = this.makeCtx()
    const faction = factionFor(factionOf(state, state.currentSeat))
    const steps = faction.steps[state.phase]
    const idx = steps.indexOf(state.step)
    if (idx < 0) throw new RuleError('INVALID_STEP', { step: state.step })

    const logs: LogEntry[] = []

    if (idx < steps.length - 1) {
      state.step = steps[idx + 1]!
      if (state.phase === 'daylight' && state.step === 'actions') {
        // Services bought in Birdsong last until the end of the turn (11.2.7).
        state.turnScratch = createTurnScratch({
          actionsLeft: 3,
          riverboats: state.turnScratch.riverboats,
          mercenaries: state.turnScratch.mercenaries,
          // "Once in Daylight" cards may already be used in the craft step.
          leagueUsed: state.turnScratch.leagueUsed,
          propagandaUsed: state.turnScratch.propagandaUsed,
        })
      }
      if (state.phase === 'daylight' && state.step === 'decree') {
        state.turnScratch.decree = null
        state.turnScratch.decreeDone = false
      }
      if (state.phase === 'evening' && state.step === 'military') {
        const board = playerOf(state, state.currentSeat).board
        if (board.kind === 'alliance') {
          state.turnScratch.militaryOpsLeft = board.officers
        }
      }
      logs.push({
        t: 'phase',
        actor: state.currentSeat,
        phase: state.phase,
        step: state.step,
      })
      return logs
    }

    ctx.emit({ s: 'phase.end', actor: state.currentSeat, phase: state.phase })

    const pi = PHASES.indexOf(state.phase)
    if (pi < PHASES.length - 1) {
      const nextPhase = PHASES[pi + 1]!
      state.phase = nextPhase
      state.step = faction.steps[nextPhase][0]!
      // Before the autos of the new phase: they may wait on a start-of-phase card.
      state.turnScratch.phaseActionTaken = false
      state.turnScratch.endOfBirdsong = false
      if (nextPhase === 'evening' && state.step === 'military') {
        const board = playerOf(state, state.currentSeat).board
        if (board.kind === 'alliance') {
          state.turnScratch.militaryOpsLeft = board.officers
        }
      }
      ctx.emit({ s: 'phase.start', actor: state.currentSeat, phase: nextPhase })
      logs.push(
        { t: 'phase', actor: state.currentSeat, phase: state.phase, step: state.step },
      )
      return logs
    }

    faction.endTurn(state)
    const nextSeat = requireSeat((state.currentSeat + 1) % state.players.length)
    state.currentSeat = nextSeat
    state.turn += 1

    const nextFaction = factionFor(factionOf(state, nextSeat))
    state.phase = 'birdsong'
    state.step = nextFaction.steps.birdsong[0]!
    state.turnScratch.phaseActionTaken = false

    ctx.emit({ s: 'phase.start', actor: nextSeat, phase: 'birdsong' })
    logs.push({ t: 'phase', actor: nextSeat, phase: 'birdsong', step: state.step })
    offerRiverfolkServices(state)

    return logs
  }

  private runAutoActions(): LogEntry[] {
    const logs: LogEntry[] = []
    let guard = 0
    while (guard++ < 50) {
      // A pending choice (e.g. buying services at the start of Birdsong) comes first.
      if (this.state.pending.length > 0) break
      const faction = factionFor(factionOf(this.state, this.state.currentSeat))
      const autos = faction
        .autoActions(this.state, this.state.phase, this.state.step)
        .filter((action) => !this.isAutoBlocked(action))
      if (autos.length === 0) break
      for (const action of autos) {
        faction.validate(this.state, action, this.makeCtx())
        logs.push(...faction.apply(this.state, action, this.makeCtx()))
      }
    }
    return logs
  }

  private isAutoBlocked(action: { type: string }): boolean {
    for (const player of this.state.players) {
      for (const playCard of player.playArea) {
        const effect = EFFECTS[playCard.defId]
        if (effect?.blocksAuto?.(this.state, action)) return true
      }
    }
    return false
  }

  private applyResolveEvent(action: Action): LogEntry[] {
    if (action.type !== 'resolveEvent') throw new RuleError('INVALID_ACTION')
    const head = this.state.pending[0]
    if (!head) throw new RuleError('NO_PENDING_EVENT')
    const ctx = this.makeCtx()
    const legal = RESOLVERS[head.type].legalActions(this.state, head, ctx)
    const spec = legal.find((s) => {
      if (s.type !== 'resolveEvent') return false
      if (action.decline && s.params?.decline?.includes(true)) return true
      if (action.order && s.params?.order) {
        return s.params.order.some((o) => JSON.stringify(o) === JSON.stringify(action.order))
      }
      if (action.cardId && s.params?.cardIds?.includes(action.cardId)) return true
      if (action.useEffect !== undefined && s.params?.useEffect?.includes(action.useEffect)) {
        return true
      }
      if (action.clearing !== undefined && s.params?.clearing?.includes(action.clearing)) {
        return true
      }
      if (
        action.character !== undefined &&
        s.params?.characters?.includes(action.character)
      ) {
        return true
      }
      if (action.leader !== undefined && s.params?.leaders?.includes(action.leader)) {
        return true
      }
      if (action.forest !== undefined && s.params?.forests?.includes(action.forest)) {
        return true
      }
      if (action.suit !== undefined && s.params?.suits?.includes(action.suit)) {
        return true
      }
      // Riverfolk service — the resolver's matchesAction validated the purchase.
      if (action.service !== undefined && s.params?.options !== undefined) {
        return true
      }
      // Riverfolk starting costs — matchesAction validated the three costs.
      if (action.handCard !== undefined && s.params?.options !== undefined) {
        return true
      }
      if (action.pieceIds && s.params?.pieceIds) {
        const domain = s.params.pieceIds
        if (JSON.stringify(action.pieceIds) === JSON.stringify(domain)) return true
        return domain.some(
          (ids) =>
            Array.isArray(ids) && JSON.stringify(ids) === JSON.stringify(action.pieceIds),
        )
      }
      // Vagabond item choice — the resolver's matchesAction validated the items.
      if (action.items !== undefined && s.params?.vagabondItems !== undefined) {
        return true
      }
      return false
    })
    if (!spec) throw new RuleError('ILLEGAL_ACTION', { action })
    const logs = RESOLVERS[head.type].apply(
      this.state,
      { event: head, action, actor: spec.actor },
      ctx,
    )
    if (this.state.status === 'setup' && this.state.pending.length === 0) {
      logs.push(...this.beginPlaying())
    } else if (this.state.status === 'playing' && this.state.pending.length === 0) {
      logs.push(...this.runAutoActions())
    }
    return logs
  }

  private checkWin(): LogEntry[] {
    const { state } = this
    const contenders = state.players.filter((player) => player.vp >= 30)
    if (contenders.length === 0) return []

    let winner: Seat
    if (contenders.length === 1) {
      winner = contenders[0]!.seat
    } else {
      // Rule: Victory — tie at 30+ → current turn player wins.
      winner = state.currentSeat
    }

    return finishGameWithWinner(state, winner)
  }
}
