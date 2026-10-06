import { useSyncExternalStore, type JSX } from 'react'
import {
  getHudCallbacks,
  getHudSnapshot,
  subscribeHud,
} from '#game/hudStore.ts'
import type {
  TurnBannerComposerView,
  TurnBannerOption,
} from '#ui/TurnBanner.ts'

const CANCEL_LABEL = 'Cancel'
const CONFIRM_LABEL = 'Confirm'

const CELL_CLASS_NAME =
  'flex size-12 cursor-pointer items-center justify-center rounded-full font-display text-xl text-ink'
const CELL_IDLE_CLASS_NAME = 'border-2 border-ink bg-parchment hover:brightness-95'
const CELL_SELECTED_CLASS_NAME = 'border-4 border-riverfolk bg-moss/45 font-bold'

type OptionGridRow = {
  group: string
  options: TurnBannerOption[]
}

/** Options gathered by `group`, rows in first-seen order. */
function rowsOf(options: readonly TurnBannerOption[]): OptionGridRow[] {
  const rows: OptionGridRow[] = []
  for (const option of options) {
    const group: string = option.group ?? ''
    const row: OptionGridRow | undefined = rows.find(
      (candidate: OptionGridRow): boolean => candidate.group === group,
    )
    if (row === undefined) {
      rows.push({ group, options: [option] })
    } else {
      row.options.push(option)
    }
  }
  return rows
}

/**
 * One modal for a choice with several rows (Riverfolk Set Costs: the Services
 * track): click one value per row, then Confirm sends them together.
 */
export function OptionGridModal(): JSX.Element | null {
  const composer: TurnBannerComposerView | null = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().turnBanner.composer,
    () => getHudSnapshot().turnBanner.composer,
  )
  if (composer === null || composer.optionPresentation !== 'grid') {
    return null
  }
  const callbacks = getHudCallbacks()
  return (
    <div
      className="option-grid-modal pointer-events-auto fixed inset-0 z-360 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={composer.message}
    >
      <div className="absolute inset-0 bg-forest-deep/72" />
      <div className="root-panel relative z-1 flex flex-col gap-5 px-7 py-5">
        <h2 className="m-0 text-center font-display text-xl text-ink">
          {composer.message}
        </h2>
        <div className="flex flex-col gap-3">
          {rowsOf(composer.options).map((row: OptionGridRow) => (
            <div
              key={row.group}
              className="option-grid-modal__row flex flex-row items-center justify-between gap-6"
            >
              <span className="font-display text-lg font-bold text-ink">
                {row.group}
              </span>
              <div className="flex flex-row gap-2">
                {row.options.map((option: TurnBannerOption) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${CELL_CLASS_NAME} ${
                      option.selected === true
                        ? CELL_SELECTED_CLASS_NAME
                        : CELL_IDLE_CLASS_NAME
                    }`}
                    aria-label={`${row.group} ${option.label}`}
                    aria-pressed={option.selected === true}
                    onClick={() => {
                      callbacks.onBannerPickOption(option.value)
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-row justify-end gap-3">
          {composer.canCancel ? (
            <button
              type="button"
              className="root-button root-button--danger px-3 py-1.5 text-[15px]"
              onClick={() => {
                callbacks.onBannerCancel()
              }}
            >
              {CANCEL_LABEL}
            </button>
          ) : null}
          <button
            type="button"
            className="root-button root-button--accent px-3 py-1.5 text-[15px]"
            disabled={!composer.canConfirm}
            onClick={() => {
              callbacks.onBannerConfirm()
            }}
          >
            {CONFIRM_LABEL}
          </button>
        </div>
      </div>
    </div>
  )
}
