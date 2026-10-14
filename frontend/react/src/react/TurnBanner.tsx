import { useEffect, useState, useSyncExternalStore, type JSX } from 'react'
import {
  getHudCallbacks,
  getHudSnapshot,
  patchHud,
  subscribeHud,
} from '#game/hudStore.ts'
import {
  formatCountStepperLabel,
  selectedCountStepperOption,
  shouldPresentAsCountStepper,
  stepCountStepper,
  type CountStepperOption,
  type CountStepperState,
} from '#ui/countStepper.ts'
import type {
  TurnBannerComposerView,
  TurnBannerOptionItem,
  TurnBannerOptionPiece,
  TurnBannerViewModel,
} from '#ui/TurnBanner.ts'
import type { IconType } from 'react-icons'
import { LuCheck, LuMinus, LuPlus, LuX } from 'react-icons/lu'
import { SuitIcon } from '#react/SuitIcon.tsx'
import { Tooltip } from '#react/Tooltip.tsx'
import {
  RemovalPickOption,
  removalPickShapeForPieceKind,
} from '#react/RemovalPickOption.tsx'
import { optionIconFor } from '#ui/optionIcons.ts'
import { phaseIconFor } from '#ui/phaseIcons.ts'
import {
  factionTextureKey,
  imagePathForAssetKey,
  itemTextureKey,
  suitTextureKey,
} from '#assets/gameAssets.ts'

/** Accessible names: the buttons show an icon only. */
const BANNER_CANCEL_LABEL = 'X'
const BANNER_CONFIRM_LABEL = 'OK'
const STEPPER_DECREASE_LABEL = '<'
const STEPPER_INCREASE_LABEL = '>'

/** No panel of its own: the prompt strip and the tiles float over the board edge. */
const BANNER_CLASS_NAME =
  'fixed top-2 left-1/2 z-130 box-border grid w-[calc(100vw-16px)] min-h-10 -translate-x-1/2 grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-x-2 gap-y-1.5 md:top-3 md:w-[min(640px,calc(100vw-24px))] md:min-h-11 md:grid-cols-[44px_minmax(0,1fr)_44px] md:gap-x-3 md:gap-y-2'
/** Square paper tile: cancel (rust) and confirm (green). */
const BANNER_TILE_BUTTON_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press m-0 flex size-10 items-center justify-center justify-self-center p-0 text-xl text-parchment md:size-11 md:text-2xl'
/** Head of the faction that has to answer, tucked under the prompt strip. */
const BANNER_HEAD_TILE_CLASS_NAME =
  'root-paper root-paper-fine z-1 -mr-2 box-border flex size-10 shrink-0 -rotate-4 items-center justify-center p-1 md:size-12'
/** Time of day of the turn, drawn before the prompt. */
const BANNER_PHASE_ICON_CLASS_NAME =
  'flex shrink-0 items-center justify-center text-xl text-rust md:text-2xl'
const STEPPER_BUTTON_CLASS_NAME =
  'root-paper root-medallion root-paper-press m-0 flex size-9 items-center justify-center p-0 text-xl text-parchment md:size-10'

export function TurnBanner(): JSX.Element | null {
  const banner = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().turnBanner,
    () => getHudSnapshot().turnBanner,
  )
  const turn = banner.turn
  const composer = banner.composer
  const [countStepper, setCountStepper] = useState<CountStepperState | null>(
    null,
  )

  useEffect(() => {
    setCountStepper((previous) =>
      buildCountStepperFromComposer(composer, previous),
    )
  }, [composer])

  if (turn === null) {
    return null
  }

  const callbacks = getHudCallbacks()
  const useStepper = countStepper !== null
  // A grid is picked in its own modal (OptionGridModal), not in the banner.
  const isGrid = composer !== null && composer.optionPresentation === 'grid'
  const hasOptionRow =
    composer !== null && !isGrid && (useStepper || composer.options.length > 0)
  // The head tile names the faction and the phase icon the phase: text = prompt only.
  const statusText = composer === null ? turn.prompt : composer.message
  const PhaseIcon: IconType | null = phaseIconFor(turn.phase)
  const showConfirm =
    composer !== null && (composer.canConfirm || useStepper)
  const showCancel = composer !== null && composer.canCancel

  const actorHeadPath: string | null = imagePathForAssetKey(
    factionTextureKey(turn.actorFaction),
  )

  return (
    <div
      className={
        hasOptionRow
          ? `${BANNER_CLASS_NAME} grid-rows-[auto_auto]`
          : `${BANNER_CLASS_NAME} grid-rows-[auto]`
      }
    >
      {showCancel ? (
        <button
          type="button"
          className={`${BANNER_TILE_BUTTON_CLASS_NAME} [--root-paper-color:var(--color-rust)]`}
          aria-label={BANNER_CANCEL_LABEL}
          onClick={() => {
            callbacks.onBannerCancel()
          }}
        >
          <LuX aria-hidden="true" />
        </button>
      ) : (
        <span className="size-px" />
      )}
      <div className="flex min-w-0 flex-row items-center justify-center">
        {actorHeadPath !== null ? (
          <Tooltip label={turn.actorFaction}>
            <span className={BANNER_HEAD_TILE_CLASS_NAME}>
              <img
                className="size-full object-contain"
                src={actorHeadPath}
                alt={turn.actorFaction}
                draggable={false}
              />
            </span>
          </Tooltip>
        ) : (
          <span className="sr-only">{turn.actorFaction}</span>
        )}
        <p className="root-paper m-0 flex min-w-0 flex-row items-center gap-2 px-4 py-1.5 text-center font-display text-base leading-tight text-ink md:px-6 md:text-xl">
          {PhaseIcon !== null ? (
            <Tooltip label={`${turn.phase} · ${turn.step}`}>
              <span className={BANNER_PHASE_ICON_CLASS_NAME}>
                <PhaseIcon aria-hidden="true" />
              </span>
            </Tooltip>
          ) : null}
          {statusText}
        </p>
      </div>
      {showConfirm ? (
        <button
          type="button"
          className={`${BANNER_TILE_BUTTON_CLASS_NAME} [--root-paper-color:var(--color-confirm)]`}
          aria-label={BANNER_CONFIRM_LABEL}
          onClick={() => {
            if (countStepper !== null) {
              const selected = selectedCountStepperOption(countStepper)
              if (selected !== null) {
                callbacks.onBannerPickOption(selected.value)
                return
              }
            }
            callbacks.onBannerConfirm()
          }}
        >
          <LuCheck aria-hidden="true" />
        </button>
      ) : (
        <span className="size-px" />
      )}
      {composer !== null && useStepper && countStepper !== null ? (
        <CountStepperRow
          state={countStepper}
          onStep={(delta) => {
            setCountStepper((previous) =>
              previous === null ? null : stepCountStepper(previous, delta),
            )
          }}
        />
      ) : null}
      {composer !== null && !isGrid && !useStepper && composer.options.length > 0 ? (
        <div className="col-span-full flex flex-row flex-wrap items-center justify-center gap-2.5">
          {composer.options.map((option) =>
            option.item !== undefined ? (
              <ItemOptionButton
                key={option.value}
                label={option.label}
                item={option.item}
                onPick={() => {
                  callbacks.onBannerPickOption(option.value)
                }}
              />
            ) : option.piece !== undefined ? (
              <PieceOptionButton
                key={option.value}
                label={option.label}
                piece={option.piece}
                onPick={() => {
                  callbacks.onBannerPickOption(option.value)
                }}
              />
            ) : option.suit !== undefined ? (
              <SuitOptionButton
                key={option.value}
                label={option.label}
                suit={option.suit}
                onPick={() => {
                  callbacks.onBannerPickOption(option.value)
                }}
              />
            ) : (
              <button
                key={option.value}
                type="button"
                className={TEXT_OPTION_BUTTON_CLASS_NAME}
                onClick={() => {
                  callbacks.onBannerPickOption(option.value)
                }}
              >
                <OptionIcon iconId={option.iconId} />
                {option.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  )
}

const TEXT_OPTION_BUTTON_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press m-0 flex flex-row items-center gap-1.5 px-3 py-1 font-display text-sm text-ink'
const OPTION_ICON_CLASS_NAME = 'shrink-0 text-base text-rust'

/** Icon before an option's label; nothing when the option names none. */
function OptionIcon(props: { iconId: string | undefined }): JSX.Element | null {
  const Icon: IconType | null =
    props.iconId === undefined ? null : optionIconFor(props.iconId)
  if (Icon === null) {
    return null
  }
  return <Icon className={OPTION_ICON_CLASS_NAME} aria-hidden="true" />
}
/** Square paper tile holding a suit icon. */
const SUIT_OPTION_BUTTON_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press m-0 flex size-11 items-center justify-center p-1.5 md:size-12'

/** A suit to pick, drawn as its icon; the label stays for screen readers. */
function SuitOptionButton(props: {
  label: string
  suit: string
  onPick: () => void
}): JSX.Element {
  if (suitTextureKey(props.suit) === null) {
    return (
      <button
        type="button"
        className={TEXT_OPTION_BUTTON_CLASS_NAME}
        onClick={props.onPick}
      >
        {props.label}
      </button>
    )
  }
  return (
    <Tooltip label={props.label}>
      <button
        type="button"
        className={SUIT_OPTION_BUTTON_CLASS_NAME}
        aria-label={props.label}
        onClick={props.onPick}
      >
        <SuitIcon
          suit={props.suit}
          className="pointer-events-none block size-full object-contain"
        />
      </button>
    </Tooltip>
  )
}

const VAGABOND_FACTION_ID = 'vagabond'

/** Vagabond item as faction-board artwork: dim = exhausted, gold = selected. */
function ItemOptionButton(props: {
  label: string
  item: TurnBannerOptionItem
  onPick: () => void
}): JSX.Element {
  const textureKey = itemTextureKey(props.item.type)
  const imagePath = textureKey !== null ? imagePathForAssetKey(textureKey) : null
  return (
    <RemovalPickOption
      label={props.label}
      imagePath={imagePath}
      shape="item"
      selected={props.item.selected}
      exhausted={props.item.exhausted}
      damaged={props.item.damaged}
      factionId={VAGABOND_FACTION_ID}
      fallbackText={props.item.type}
      onPick={props.onPick}
    />
  )
}

/** Battle piece tile: same click-to-toggle chrome as Vagabond items. */
function PieceOptionButton(props: {
  label: string
  piece: TurnBannerOptionPiece
  onPick: () => void
}): JSX.Element {
  return (
    <RemovalPickOption
      label={props.label}
      imagePath={props.piece.imagePath}
      shape={removalPickShapeForPieceKind(props.piece.kind)}
      selected={props.piece.selected}
      disabled={props.piece.locked === true}
      factionId={props.piece.factionId}
      fallbackText={props.piece.type ?? props.piece.kind}
      onPick={props.onPick}
    />
  )
}

function CountStepperRow(props: {
  state: CountStepperState
  onStep: (delta: -1 | 1) => void
}): JSX.Element | null {
  const selected = selectedCountStepperOption(props.state)
  if (selected === null) {
    return null
  }
  const atMin = props.state.selectedIndex <= 0
  const atMax = props.state.selectedIndex >= props.state.options.length - 1
  return (
    <div className="col-span-full flex flex-row flex-wrap items-center justify-center gap-2.5">
      <button
        type="button"
        className={STEPPER_BUTTON_CLASS_NAME}
        aria-label={STEPPER_DECREASE_LABEL}
        disabled={atMin}
        onClick={() => {
          props.onStep(-1)
        }}
      >
        <LuMinus aria-hidden="true" />
      </button>
      <span className="root-paper root-paper-fine min-w-28 px-4 py-1.5 text-center font-display text-lg text-ink">
        {formatCountStepperLabel(selected)}
      </span>
      <button
        type="button"
        className={STEPPER_BUTTON_CLASS_NAME}
        aria-label={STEPPER_INCREASE_LABEL}
        disabled={atMax}
        onClick={() => {
          props.onStep(1)
        }}
      >
        <LuPlus aria-hidden="true" />
      </button>
    </div>
  )
}

function buildCountStepperFromComposer(
  composer: TurnBannerComposerView | null,
  previous: CountStepperState | null,
): CountStepperState | null {
  if (composer === null) {
    return null
  }
  const options: CountStepperOption[] = composer.options.map((option) => ({
    label: option.label,
    value: option.value,
  }))
  if (!shouldPresentAsCountStepper(options, composer.optionPresentation)) {
    return null
  }
  const previousValue =
    previous !== null
      ? selectedCountStepperOption(previous)?.value
      : undefined
  const previousIndex =
    previousValue === undefined
      ? 0
      : options.findIndex((option) => option.value === previousValue)
  return {
    options,
    selectedIndex: previousIndex >= 0 ? previousIndex : 0,
  }
}

export function syncTurnBannerTurn(turn: TurnBannerViewModel): void {
  const current = getHudSnapshot().turnBanner
  patchHud({
    turnBanner: {
      ...current,
      turn,
    },
  })
}

export function syncTurnBannerComposer(
  composer: TurnBannerComposerView | null,
): void {
  const current = getHudSnapshot().turnBanner
  patchHud({
    turnBanner: {
      ...current,
      composer,
    },
  })
}
