import { useSyncExternalStore, type JSX } from 'react'
import { LuSkull, LuSwords } from 'react-icons/lu'
import {
  factionTextureKey,
  imagePathForAssetKey,
  suitTextureKey,
} from '#assets/gameAssets.ts'
import { fallClearingSuit } from '#game/boardLayout.ts'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
import { factionColorCss } from '#game/theme.ts'
import {
  BATTLE_STAGE_LABELS,
  BATTLE_STEPS,
  battleResultFlashPrompt,
  battleRoleRemovingPieces,
  battleStepIndex,
  type BattleOverlayViewModel,
  type BattleRole,
  type BattleStep,
} from '#ui/BattleOverlay.ts'

const GUERRILLA_WAR_FACTION = 'alliance'
const ATTACKER_ROLE_LABEL = 'ATK'
const DEFENDER_ROLE_LABEL = 'DEF'
/** Shown on the die before the roll. */
const UNROLLED_DIE_FACE = '?'

/** Middle of the screen; clicks pass through to the board under it. */
const PANEL_CLASS_NAME =
  'pointer-events-none absolute top-1/2 left-1/2 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3'
/**
 * Dims the board behind the battle. Sits under the HUD (rail, tray, hand,
 * banner) so the buttons that answer the battle stay bright and clickable.
 */
const BACKDROP_CLASS_NAME =
  'battle-overlay__backdrop pointer-events-none fixed inset-0 z-50 bg-forest-deep/72'
const HEADLINE_CLASS_NAME =
  'battle-overlay__headline root-paper m-0 flex flex-row items-center gap-2 px-5 py-1.5 text-center font-display text-xl leading-tight text-ink md:text-2xl'
const HEADLINE_FLASH_CLASS_NAME = '[--root-paper-color:var(--color-gold)]'
const HEADLINE_SUIT_CLASS_NAME = 'size-6 shrink-0 object-contain md:size-7'
/** Progress track: done steps moss, the current one rust, the rest faded. */
const STEP_CLASS_NAME =
  'border-b-3 px-2 pb-0.5 font-mono text-[11px] tracking-wide uppercase text-shadow-outline md:text-xs'
const STEP_DONE_CLASS_NAME = `${STEP_CLASS_NAME} border-moss text-parchment/80`
const STEP_CURRENT_CLASS_NAME = `${STEP_CLASS_NAME} border-gold font-bold text-parchment`
const STEP_TODO_CLASS_NAME = `${STEP_CLASS_NAME} border-parchment/30 text-parchment/45`
const PROMPT_CLASS_NAME =
  'battle-overlay__prompt root-paper root-paper-fine m-0 px-4 py-1 text-center font-display text-base text-ink md:text-lg'
/** Portrait tile: the paper takes the faction tint from the text colour. */
const PORTRAIT_TILE_CLASS_NAME =
  'root-paper relative box-border flex size-20 items-center justify-center p-2 [--root-paper-color:currentColor] md:size-28'
/** The side removing its pieces: rust edge and a skull badge. */
const PORTRAIT_TILE_LOSING_CLASS_NAME =
  '[--root-paper-edge:var(--color-rust)]'
const LOSING_BADGE_CLASS_NAME =
  'root-paper root-medallion absolute -top-3 flex size-7 items-center justify-center text-base text-parchment [--root-paper-color:var(--color-rust)] md:size-8 md:text-lg'
const DIE_CLASS_NAME =
  'battle-overlay__die root-paper root-paper-fine absolute -bottom-3 flex size-10 items-center justify-center font-mono text-2xl font-bold text-ink [--root-paper-color:var(--color-paper-bright)] md:size-12 md:text-3xl'
const DIE_UNROLLED_CLASS_NAME = 'opacity-60'
const ATTACKER_DIE_CLASS_NAME = `${DIE_CLASS_NAME} -right-4 rotate-6`
const DEFENDER_DIE_CLASS_NAME = `${DIE_CLASS_NAME} -left-4 -rotate-6`
const ATTACKER_LOSING_BADGE_CLASS_NAME = `${LOSING_BADGE_CLASS_NAME} -left-3`
const DEFENDER_LOSING_BADGE_CLASS_NAME = `${LOSING_BADGE_CLASS_NAME} -right-3`
/** Name strap under the tile: role tag + faction. */
const NAME_STRAP_CLASS_NAME =
  'battle-overlay__meta root-paper root-paper-fine m-0 flex flex-row items-center gap-1.5 px-2.5 py-0.5 font-display text-base text-ink capitalize md:text-lg'
const ROLE_TAG_CLASS_NAME =
  'font-mono text-[10px] tracking-wide text-ink-soft uppercase'
/** Hits this side deals: one sword medallion each, then the count. */
const HITS_ROW_CLASS_NAME =
  'flex h-7 flex-row items-center gap-1 font-mono text-sm font-bold text-parchment text-shadow-outline'
const HIT_CLASS_NAME =
  'root-paper root-medallion flex size-6 items-center justify-center text-sm text-parchment text-shadow-none [--root-paper-color:var(--color-rust)] md:size-7 md:text-base'
const NO_HITS_CLASS_NAME = 'font-normal text-parchment/60'
const SIDE_CLASS_NAME = 'battle-overlay__side flex flex-col items-center gap-3.5'
const CLASH_MARK_CLASS_NAME =
  'root-paper root-paper-fine mt-6 flex size-11 rotate-45 items-center justify-center text-2xl text-parchment [--root-paper-color:var(--color-rust)] md:mt-9 md:size-12'
/** Faction colour softened toward parchment so the head icon stays readable. */
const PORTRAIT_TINT_PERCENT = 55

type BattleSideView = {
  role: BattleRole
  roleLabel: string
  faction: string
  roll: number | null
  hits: number
  isRemovingPieces: boolean
}

function stepClassName(stepIndex: number, currentStepIndex: number): string {
  if (stepIndex < currentStepIndex) {
    return STEP_DONE_CLASS_NAME
  }
  return stepIndex === currentStepIndex
    ? STEP_CURRENT_CLASS_NAME
    : STEP_TODO_CLASS_NAME
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
  const headline = isOutcomeFlash
    ? `${viewModel.outcomeMessage} · C${String(viewModel.clearing)}`
    : `Battle · C${String(viewModel.clearing)}`
  const stagePrompt: string = isOutcomeFlash
    ? battleResultFlashPrompt(viewModel.hits)
    : (viewModel.prompt ??
      BATTLE_STAGE_LABELS[viewModel.stage] ??
      viewModel.stage)
  const callbacks = getHudCallbacks()
  // Rule: 8.2.2 Guerrilla War — defending Alliance uses the higher die.
  const defenderUsesHigherDie =
    viewModel.defenderFaction === GUERRILLA_WAR_FACTION
  const highDie = viewModel.rolls?.[0] ?? null
  const lowDie = viewModel.rolls?.[1] ?? null
  const attackerDie = defenderUsesHigherDie ? lowDie : highDie
  const defenderDie = defenderUsesHigherDie ? highDie : lowDie
  const removingRole: BattleRole | null = battleRoleRemovingPieces(
    viewModel.stage,
  )
  const currentStepIndex: number = battleStepIndex(viewModel.stage)
  const clearingSuit = fallClearingSuit(viewModel.clearing)
  const suitTexture: string | null =
    clearingSuit !== null ? suitTextureKey(clearingSuit) : null
  const suitImagePath: string | null =
    suitTexture !== null ? imagePathForAssetKey(suitTexture) : null

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
                ? `${HEADLINE_CLASS_NAME} ${HEADLINE_FLASH_CLASS_NAME}`
                : HEADLINE_CLASS_NAME
            }
          >
            {suitImagePath !== null ? (
              <img
                className={HEADLINE_SUIT_CLASS_NAME}
                src={suitImagePath}
                alt={clearingSuit ?? ''}
                draggable={false}
              />
            ) : null}
            {headline}
          </p>
          <div className="flex flex-row gap-1" aria-hidden="true">
            {BATTLE_STEPS.map((step: BattleStep, stepIndex: number) => (
              <span
                key={step.label}
                className={stepClassName(stepIndex, currentStepIndex)}
              >
                {step.label}
              </span>
            ))}
          </div>
          <div className="battle-overlay__sides mt-2 flex flex-row items-start justify-center gap-6 md:gap-8">
            <BattleSide
              side={{
                role: 'attacker',
                roleLabel: ATTACKER_ROLE_LABEL,
                faction: viewModel.attackerFaction,
                roll: attackerDie,
                hits: viewModel.hits.attacker,
                isRemovingPieces: removingRole === 'attacker',
              }}
            />
            <span className={CLASH_MARK_CLASS_NAME} aria-hidden="true">
              <LuSwords className="-rotate-45" />
            </span>
            <BattleSide
              side={{
                role: 'defender',
                roleLabel: DEFENDER_ROLE_LABEL,
                faction: viewModel.defenderFaction,
                roll: defenderDie,
                hits: viewModel.hits.defender,
                isRemovingPieces: removingRole === 'defender',
              }}
            />
          </div>
          {stagePrompt.length > 0 ? (
            <p className={PROMPT_CLASS_NAME}>{stagePrompt}</p>
          ) : null}
        </div>
      </div>
    </>
  )
}

function BattleSide(props: { side: BattleSideView }): JSX.Element {
  const side: BattleSideView = props.side
  const waiting: boolean = side.roll === null
  const isAttacker: boolean = side.role === 'attacker'
  const headPath: string | null = imagePathForAssetKey(
    factionTextureKey(side.faction),
  )
  const hitMarks: readonly number[] = Array.from(
    { length: side.hits },
    (_: undefined, index: number): number => index,
  )
  const dieClassName: string = isAttacker
    ? ATTACKER_DIE_CLASS_NAME
    : DEFENDER_DIE_CLASS_NAME
  return (
    <div
      className={SIDE_CLASS_NAME}
      role="group"
      aria-label={
        waiting
          ? `${side.roleLabel} ${side.faction} (waiting roll)`
          : `${side.roleLabel} ${side.faction} die ${String(side.roll)} → ${String(side.hits)} hit`
      }
    >
      <div
        className={
          side.isRemovingPieces
            ? `${PORTRAIT_TILE_CLASS_NAME} ${PORTRAIT_TILE_LOSING_CLASS_NAME}`
            : PORTRAIT_TILE_CLASS_NAME
        }
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
        {side.isRemovingPieces ? (
          <span
            className={
              isAttacker
                ? ATTACKER_LOSING_BADGE_CLASS_NAME
                : DEFENDER_LOSING_BADGE_CLASS_NAME
            }
            aria-hidden="true"
          >
            <LuSkull />
          </span>
        ) : null}
        <span
          className={
            waiting ? `${dieClassName} ${DIE_UNROLLED_CLASS_NAME}` : dieClassName
          }
          aria-hidden="true"
        >
          {waiting ? UNROLLED_DIE_FACE : String(side.roll)}
        </span>
      </div>
      <p className={NAME_STRAP_CLASS_NAME} aria-hidden="true">
        <span className={ROLE_TAG_CLASS_NAME}>{side.roleLabel}</span>
        {side.faction}
      </p>
      <div className={HITS_ROW_CLASS_NAME} aria-hidden="true">
        {hitMarks.length > 0 ? (
          <>
            {hitMarks.map((hitIndex: number) => (
              <span key={hitIndex} className={HIT_CLASS_NAME}>
                <LuSwords />
              </span>
            ))}
            <span className="ml-1">
              {hitMarks.length === 1
                ? '1 hit'
                : `${String(hitMarks.length)} hits`}
            </span>
          </>
        ) : (
          <span className={NO_HITS_CLASS_NAME}>no hits</span>
        )}
      </div>
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
