import type { Action, ActionResult, ActionSpec } from '#actions/types.js'
import { factionFor } from '#factions/index.js'
import { beginFactionSetup } from '#game/factionSetup.js'
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
import type { Seat } from '#pieces/types.js'
import type { GameState, Phase } from '#state/types.js'
import { createTurnScratch } from '#state/turnScratch.js'
import '#effects/register.js'
import { offerRiverfolkServices } from '#events/buyServices.js'
import { RESOLVERS } from '#events/resolvers.js'
import { EFFECTS, effectForAction } from '#triggers/effects.js'
import type { Listener } from '#triggers/effects.js'
import { buildRuleHooks } from '#triggers/buildHooks.js'
import { requireSeat } from '#typeGuards.js'
import type { Ctx } from '#game/ctx.js'
import { SignalBus } from '#triggers/SignalBus.js'

const PHASES: Phase[] = ['birdsong', 'daylight', 'evening']

export class Game {
  state: GameState
  history: Action[]
  log: LogEntry[]
  private rng: SeededRng
  private signalBus: SignalBus

  private constructor(args: {
    state: GameState
    history: Action[]
    log: LogEntry[]
    rng: SeededRng
    signalBus?: SignalBus
  }) {
    this.state = args.state
    this.history = args.history
    this.log = args.log
    this.rng = args.rng
    this.signalBus = args.signalBus ?? new SignalBus()
  }

  static create(args: { seed: number; factions?: GameState['factions']; id?: string }): Game {
    const factions = args.factions ?? [...DEFAULT_FACTIONS]
    for (const faction of factions) {
      factionFor(faction)
    }
    return new Game({
      state: createInitialState({
        id: args.id ?? `game-${args.seed}`,
        seed: args.seed,
        factions,
      }),
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
      if (state.players.length < state.factions.length) {
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
    const specs = factionFor(factionOf(state, state.currentSeat)).legalActions(
      state,
      ctx,
    )
    pushTakeDominanceActions(state, state.currentSeat, specs)
    pushActivateDominanceActions(state, state.currentSeat, specs)
    return specs
  }

  apply(action: Action): ActionResult {
    const logs: LogEntry[] = []

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
    logs.push(...this.execute(action))

    if (this.state.status === 'playing') {
      logs.push(...this.checkWin())
    }

    // Rule: D.3.2 Hideout — "immediately end Daylight and begin Evening".
    if (
      (action.type === 'endPhase' || action.type === 'hideout') &&
      this.state.status === 'playing'
    ) {
      logs.push(...this.advanceStepOrPhase())
      logs.push(...checkActivatedDominanceWin(this.state, this.makeCtx()))
      if (this.state.status === 'playing') {
        logs.push(...this.runAutoActions())
      }
    }

    if (
      (action.type === 'addToDecree' || action.type === 'newRoost') &&
      this.state.status === 'playing'
    ) {
      logs.push(...this.advanceStepOrPhase())
      logs.push(...this.runAutoActions())
    }

    if (action.type === 'turmoil' && this.state.status === 'playing') {
      logs.push(...this.runAutoActions())
    }

    this.history.push(action)
    this.log.push(...logs)

    return { state: this.state, log: logs }
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
    const restored = Game.replay(seed, actions, this.state.factions)
    this.state = restored.state
    this.history = restored.history
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
      if (this.state.players.length >= this.state.factions.length) {
        throw new RuleError('LOBBY_FULL')
      }
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
        return this.applyJoin(action.playerId)
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

  private applyJoin(playerId: string): LogEntry[] {
    const { state } = this
    if (state.status !== 'waiting') throw new RuleError('NOT_WAITING')
    if (state.players.length >= state.factions.length) {
      throw new RuleError('LOBBY_FULL')
    }
    const seat = requireSeat(state.players.length)
    const faction = state.factions[seat]!
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
    const ctx = this.makeCtx()
    const faction = factionFor(factionOf(this.state, this.state.currentSeat))
    faction.validate(this.state, { type: 'endPhase' }, ctx)
    return faction.apply(this.state, { type: 'endPhase' }, ctx)
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
