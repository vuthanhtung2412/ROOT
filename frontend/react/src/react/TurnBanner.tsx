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
  TurnBannerViewModel,
} from '#ui/TurnBanner.ts'

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
          ? 'root-panel fixed top-3 left-1/2 z-[130] grid w-[min(640px,calc(100vw-24px))] min-h-11 -translate-x-1/2 grid-cols-[56px_minmax(0,1fr)_56px] grid-rows-[auto_auto] items-center gap-x-3 gap-y-2 box-border px-3 py-2 portrait:top-2 portrait:w-[calc(100vw-16px)] portrait:min-h-10 portrait:grid-cols-[48px_minmax(0,1fr)_48px] portrait:gap-x-2 portrait:gap-y-1.5 portrait:px-2 portrait:py-1.5'
          : 'root-panel fixed top-3 left-1/2 z-[130] grid w-[min(640px,calc(100vw-24px))] min-h-11 -translate-x-1/2 grid-cols-[56px_minmax(0,1fr)_56px] grid-rows-[auto] items-center gap-x-3 gap-y-2 box-border px-3 py-2 portrait:top-2 portrait:w-[calc(100vw-16px)] portrait:min-h-10 portrait:grid-cols-[48px_minmax(0,1fr)_48px] portrait:gap-x-2 portrait:gap-y-1.5 portrait:px-2 portrait:py-1.5'
      }
    >
      {showCancel ? (
        <button
          type="button"
          className="root-button root-button--danger justify-self-center px-2.5 py-1 text-[15px] portrait:px-2 portrait:py-1 portrait:text-[13px]"
          onClick={() => {
            callbacks.onBannerCancel()
          }}
        >
          {BANNER_CANCEL_LABEL}
        </button>
      ) : (
        <span className="size-px" />
      )}
      <p className="m-0 text-center font-display text-xl leading-[1.25] text-ink portrait:text-base">
        {statusText}
      </p>
      {showConfirm ? (
        <button
          type="button"
          className="root-button root-button--accent justify-self-center px-2.5 py-1 text-[15px] portrait:px-2 portrait:py-1 portrait:text-[13px]"
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
          {composer.options.map((option) => (
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
          ))}
        </div>
      ) : null}
    </div>
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
