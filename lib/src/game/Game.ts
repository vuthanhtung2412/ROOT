import type { Action, ActionResult, ActionSpec } from '#actions/types.js'
import { defOf } from '#cards/Deck.js'
import { EP_DECK } from '#cards/epDeck.js'
import type { Card } from '#cards/types.js'
import { Deck } from '#cards/Deck.js'
import { FACTIONS } from '#factions/index.js'
import type { LogEntry } from '#log/types.js'
import { FALL } from '#map/fall.js'
import type { ClearingId } from '#map/types.js'
import { factionOf } from '#queries/seat.js'
import { resetPlaceIds } from '#rules/place.js'
import { RuleError } from '#rules/RuleError.js'
import { SeededRng, randomIndex, type Rng } from '#rules/Rng.js'
import {
  DEFAULT_FACTIONS,
  ITEM_SUPPLY,
  RUIN_ITEMS,
  STARTING_HAND,
} from '#state/constants.js'
import { EYRIE_LEADERS, type FactionBoard } from '#state/boards.js'
import type { GameSnapshot } from '#state/snapshot.js'
import type { Seat } from '#pieces/types.js'
import type { GameState, Phase, PlayerState } from '#state/types.js'
import '#effects/register.js'
import { tryApplyCharmOffensive } from '#effects/charmOffensive.js'
import { tryApplyInformants } from '#effects/informants.js'
import { tryApplyLeague } from '#effects/leagueOfAdventurousMice.js'
import { tryApplyPropagandaBureau } from '#effects/propagandaBureau.js'
import { tryApplySaboteurs } from '#effects/saboteurs.js'
import { tryApplyFalseOrders } from '#effects/falseOrders.js'
import { tryApplyEyrieEmigre } from '#effects/eyrieEmigre.js'
import { tryApplySwapMeet } from '#effects/swapMeet.js'
import { RESOLVERS } from '#events/resolvers.js'
import { EFFECTS } from '#triggers/effects.js'
import type { Listener } from '#triggers/effects.js'
import { buildRuleHooks } from '#triggers/buildHooks.js'
import { requireSeat } from '#typeGuards.js'
import type { Ctx } from '#game/ctx.js'
import { SignalBus } from '#triggers/SignalBus.js'

const RUIN_CLEARINGS: ClearingId[] = [5, 9, 10, 11]

const PHASES: Phase[] = ['birdsong', 'daylight', 'evening']

function shuffleWithRng<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(rng, i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function emptyClearings(): GameState['clearings'] {
  return Array.from({ length: 12 }, () => ({ pieces: [] }))
}

function createBoard(faction: PlayerState['faction']): FactionBoard {
  switch (faction) {
    case 'marquise':
      return {
        kind: 'marquise',
        supply: { warriors: 25, wood: 8 },
        tracks: {
          sawmill: { placed: 0 },
          workshop: { placed: 0 },
          recruiter: { placed: 0 },
        },
      }
    case 'eyrie': {
      return {
        kind: 'eyrie',
        supply: { warriors: 20 },
        leader: null,
        leadersFaceUp: [...EYRIE_LEADERS],
        leadersFaceDown: [],
        decree: { recruit: [], move: [], battle: [], build: [] },
        roostTrack: { placed: 0 },
      }
    }
    case 'alliance':
      return {
        kind: 'alliance',
        supply: { warriors: 10 },
        supporters: [],
        officers: 0,
        bases: [],
        sympathyTrack: { placed: 0 },
      }
    case 'vagabond':
      return {
        kind: 'vagabond',
        satchel: [],
        tracks: { tea: [], coin: [], bag: [] },
        damaged: [],
        relationships: {
          marquise: 0,
          eyrie: 0,
          alliance: 0,
          vagabond: 0,
        },
      }
  }
}

function initialState(args: {
  id: string
  seed: number
  factions: GameState['factions']
}): GameState {
  return {
    id: args.id,
    seed: args.seed,
    map: 'fall',
    status: 'waiting',
    turn: 1,
    currentSeat: 0,
    phase: 'birdsong',
    step: 'wood',
    factions: args.factions,
    players: [],
    clearings: emptyClearings(),
    deck: { draw: [], discard: [] },
    dominanceAvailable: [],
    itemSupply: { ...ITEM_SUPPLY },
    pending: [],
    turnScratch: {
      actionsLeft: 0,
      extraActions: 0,
      recruited: false,
      birdsongWoodDone: false,
      eveningDrawDone: false,
      swapMeetUsed: false,
      charmOffensiveUsed: false,
      leagueUsed: false,
      propagandaUsed: false,
      saboteursUsed: false,
      falseOrdersUsed: false,
      eyrieEmigreCompleted: false,
      emergencyOrdersDone: false,
      eveningScoreDone: false,
      decree: null,
      decreeDone: false,
    },
  }
}

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
    for (const f of factions) {
      if (!FACTIONS[f]) throw new RuleError('UNKNOWN_FACTION', { faction: f })
    }
    return new Game({
      state: initialState({
        id: args.id ?? `game-${args.seed}`,
        seed: args.seed,
        factions,
      }),
      history: [],
      log: [],
      rng: new SeededRng({ seed: args.seed, cursor: 0 }),
    })
  }

  static replay(seed: number, actions: Action[]): Game {
    const game = Game.create({ seed })
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
    return FACTIONS[factionOf(state, state.currentSeat)].legalActions(state, ctx)
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

    if (action.type === 'endPhase' && this.state.status === 'playing') {
      logs.push(...this.advanceStepOrPhase())
      logs.push(...this.runAutoActions())
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
    const restored = Game.replay(seed, actions)
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
        this.dispatchSignal(signal, ctx)
      },
      grantedActions: () => this.grantedActions(),
    }
    return ctx
  }

  private dispatchSignal(signal: import('#triggers/signals.js').GameSignal, ctx: Ctx): void {
    this.signalBus.emit(this.state, signal, ctx)
    const seats = [...this.state.players].sort((a, b) => a.seat - b.seat)
    for (const player of seats) {
      for (const card of player.playArea) {
        const effect = EFFECTS[card.defId]
        effect?.onSignal?.(this.state, signal, ctx)
      }
    }
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
    if (action.type === 'swapMeet') {
      const ok = legal.some(
        (spec) => spec.type === 'swapMeet' && spec.actor === this.state.currentSeat,
      )
      if (!ok) throw new RuleError('ILLEGAL_ACTION', { action })
      return
    }
    if (action.type === 'charmOffensive') {
      const ok = legal.some(
        (spec) => spec.type === 'charmOffensive' && spec.actor === this.state.currentSeat,
      )
      if (!ok) throw new RuleError('ILLEGAL_ACTION', { action })
      return
    }
    if (action.type === 'informantsTakeAmbush') {
      const ok = legal.some(
        (spec) =>
          spec.type === 'informantsTakeAmbush' && spec.actor === this.state.currentSeat,
      )
      if (!ok) throw new RuleError('ILLEGAL_ACTION', { action })
      return
    }
    if (action.type === 'leagueMove' || action.type === 'leagueBattle') {
      const ok = legal.some(
        (spec) => spec.type === action.type && spec.actor === this.state.currentSeat,
      )
      if (!ok) throw new RuleError('ILLEGAL_ACTION', { action })
      return
    }
    if (action.type === 'propagandaBureau') {
      const ok = legal.some(
        (spec) => spec.type === 'propagandaBureau' && spec.actor === this.state.currentSeat,
      )
      if (!ok) throw new RuleError('ILLEGAL_ACTION', { action })
      return
    }
    if (action.type === 'saboteurs') {
      const ok = legal.some(
        (spec) => spec.type === 'saboteurs' && spec.actor === this.state.currentSeat,
      )
      if (!ok) throw new RuleError('ILLEGAL_ACTION', { action })
      return
    }
    if (action.type === 'falseOrders') {
      const ok = legal.some(
        (spec) => spec.type === 'falseOrders' && spec.actor === this.state.currentSeat,
      )
      if (!ok) throw new RuleError('ILLEGAL_ACTION', { action })
      return
    }
    if (action.type === 'eyrieEmigre') {
      const ok = legal.some(
        (spec) => spec.type === 'eyrieEmigre' && spec.actor === this.state.currentSeat,
      )
      if (!ok) throw new RuleError('ILLEGAL_ACTION', { action })
      return
    }
    const ok = legal.some(
      (spec) => spec.type === action.type && spec.actor === this.state.currentSeat,
    )
    if (!ok) throw new RuleError('ILLEGAL_ACTION', { action })

    {
      const ctx = this.makeCtx()
      const faction = FACTIONS[factionOf(this.state, this.state.currentSeat)]
      faction.validate(this.state, action, ctx)
    }
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
      default: {
        const ctx = this.makeCtx()
        if (tryApplySwapMeet(this.state, action, ctx)) {
          return [{ t: 'action', actor: this.state.currentSeat, action }]
        }
        if (tryApplyCharmOffensive(this.state, action, ctx)) {
          return [{ t: 'action', actor: this.state.currentSeat, action }]
        }
        if (tryApplyInformants(this.state, action, ctx)) {
          return [{ t: 'action', actor: this.state.currentSeat, action }]
        }
        if (tryApplyLeague(this.state, action, ctx)) {
          return [{ t: 'action', actor: this.state.currentSeat, action }]
        }
        if (tryApplyPropagandaBureau(this.state, action, ctx)) {
          return [{ t: 'action', actor: this.state.currentSeat, action }]
        }
        if (tryApplySaboteurs(this.state, action, ctx)) {
          return [{ t: 'action', actor: this.state.currentSeat, action }]
        }
        if (tryApplyFalseOrders(this.state, action, ctx)) {
          return [{ t: 'action', actor: this.state.currentSeat, action }]
        }
        if (tryApplyEyrieEmigre(this.state, action, ctx)) {
          return [{ t: 'action', actor: this.state.currentSeat, action }]
        }
        const faction = FACTIONS[factionOf(this.state, this.state.currentSeat)]
        faction.validate(this.state, action, ctx)
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
      hand: [],
      playArea: [],
      craftedItems: [],
      board: createBoard(faction),
    })
    return [{ t: 'join', playerId, faction }]
  }

  private applyStart(): LogEntry[] {
    const { state } = this
    if (state.status !== 'waiting') throw new RuleError('NOT_WAITING')
    if (state.players.length <= 1) {
      throw new RuleError('NOT_ENOUGH_PLAYERS', { count: state.players.length })
    }
    this.runSharedSetup()
    state.status = 'setup'

    const marquise = state.players.find((player) => player.faction === 'marquise')
    if (!marquise) throw new RuleError('NO_MARQUISE_FOR_SETUP')
    state.pending.push({ type: 'chooseKeep', seat: marquise.seat })

    return [{ t: 'start' }]
  }

  /** Shared deck/hands/ruins; faction placement waits on chooseKeep (and later chooseLeader). */
  private runSharedSetup(): void {
    const { state } = this
    resetPlaceIds()

    for (const player of state.players) {
      player.vp = 0
      player.hand = []
      player.playArea = []
      player.craftedItems = []
    }

    let deckCards: Card[] = [...EP_DECK]
    if (state.players.length === 2) {
      // Rule: Setup 3 — 2p removes all dominance before shuffle.
      deckCards = deckCards.filter((c) => defOf(c).type !== 'dominance')
    }

    state.deck = {
      draw: shuffleWithRng(deckCards, this.rng),
      discard: [],
    }
    state.dominanceAvailable = []

    for (const player of state.players) {
      player.hand = Deck.draw(state.deck, STARTING_HAND, {
        shuffle: (cards) => shuffleWithRng(cards, this.rng),
        onDominance: (card) => state.dominanceAvailable.push(card),
      })
    }

    state.itemSupply = { ...ITEM_SUPPLY }

    const ruinItems = shuffleWithRng([...RUIN_ITEMS], this.rng)
    for (let i = 0; i < RUIN_CLEARINGS.length; i++) {
      const clearing = RUIN_CLEARINGS[i]!
      state.clearings[clearing] = {
        pieces: [],
        ruin: { items: [ruinItems[i]!] },
      }
    }
  }

  private beginPlaying(): LogEntry[] {
    const { state } = this
    state.status = 'playing'
    state.currentSeat = 0
    const first = FACTIONS[factionOf(state, 0)]
    state.phase = 'birdsong'
    state.step = first.steps.birdsong[0]!
    state.turnScratch = {
      actionsLeft: 0,
      extraActions: 0,
      recruited: false,
      birdsongWoodDone: false,
      eveningDrawDone: false,
      swapMeetUsed: false,
      charmOffensiveUsed: false,
      leagueUsed: false,
      propagandaUsed: false,
      saboteursUsed: false,
      falseOrdersUsed: false,
      eyrieEmigreCompleted: false,
      emergencyOrdersDone: false,
      eveningScoreDone: false,
      decree: null,
      decreeDone: false,
    }

    const ctx = this.makeCtx()
    ctx.emit({ s: 'phase.start', actor: 0, phase: 'birdsong' })

    const autoLogs = this.runAutoActions()
    return [{ t: 'phase', actor: 0, phase: 'birdsong', step: state.step }, ...autoLogs]
  }

  private applyEndPhase(): LogEntry[] {
    const ctx = this.makeCtx()
    const faction = FACTIONS[factionOf(this.state, this.state.currentSeat)]
    faction.validate(this.state, { type: 'endPhase' }, ctx)
    return faction.apply(this.state, { type: 'endPhase' }, ctx)
  }

  private advanceStepOrPhase(): LogEntry[] {
    const { state } = this
    const ctx = this.makeCtx()
    const faction = FACTIONS[factionOf(state, state.currentSeat)]
    const steps = faction.steps[state.phase]
    const idx = steps.indexOf(state.step)
    if (idx < 0) throw new RuleError('INVALID_STEP', { step: state.step })

    const logs: LogEntry[] = []

    if (idx < steps.length - 1) {
      state.step = steps[idx + 1]!
      if (state.phase === 'daylight' && state.step === 'actions') {
        state.turnScratch = {
          actionsLeft: 3,
          extraActions: 0,
          recruited: false,
          birdsongWoodDone: false,
          eveningDrawDone: false,
          swapMeetUsed: false,
          charmOffensiveUsed: false,
          leagueUsed: false,
          propagandaUsed: false,
          saboteursUsed: false,
          falseOrdersUsed: false,
          eyrieEmigreCompleted: false,
          emergencyOrdersDone: false,
          eveningScoreDone: false,
          decree: null,
          decreeDone: false,
        }
      }
      if (state.phase === 'daylight' && state.step === 'decree') {
        state.turnScratch.decree = null
        state.turnScratch.decreeDone = false
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

    const nextFaction = FACTIONS[factionOf(state, nextSeat)]
    state.phase = 'birdsong'
    state.step = nextFaction.steps.birdsong[0]!

    ctx.emit({ s: 'phase.start', actor: nextSeat, phase: 'birdsong' })
    logs.push({ t: 'phase', actor: nextSeat, phase: 'birdsong', step: state.step })

    return logs
  }

  private runAutoActions(): LogEntry[] {
    const logs: LogEntry[] = []
    let guard = 0
    while (guard++ < 50) {
      const faction = FACTIONS[factionOf(this.state, this.state.currentSeat)]
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
      if (action.leader !== undefined && s.params?.leaders?.includes(action.leader)) {
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
    const contenders = state.players.filter((p) => p.vp >= 30)
    if (contenders.length === 0) return []

    let winner: Seat
    if (contenders.length === 1) {
      winner = contenders[0]!.seat
    } else {
      // Rule: Victory — tie at 30+ → current turn player wins.
      winner = state.currentSeat
    }

    state.winner = winner
    state.status = 'finished'
    return [{ t: 'win', winner }]
  }
}
