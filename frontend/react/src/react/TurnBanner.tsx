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
import { imagePathForAssetKey, itemTextureKey } from '#assets/gameAssets.ts'

const BANNER_CANCEL_LABEL = 'X'
const BANNER_CONFIRM_LABEL = 'OK'

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
  const hasOptionRow =
    composer !== null && (useStepper || composer.options.length > 0)
  const statusText =
    composer === null
      ? `${turn.actorFaction} · ${turn.phase}/${turn.step} — ${turn.prompt}`
      : `${turn.actorFaction} · ${composer.message}`
  const showConfirm =
    composer !== null && (composer.canConfirm || useStepper)
  const showCancel = composer !== null && composer.canCancel

  return (
    <div
      className={
        hasOptionRow
          ? 'root-panel fixed top-2 left-1/2 z-[130] box-border grid w-[calc(100vw-16px)] min-h-10 -translate-x-1/2 grid-cols-[48px_minmax(0,1fr)_48px] grid-rows-[auto_auto] items-center gap-x-2 gap-y-1.5 px-2 py-1.5 md:top-3 md:w-[min(640px,calc(100vw-24px))] md:min-h-11 md:grid-cols-[56px_minmax(0,1fr)_56px] md:gap-x-3 md:gap-y-2 md:px-3 md:py-2'
          : 'root-panel fixed top-2 left-1/2 z-[130] box-border grid w-[calc(100vw-16px)] min-h-10 -translate-x-1/2 grid-cols-[48px_minmax(0,1fr)_48px] grid-rows-[auto] items-center gap-x-2 gap-y-1.5 px-2 py-1.5 md:top-3 md:w-[min(640px,calc(100vw-24px))] md:min-h-11 md:grid-cols-[56px_minmax(0,1fr)_56px] md:gap-x-3 md:gap-y-2 md:px-3 md:py-2'
      }
    >
      {showCancel ? (
        <button
          type="button"
          className="root-button root-button--danger justify-self-center px-2 py-1 text-[13px] md:px-2.5 md:text-[15px]"
          onClick={() => {
            callbacks.onBannerCancel()
          }}
        >
          {BANNER_CANCEL_LABEL}
        </button>
      ) : (
        <span className="size-px" />
      )}
      <p className="m-0 text-center font-display text-base leading-[1.25] text-ink md:text-xl">
        {statusText}
      </p>
      {showConfirm ? (
        <button
          type="button"
          className="root-button root-button--accent justify-self-center px-2 py-1 text-[13px] md:px-2.5 md:text-[15px]"
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
          {BANNER_CONFIRM_LABEL}
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
      {composer !== null && !useStepper && composer.options.length > 0 ? (
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
                className="root-button root-button--quiet px-2 py-1 text-sm"
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
  'border-gold -translate-y-1 shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-gold)_80%,var(--color-ink))]'
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
        className={
          atMin
            ? 'root-button px-3 py-1.5 text-lg opacity-55'
            : 'root-button px-3 py-1.5 text-lg'
        }
        disabled={atMin}
        onClick={() => {
          props.onStep(-1)
        }}
      >
        {'<'}
      </button>
      <span className="border border-ink-soft bg-[color-mix(in_srgb,var(--color-parchment-deep)_80%,transparent)] px-3.5 py-1.5 font-mono text-base text-ink">
        {formatCountStepperLabel(selected)}
      </span>
      <button
        type="button"
        className={
          atMax
            ? 'root-button px-3 py-1.5 text-lg opacity-55'
            : 'root-button px-3 py-1.5 text-lg'
        }
        disabled={atMax}
        onClick={() => {
          props.onStep(1)
        }}
      >
        {'>'}
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
