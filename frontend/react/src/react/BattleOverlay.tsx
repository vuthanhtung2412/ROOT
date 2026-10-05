import { useSyncExternalStore, type JSX } from 'react'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
import {
  BATTLE_STAGE_LABELS,
  battleResultFlashPrompt,
  type BattleOverlayViewModel,
} from '#ui/BattleOverlay.ts'
import '#react/BattleOverlay.css'

const GUERRILLA_WAR_FACTION = 'alliance'

export function BattleOverlay(): JSX.Element | null {
  const viewModel = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().battleOverlay,
    () => getHudSnapshot().battleOverlay,
  )
  if (viewModel === null) {
    return null
  }
  const isOutcomeFlash = viewModel.outcomeMessage !== null
  const stageLabel = isOutcomeFlash
    ? viewModel.outcomeMessage
    : (BATTLE_STAGE_LABELS[viewModel.stage] ?? viewModel.stage)
  const headline = isOutcomeFlash
    ? `${viewModel.outcomeMessage} · C${String(viewModel.clearing)}`
    : `Battle · C${String(viewModel.clearing)} · ${stageLabel}`
  const prompt = isOutcomeFlash
    ? battleResultFlashPrompt(viewModel.hits)
    : (viewModel.prompt ?? '')
  const callbacks = getHudCallbacks()
  // Rule: 8.2.2 Guerrilla War — defending Alliance uses the higher die.
  const defenderUsesHigherDie =
    viewModel.defenderFaction === GUERRILLA_WAR_FACTION
  const highDie = viewModel.rolls?.[0] ?? null
  const lowDie = viewModel.rolls?.[1] ?? null
  const attackerDie = defenderUsesHigherDie ? lowDie : highDie
  const defenderDie = defenderUsesHigherDie ? highDie : lowDie

  return (
    <div className="battle-overlay">
      {isOutcomeFlash ? (
        <button
          type="button"
          className="battle-overlay__veil"
          aria-label="Dismiss battle result"
          onClick={() => {
            callbacks.onBattleOutsideClick()
          }}
        />
      ) : null}
      <div
        className={
          isOutcomeFlash
            ? 'battle-overlay__panel battle-overlay__panel--flash'
            : 'battle-overlay__panel'
        }
      >
        <p
          className={
            isOutcomeFlash
              ? 'battle-overlay__headline battle-overlay__headline--flash'
              : 'battle-overlay__headline'
          }
        >
          {headline}
        </p>
        <div className="battle-overlay__sides">
          <BattleSide
            roleLabel="ATK"
            faction={viewModel.attackerFaction}
            roll={attackerDie}
            hits={viewModel.hits.attacker}
          />
          <BattleSide
            roleLabel="DEF"
            faction={viewModel.defenderFaction}
            roll={defenderDie}
            hits={viewModel.hits.defender}
          />
        </div>
        {prompt.length > 0 ? (
          <p className="battle-overlay__prompt">{prompt}</p>
        ) : null}
      </div>
    </div>
  )
}

function BattleSide(props: {
  roleLabel: string
  faction: string
  roll: number | null
  hits: number
}): JSX.Element {
  const waiting = props.roll === null
  return (
    <div className="battle-overlay__side">
      {waiting ? null : (
        <div className="battle-overlay__die">{String(props.roll)}</div>
      )}
      <p className="battle-overlay__meta">
        {waiting
          ? `${props.roleLabel} ${props.faction}\n(waiting roll)`
          : `${props.roleLabel} ${props.faction}\ndie ${String(props.roll)} → ${String(props.hits)} hit`}
      </p>
    </div>
  )
}

export function syncBattleOverlayView(
  viewModel: BattleOverlayViewModel | null,
): void {
  patchHud({
    battleOverlay: viewModel,
  })
}
