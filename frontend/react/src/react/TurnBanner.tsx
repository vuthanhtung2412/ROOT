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
  TurnBannerViewModel,
} from '#ui/TurnBanner.ts'
import { LuCheck, LuMinus, LuPlus, LuX } from 'react-icons/lu'
import {
  factionTextureKey,
  imagePathForAssetKey,
  itemTextureKey,
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
  'root-paper root-paper-fine z-1 -mr-2 box-border flex size-10 shrink-0 -rotate-4 items-center justify-center p-1 [--root-paper-color:var(--color-paper-bright)] md:size-12'
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
  const statusText =
    composer === null
      ? `${turn.actorFaction} · ${turn.phase}/${turn.step} — ${turn.prompt}`
      : `${turn.actorFaction} · ${composer.message}`
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
          <span className={BANNER_HEAD_TILE_CLASS_NAME}>
            <img
              className="size-full object-contain"
              src={actorHeadPath}
              alt=""
              draggable={false}
            />
          </span>
        ) : null}
        <p className="root-paper m-0 min-w-0 px-4 py-1.5 text-center font-display text-base leading-tight text-ink md:px-6 md:text-xl">
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
            ) : (
              <button
                key={option.value}
                type="button"
                className="root-paper root-paper-fine root-paper-press m-0 px-3 py-1 font-display text-sm text-ink"
                onClick={() => {
                  callbacks.onBannerPickOption(option.value)
                }}
              >
                {option.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  )
}

const ITEM_OPTION_BASE_CLASS =
  'relative m-0 box-border size-14 cursor-pointer border-2 bg-parchment p-0.5 transition-transform duration-75 ease-out md:size-16'
const ITEM_OPTION_SELECTED_CLASS =
  'border-gold -translate-y-1 shadow-gold-ring'
const ITEM_OPTION_IDLE_CLASS = 'border-ink-soft'
/** Same dimming as exhausted items on the Vagabond faction board. */
const ITEM_OPTION_EXHAUSTED_IMAGE_CLASS = 'opacity-40'

/** Vagabond item as faction-board artwork: dim = exhausted, gold = selected. */
function ItemOptionButton(props: {
  label: string
  item: TurnBannerOptionItem
  onPick: () => void
}): JSX.Element {
  const textureKey = itemTextureKey(props.item.type)
  const imagePath = textureKey !== null ? imagePathForAssetKey(textureKey) : null
  return (
    <button
      type="button"
      className={`${ITEM_OPTION_BASE_CLASS} ${
        props.item.selected ? ITEM_OPTION_SELECTED_CLASS : ITEM_OPTION_IDLE_CLASS
      }`}
      aria-label={props.label}
      aria-pressed={props.item.selected}
      title={props.label}
      onClick={props.onPick}
    >
      {imagePath !== null ? (
        <img
          className={`pointer-events-none block size-full object-contain ${
            props.item.exhausted ? ITEM_OPTION_EXHAUSTED_IMAGE_CLASS : ''
          }`}
          src={imagePath}
          alt={props.item.type}
          draggable={false}
        />
      ) : (
        <span className="font-mono text-xs text-ink">{props.item.type}</span>
      )}
      {props.item.damaged ? (
        <span className="pointer-events-none absolute right-0 bottom-0 left-0 bg-ink/80 text-center font-mono text-[9px] leading-tight text-parchment">
          damaged
        </span>
      ) : null}
      {props.item.selected ? (
        <span className="pointer-events-none absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border border-ink bg-gold font-mono text-xs text-ink">
          ✓
        </span>
      ) : null}
    </button>
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
