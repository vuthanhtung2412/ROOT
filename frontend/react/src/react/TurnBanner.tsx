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
import '#react/TurnBanner.css'

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
          ? 'turn-banner turn-banner--composer'
          : 'turn-banner'
      }
    >
      {showCancel ? (
        <button
          type="button"
          className="turn-banner__cancel"
          onClick={() => {
            callbacks.onBannerCancel()
          }}
        >
          {BANNER_CANCEL_LABEL}
        </button>
      ) : (
        <span className="turn-banner__spacer" />
      )}
      <p className="turn-banner__status">{statusText}</p>
      {showConfirm ? (
        <button
          type="button"
          className="turn-banner__confirm"
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
        <span className="turn-banner__spacer" />
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
        <div className="turn-banner__options">
          {composer.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="turn-banner__option"
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
    <div className="turn-banner__stepper">
      <button
        type="button"
        className={
          atMin
            ? 'turn-banner__stepper-arrow turn-banner__stepper-arrow--disabled'
            : 'turn-banner__stepper-arrow'
        }
        disabled={atMin}
        onClick={() => {
          props.onStep(-1)
        }}
      >
        {'<'}
      </button>
      <span className="turn-banner__stepper-value">
        {formatCountStepperLabel(selected)}
      </span>
      <button
        type="button"
        className={
          atMax
            ? 'turn-banner__stepper-arrow turn-banner__stepper-arrow--disabled'
            : 'turn-banner__stepper-arrow'
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
