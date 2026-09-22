import type Phaser from 'phaser'
import type { ActionSpec, GameState } from '#api/client.ts'
import { gameViewSize } from '#game/hiDpi.ts'

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
  if (
    type === 'chooseKeep' ||
    type === 'chooseLeader' ||
    type === 'placeStartingBuilding'
  ) {
    const seat = Reflect.get(event, 'seat')
    return typeof seat === 'number' ? seat : null
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
  if (state.status === 'setup') {
    return setupPrompt(state.pending[0]) ?? 'Setup'
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

function setupPrompt(pending: unknown): string | null {
  if (typeof pending !== 'object' || pending === null) {
    return null
  }
  const type = Reflect.get(pending, 'type')
  if (type === 'chooseKeep') {
    return 'Choose keep corner'
  }
  if (type === 'placeStartingBuilding') {
    const building = Reflect.get(pending, 'building')
    if (typeof building === 'string') {
      return `Place ${building}`
    }
    return 'Place starting building'
  }
  if (type === 'chooseLeader') {
    return 'Choose Eyrie leader'
  }
  return null
}

export type TurnBannerOption = {
  label: string
  value: string
}

export type TurnBannerHandlers = {
  onConfirm: () => void
  onCancel: () => void
  onPickOption?: (value: string) => void
}

export type TurnBannerComposerView = {
  message: string
  canConfirm: boolean
  canCancel: boolean
  options: readonly TurnBannerOption[]
}

/**
 * Single top strip: turn status, or composer prompt + controls when staging.
 */
export class TurnBanner {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private readonly panel: Phaser.GameObjects.Rectangle
  private readonly statusText: Phaser.GameObjects.Text
  private readonly confirmButton: Phaser.GameObjects.Text
  private readonly cancelButton: Phaser.GameObjects.Text
  private optionNodes: Phaser.GameObjects.GameObject[] = []
  private handlers: TurnBannerHandlers
  private lastView: TurnBannerViewModel | null = null
  private lastComposer: TurnBannerComposerView | null = null

  constructor(scene: Phaser.Scene, handlers: TurnBannerHandlers) {
    this.scene = scene
    this.handlers = handlers
    const { width } = gameViewSize()
    const bannerWidth = Math.min(640, width - 24)

    this.panel = scene.add
      .rectangle(0, 0, bannerWidth, 36, 0x0a0a0a, 0.45)
      .setStrokeStyle(1, 0xf0e6d3, 0.25)

    this.statusText = scene.add
      .text(0, 0, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        color: '#f0e6d3',
        align: 'center',
        wordWrap: { width: bannerWidth - 160 },
      })
      .setOrigin(0.5)

    this.confirmButton = scene.add
      .text(0, 0, 'OK', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#1a1a1a',
        backgroundColor: '#a8d8a8',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)

    this.cancelButton = scene.add
      .text(0, 0, 'X', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#1a1a1a',
        backgroundColor: '#d8a8a8',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)

    this.confirmButton.on('pointerdown', () => {
      this.handlers.onConfirm()
    })
    this.cancelButton.on('pointerdown', () => {
      this.handlers.onCancel()
    })

    this.root = scene.add
      .container(width / 2, 28, [
        this.panel,
        this.statusText,
        this.confirmButton,
        this.cancelButton,
      ])
      .setDepth(130)
  }

  setHandlers(handlers: TurnBannerHandlers): void {
    this.handlers = handlers
  }

  syncTurn(viewModel: TurnBannerViewModel): void {
    this.lastView = viewModel
    this.repaint()
  }

  syncComposer(composer: TurnBannerComposerView | null): void {
    this.lastComposer = composer
    this.repaint()
  }

  private repaint(): void {
    for (const node of this.optionNodes) {
      node.destroy()
    }
    this.optionNodes = []

    const view = this.lastView
    if (view === null) {
      return
    }

    const composer = this.lastComposer
    const halfWidth = this.panel.width / 2

    if (composer === null) {
      this.statusText.setText(
        `${view.actorFaction} · ${view.phase}/${view.step} — ${view.prompt}`,
      )
      this.statusText.setPosition(0, 0)
      this.confirmButton.setVisible(false)
      this.cancelButton.setVisible(false)
      this.panel.setSize(this.panel.width, 36)
      return
    }

    this.statusText.setText(`${view.actorFaction} · ${composer.message}`)
    this.statusText.setPosition(0, composer.options.length > 0 ? -14 : 0)

    this.confirmButton.setVisible(composer.canConfirm)
    this.cancelButton.setVisible(composer.canCancel)
    this.confirmButton.setPosition(
      halfWidth - 52,
      composer.options.length > 0 ? -14 : 0,
    )
    this.cancelButton.setPosition(
      halfWidth - 18,
      composer.options.length > 0 ? -14 : 0,
    )

    composer.options.forEach((option, index) => {
      const button = this.scene.add
        .text(
          (index - (composer.options.length - 1) / 2) * 88,
          14,
          option.label,
          {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#1a1a1a',
            backgroundColor: '#c8d8f0',
            padding: { x: 6, y: 3 },
          },
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      button.on('pointerdown', () => {
        this.handlers.onPickOption?.(option.value)
      })
      this.root.add(button)
      this.optionNodes.push(button)
    })

    this.panel.setSize(
      this.panel.width,
      composer.options.length > 0 ? 56 : 36,
    )
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
