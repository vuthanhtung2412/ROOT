import type Phaser from 'phaser'
import type { ActionSpec, GameState } from '../api/client.ts'

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
  if (typeof event !== 'object' || event === null) {
    return null
  }
  const type = Reflect.get(event, 'type')
  if (type === 'fieldHospital') {
    const victim = Reflect.get(event, 'victim')
    return typeof victim === 'number' ? victim : null
  }
  if (type !== 'battle') {
    return null
  }
  const stage = Reflect.get(event, 'stage')
  const attacker = Reflect.get(event, 'attacker')
  const defender = Reflect.get(event, 'defender')
  if (typeof attacker !== 'number' || typeof defender !== 'number') {
    return null
  }
  if (stage === 'ambush' || stage === 'removeDefender') {
    return defender
  }
  if (
    stage === 'foil' ||
    stage === 'effectsOrder' ||
    stage === 'removeAttacker'
  ) {
    return attacker
  }
  if (stage === 'effects') {
    return nextBattleEffectSeat(event, attacker, defender)
  }
  return null
}

function nextBattleEffectSeat(
  event: object,
  attacker: number,
  defender: number,
): number | null {
  const orderRaw = Reflect.get(event, 'effectsOrder')
  const order =
    Array.isArray(orderRaw) &&
    orderRaw.every((seat) => typeof seat === 'number')
      ? orderRaw
      : [attacker, defender]
  const effectsUsed = Reflect.get(event, 'effectsUsed')
  const used =
    typeof effectsUsed === 'object' && effectsUsed !== null
      ? effectsUsed
      : {}
  for (const seat of order) {
    const side = seat === attacker ? 'attacker' : 'defender'
    if (Reflect.get(used, side) === undefined) {
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
  if (fromPending) {
    return `Pending choice · seat ${String(actorSeat)}`
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

export class TurnBanner {
  private readonly text: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    const { width } = scene.scale
    this.text = scene.add
      .text(width / 2, 18, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#f0e6d3',
        backgroundColor: '#1a1a1acc',
        padding: { x: 14, y: 8 },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(100)
  }

  sync(viewModel: TurnBannerViewModel): void {
    this.text.setText(
      `${viewModel.actorFaction} · ${viewModel.phase}/${viewModel.step} — ${viewModel.prompt}`,
    )
  }

  destroy(): void {
    this.text.destroy()
  }
}
