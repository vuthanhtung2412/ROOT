import type Phaser from 'phaser'

export type BattleOverlayViewModel = {
  clearing: number
  stage: string
  attackerFaction: string
  defenderFaction: string
  /** Root battle dice: [higher → attacker, lower → defender]. */
  rolls: readonly [number, number] | null
  hits: { attacker: number; defender: number }
  prompt: string | null
}

const STAGE_LABELS: Record<string, string> = {
  ambush: 'Ambush?',
  foil: 'Foil ambush?',
  roll: 'Rolling…',
  effectsOrder: 'Choose effects order',
  effects: 'Battle card effect?',
  removeDefender: 'Remove defender pieces',
  removeAttacker: 'Remove attacker pieces',
}

/**
 * Top battle strip: stage + big dice + hits.
 * Visible whenever a battle event is pending — not only mid-composer.
 */
export class BattleOverlay {
  private readonly root: Phaser.GameObjects.Container
  private readonly headline: Phaser.GameObjects.Text
  private readonly promptText: Phaser.GameObjects.Text
  private readonly attackerDie: DieFace
  private readonly defenderDie: DieFace
  private readonly attackerMeta: Phaser.GameObjects.Text
  private readonly defenderMeta: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    const { width } = scene.scale
    const centerX = width / 2
    // Sit under TurnBanner (~y 18–46)
    const panelY = 118

    const panel = scene.add
      .rectangle(centerX, panelY, Math.min(540, width - 40), 132, 0x1a2438, 0.94)
      .setStrokeStyle(2, 0xc8a45c, 0.9)

    this.headline = scene.add
      .text(centerX, panelY - 52, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#f0e6d3',
      })
      .setOrigin(0.5)

    this.promptText = scene.add
      .text(centerX, panelY + 56, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#c8d0e0',
      })
      .setOrigin(0.5)

    this.attackerDie = new DieFace(scene, centerX - 120, panelY - 6)
    this.defenderDie = new DieFace(scene, centerX + 120, panelY - 6)

    this.attackerMeta = scene.add
      .text(centerX - 120, panelY + 34, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f0e6d3',
        align: 'center',
      })
      .setOrigin(0.5, 0)

    this.defenderMeta = scene.add
      .text(centerX + 120, panelY + 34, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f0e6d3',
        align: 'center',
      })
      .setOrigin(0.5, 0)

    this.root = scene.add
      .container(0, 0, [
        panel,
        this.headline,
        this.promptText,
        this.attackerDie.container,
        this.defenderDie.container,
        this.attackerMeta,
        this.defenderMeta,
      ])
      .setDepth(201)
    this.root.setVisible(false)
  }

  sync(viewModel: BattleOverlayViewModel | null): void {
    if (viewModel === null) {
      this.root.setVisible(false)
      return
    }

    const stageLabel = STAGE_LABELS[viewModel.stage] ?? viewModel.stage
    this.headline.setText(
      `Battle · C${String(viewModel.clearing)} · ${stageLabel}`,
    )

    if (viewModel.rolls !== null) {
      const [attackerRoll, defenderRoll] = viewModel.rolls
      this.attackerDie.setValue(attackerRoll)
      this.defenderDie.setValue(defenderRoll)
      this.attackerDie.setVisible(true)
      this.defenderDie.setVisible(true)
      this.attackerMeta.setText(
        [
          `ATK ${viewModel.attackerFaction}`,
          `die ${String(attackerRoll)} → ${String(viewModel.hits.attacker)} hit`,
        ].join('\n'),
      )
      this.defenderMeta.setText(
        [
          `DEF ${viewModel.defenderFaction}`,
          `die ${String(defenderRoll)} → ${String(viewModel.hits.defender)} hit`,
        ].join('\n'),
      )
    } else {
      this.attackerDie.setVisible(false)
      this.defenderDie.setVisible(false)
      this.attackerMeta.setText(`ATK ${viewModel.attackerFaction}\n(waiting roll)`)
      this.defenderMeta.setText(`DEF ${viewModel.defenderFaction}\n(waiting roll)`)
    }

    this.promptText.setText(viewModel.prompt ?? '')
    this.root.setVisible(true)
  }

  destroy(): void {
    this.root.destroy(true)
  }
}

class DieFace {
  readonly container: Phaser.GameObjects.Container
  private readonly valueText: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const face = scene.add
      .rectangle(0, 0, 58, 58, 0xf0e6d3, 1)
      .setStrokeStyle(3, 0x1a1a1a, 1)
    this.valueText = scene.add
      .text(0, 2, '—', {
        fontFamily: 'Georgia, serif',
        fontSize: '34px',
        color: '#1a1a1a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.container = scene.add.container(x, y, [face, this.valueText])
  }

  setValue(value: number): void {
    this.valueText.setText(String(value))
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible)
  }
}
