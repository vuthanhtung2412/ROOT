import type Phaser from 'phaser'
import type { GameState } from '../api/client.ts'

export type TurnBannerViewModel = {
  actorSeat: number
  actorFaction: string
  phase: string
  step: string
  prompt: string
}

/** Prefer pending[0].actor over currentSeat when an event is waiting. */
export function buildTurnBannerViewModel(
  state: GameState,
): TurnBannerViewModel {
  const pendingActor = readPendingActor(state.pending)
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

function readPendingActor(pending: unknown[]): number | null {
  const first = pending[0]
  if (typeof first !== 'object' || first === null) {
    return null
  }
  if (!('actor' in first)) {
    return null
  }
  const actor = Reflect.get(first, 'actor')
  return typeof actor === 'number' ? actor : null
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
