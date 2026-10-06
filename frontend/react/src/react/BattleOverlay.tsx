import { useSyncExternalStore, type JSX } from 'react'
import { LuSwords } from 'react-icons/lu'
import {
  factionTextureKey,
  imagePathForAssetKey,
} from '#assets/gameAssets.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
import { factionColorCss } from '#game/theme.ts'
import {
  BATTLE_STAGE_LABELS,
  battleResultFlashPrompt,
  type BattleOverlayViewModel,
} from '#ui/BattleOverlay.ts'

const GUERRILLA_WAR_FACTION = 'alliance'
const ATTACKER_ROLE_LABEL = 'ATK'
const DEFENDER_ROLE_LABEL = 'DEF'

/** Middle of the screen; clicks pass through to the board under it. */
const PANEL_CLASS_NAME =
  'pointer-events-none absolute top-1/2 left-1/2 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2'
/**
 * Dims the board behind the battle. Sits under the HUD (rail, tray, hand,
 * banner) so the buttons that answer the battle stay bright and clickable.
 */
const BACKDROP_CLASS_NAME =
  'battle-overlay__backdrop pointer-events-none fixed inset-0 z-50 bg-forest-deep/72'
const STRAP_CLASS_NAME =
  'battle-overlay__headline root-paper root-paper-fine m-0 px-4 py-1 text-center font-display text-base leading-tight text-ink md:text-lg'
const STRAP_FLASH_CLASS_NAME = '[--root-paper-color:var(--color-gold)]'
const PROMPT_CLASS_NAME =
  'battle-overlay__prompt root-paper root-paper-fine m-0 px-3 py-0.5 text-center font-display text-sm text-ink'
/** Portrait tile: the paper takes the faction tint from the text colour. */
const PORTRAIT_TILE_CLASS_NAME =
  'root-paper relative box-border flex size-16 items-center justify-center p-1.5 [--root-paper-color:currentColor] md:size-20'
const DIE_CLASS_NAME =
  'battle-overlay__die root-paper root-paper-fine absolute -bottom-2 flex size-8 items-center justify-center font-display text-xl font-bold text-ink [--root-paper-color:var(--color-paper-bright)] md:size-9 md:text-2xl'
const ATTACKER_DIE_CLASS_NAME = `${DIE_CLASS_NAME} -right-3 rotate-6`
const DEFENDER_DIE_CLASS_NAME = `${DIE_CLASS_NAME} -left-3 -rotate-6`
const HIT_CLASS_NAME =
  'root-paper root-medallion flex size-6 items-center justify-center text-sm text-parchment [--root-paper-color:var(--color-rust)]'
/** ATK / DEF tag pinned on top of the portrait tile. */
const ROLE_LABEL_CLASS_NAME =
  'battle-overlay__meta root-paper root-paper-fine absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 font-mono text-[10px] leading-4 text-ink [--root-paper-color:var(--color-paper-bright)]'
/** Hit marks sit between the portrait tile and the clash mark. */
const SIDE_CLASS_NAME = 'battle-overlay__side flex items-center gap-2'
const ATTACKER_SIDE_CLASS_NAME = `${SIDE_CLASS_NAME} flex-row`
const DEFENDER_SIDE_CLASS_NAME = `${SIDE_CLASS_NAME} flex-row-reverse`
const CLASH_MARK_CLASS_NAME =
  'root-paper root-paper-fine flex size-9 rotate-45 items-center justify-center text-lg text-parchment [--root-paper-color:var(--color-rust)]'
/** Faction colour softened toward parchment so the head icon stays readable. */
const PORTRAIT_TINT_PERCENT = 55

type BattleSideView = {
  roleLabel: string
  faction: string
  roll: number | null
  hits: number
  sideClassName: string
  dieClassName: string
}

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
    <>
    <div className={BACKDROP_CLASS_NAME} aria-hidden="true" />
    <div className="battle-overlay pointer-events-none fixed inset-0 z-201">
      {isOutcomeFlash ? (
        <button
          type="button"
          className="battle-overlay__veil pointer-events-auto absolute inset-0 m-0 cursor-pointer border-0 bg-transparent p-0"
          aria-label="Dismiss battle result"
          onClick={() => {
            callbacks.onBattleOutsideClick()
          }}
        />
      ) : null}
      <div className={`battle-overlay__panel ${PANEL_CLASS_NAME}`}>
        <p
          className={
            isOutcomeFlash
              ? `${STRAP_CLASS_NAME} ${STRAP_FLASH_CLASS_NAME}`
              : STRAP_CLASS_NAME
          }
        >
          {headline}
        </p>
        <div className="battle-overlay__sides mt-1.5 flex flex-row items-center justify-center gap-3">
          <BattleSide
            side={{
              roleLabel: ATTACKER_ROLE_LABEL,
              faction: viewModel.attackerFaction,
              roll: attackerDie,
              hits: viewModel.hits.attacker,
              sideClassName: ATTACKER_SIDE_CLASS_NAME,
              dieClassName: ATTACKER_DIE_CLASS_NAME,
            }}
          />
          <span className={CLASH_MARK_CLASS_NAME} aria-hidden="true">
            <LuSwords className="-rotate-45" />
          </span>
          <BattleSide
            side={{
              roleLabel: DEFENDER_ROLE_LABEL,
              faction: viewModel.defenderFaction,
              roll: defenderDie,
              hits: viewModel.hits.defender,
              sideClassName: DEFENDER_SIDE_CLASS_NAME,
              dieClassName: DEFENDER_DIE_CLASS_NAME,
            }}
          />
        </div>
        {prompt.length > 0 ? <p className={PROMPT_CLASS_NAME}>{prompt}</p> : null}
      </div>
    </div>
    </>
  )
}

function BattleSide(props: { side: BattleSideView }): JSX.Element {
  const side: BattleSideView = props.side
  const waiting: boolean = side.roll === null
  const headPath: string | null = imagePathForAssetKey(
    factionTextureKey(side.faction),
  )
  const hitMarks: readonly number[] = Array.from(
    { length: side.hits },
    (_: undefined, index: number): number => index,
  )
  return (
    <div
      className={side.sideClassName}
      role="group"
      aria-label={
        waiting
          ? `${side.roleLabel} ${side.faction} (waiting roll)`
          : `${side.roleLabel} ${side.faction} die ${String(side.roll)} → ${String(side.hits)} hit`
      }
    >
      <div
        className={PORTRAIT_TILE_CLASS_NAME}
        style={{
          color: `color-mix(in srgb, ${factionColorCss(side.faction)} ${String(PORTRAIT_TINT_PERCENT)}%, var(--color-parchment))`,
        }}
      >
        {headPath !== null ? (
          <img
            className="size-full object-contain"
            src={headPath}
            alt={side.faction}
            draggable={false}
          />
        ) : null}
        <span className={ROLE_LABEL_CLASS_NAME} aria-hidden="true">
          {side.roleLabel}
        </span>
        {waiting ? null : (
          <span className={side.dieClassName} aria-hidden="true">
            {String(side.roll)}
          </span>
        )}
      </div>
      {hitMarks.length > 0 ? (
        <div className="grid grid-cols-2 gap-1" aria-hidden="true">
          {hitMarks.map((hitIndex: number) => (
            <span key={hitIndex} className={HIT_CLASS_NAME}>
              <LuSwords />
            </span>
          ))}
        </div>
      ) : null}
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
