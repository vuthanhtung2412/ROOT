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

const CELL_CLASS_NAME =
  'root-paper root-medallion root-paper-press m-0 flex size-11 items-center justify-center p-0 font-display text-xl'
const CELL_IDLE_CLASS_NAME =
  'text-ink [--root-paper-color:var(--color-paper-bright)]'
/** Picked value: wooden medallion, a little bigger than its row. */
const CELL_SELECTED_CLASS_NAME = 'scale-115 font-bold text-parchment'

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
 * track): click one value per row; the turn banner's OK sends them together
 * and its X cancels. Sits under the banner (z-130), over tray, hand and rail.
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
      className="option-grid-modal pointer-events-auto fixed inset-0 z-125 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={composer.message}
    >
      <div className="absolute inset-0 bg-forest-deep/72" />
      <div className="root-paper z-1 mx-3 px-6 py-2">
        <div className="flex flex-col">
          {rowsOf(composer.options).map((row: OptionGridRow) => (
            <div
              key={row.group}
              className="option-grid-modal__row flex flex-row items-center justify-between gap-6 border-dashed border-ink/35 py-2.5 not-first:border-t-2"
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
      </div>
    </div>
  )
}
