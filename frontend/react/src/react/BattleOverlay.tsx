import { useSyncExternalStore, type JSX } from 'react'
import { GiBrokenShield } from 'react-icons/gi'
import { LuShield, LuSword, LuSwords } from 'react-icons/lu'
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
  battleResultFlashPrompt,
  battleStrapText,
  type BattleOverlayViewModel,
  type BattleRole,
} from '#ui/BattleOverlay.ts'

const GUERRILLA_WAR_FACTION = 'alliance'
const ATTACKER_ROLE_LABEL = 'ATK'
const DEFENDER_ROLE_LABEL = 'DEF'
/** Shown on the die before the roll. */
const UNROLLED_DIE_FACE = '?'

/** Middle of the screen; clicks pass through to the board under it. */
const PANEL_CLASS_NAME =
  'pointer-events-none absolute top-1/2 left-1/2 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4'
/**
 * Dims the board behind the battle. Sits under the HUD (rail, tray, hand,
 * banner) so the buttons that answer the battle stay bright and clickable.
 */
const BACKDROP_CLASS_NAME =
  'battle-overlay__backdrop pointer-events-none fixed inset-0 z-50 bg-forest-deep/72'
/** Two portrait tiles, the clearing mark between their lower corners. */
const SIDES_CLASS_NAME =
  'battle-overlay__sides relative flex flex-row items-start justify-center gap-24 md:gap-32'
const SIDE_CLASS_NAME = 'battle-overlay__side flex flex-col items-center gap-3'
/** Portrait tile: the paper takes the faction tint from the text colour. */
const PORTRAIT_TILE_CLASS_NAME =
  'root-paper relative box-border flex size-24 items-center justify-center p-2.5 [--root-paper-color:currentColor] md:size-32'
/** Die on the tile's inner bottom corner, leaning toward the clearing mark. */
const DIE_CLASS_NAME =
  'battle-overlay__die root-paper root-paper-fine absolute -bottom-5 z-1 flex size-11 items-center justify-center font-mono text-3xl font-bold text-ink [--root-paper-color:var(--color-paper-bright)] md:size-14 md:text-4xl'
const DIE_UNROLLED_CLASS_NAME = 'opacity-60'
const ATTACKER_DIE_CLASS_NAME = `${DIE_CLASS_NAME} -right-9 rotate-4 md:-right-11`
const DEFENDER_DIE_CLASS_NAME = `${DIE_CLASS_NAME} -left-9 -rotate-6 md:-left-11`
/** Role badge on the tile's outer top corner: sword = attacker, shield = defender. */
const ROLE_BADGE_CLASS_NAME =
  'root-paper root-medallion absolute -top-3.5 z-1 flex size-9 items-center justify-center text-xl text-parchment md:size-10 md:text-2xl'
const ATTACKER_ROLE_BADGE_CLASS_NAME = `${ROLE_BADGE_CLASS_NAME} -left-3.5`
const DEFENDER_ROLE_BADGE_CLASS_NAME = `${ROLE_BADGE_CLASS_NAME} -right-3.5`
/**
 * Rust diamond with crossed swords between the tiles. `top` = half the tile
 * height: the mark's middle sits level with the middle of the portraits.
 */
const CLASH_MARK_CLASS_NAME =
  'root-paper root-paper-fine absolute top-12 left-1/2 flex size-8.5 -translate-x-1/2 -translate-y-1/2 rotate-45 items-center justify-center text-lg text-parchment [--root-paper-color:var(--color-rust)] md:top-16 md:size-11 md:text-2xl'
/** Damage this side takes: one broken shield medallion per hit. */
const HITS_ROW_CLASS_NAME = 'flex h-8 flex-row items-center gap-2 md:h-9'
const HIT_CLASS_NAME =
  'root-paper root-medallion flex size-8 items-center justify-center text-lg text-parchment [--root-paper-color:var(--color-rust)] md:size-9 md:text-xl'
const STRAP_CLASS_NAME =
  'battle-overlay__prompt battle-overlay__headline root-paper m-0 -rotate-1 px-6 py-1.5 text-center font-display text-lg font-bold text-ink first-letter:uppercase md:text-2xl'
const STRAP_FLASH_CLASS_NAME = '[--root-paper-color:var(--color-gold)]'
/** Faction colour softened toward parchment so the head icon stays readable. */
const PORTRAIT_TINT_PERCENT = 55

type BattleSideView = {
  role: BattleRole
  roleLabel: string
  faction: string
  roll: number | null
  /** Hits this side deals (read out for screen readers). */
  hits: number
  /** Hits the other side deals: the damage drawn under this side. */
  hitsTaken: number
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
  // Result flash: the dice and hit marks tell the outcome; the strap only
  // speaks when nothing was removed.
  const strapText: string = isOutcomeFlash
    ? battleResultFlashPrompt(viewModel.hits)
    : battleStrapText(viewModel)
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
      <div
        className="battle-overlay pointer-events-none fixed inset-0 z-201"
        role="group"
        aria-label={`Battle · C${String(viewModel.clearing)}`}
      >
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
          <div className={SIDES_CLASS_NAME}>
            <BattleSide
              side={{
                role: 'attacker',
                roleLabel: ATTACKER_ROLE_LABEL,
                faction: viewModel.attackerFaction,
                roll: attackerDie,
                hits: viewModel.hits.attacker,
                hitsTaken: viewModel.hits.defender,
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
                hitsTaken: viewModel.hits.attacker,
              }}
            />
          </div>
          {strapText.length > 0 ? (
            <p
              className={
                isOutcomeFlash
                  ? `${STRAP_CLASS_NAME} ${STRAP_FLASH_CLASS_NAME}`
                  : STRAP_CLASS_NAME
              }
            >
              {strapText}
            </p>
          ) : null}
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
    { length: side.hitsTaken },
    (_: undefined, index: number): number => index,
  )
  const isAttacker: boolean = side.role === 'attacker'
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
        <span
          className={
            isAttacker
              ? ATTACKER_ROLE_BADGE_CLASS_NAME
              : DEFENDER_ROLE_BADGE_CLASS_NAME
          }
          aria-hidden="true"
        >
          {isAttacker ? <LuSword /> : <LuShield />}
        </span>
        <span
          className={
            waiting ? `${dieClassName} ${DIE_UNROLLED_CLASS_NAME}` : dieClassName
          }
          aria-hidden="true"
        >
          {waiting ? UNROLLED_DIE_FACE : String(side.roll)}
        </span>
      </div>
      <div className={HITS_ROW_CLASS_NAME} aria-hidden="true">
        {hitMarks.map((hitIndex: number) => (
          <span key={hitIndex} className={HIT_CLASS_NAME}>
            <GiBrokenShield />
          </span>
        ))}
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
