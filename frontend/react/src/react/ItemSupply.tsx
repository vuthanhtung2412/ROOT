import { useState, useSyncExternalStore, type JSX, type MouseEvent } from 'react'
import { LuBackpack, LuX } from 'react-icons/lu'
import { imagePathForAssetKey, itemTextureKey } from '#assets/gameAssets.ts'
import { getHudSnapshot, subscribeHud } from '#game/hudStore.ts'
import {
  buildItemSupplyRows,
  countItemsInSupply,
  type ItemSupplyCounts,
  type ItemSupplyRow,
} from '#ui/itemSupply.ts'

const MODAL_CLASS_NAME =
  'item-supply-modal pointer-events-auto fixed inset-0 z-380 flex items-center justify-center'
const VEIL_CLASS_NAME = 'absolute inset-0 bg-forest-deep/72'
const PANEL_CLASS_NAME =
  'root-paper relative z-1 m-3 flex max-h-[90vh] max-w-[96vw] flex-col gap-3 overflow-y-auto px-5 py-4 text-ink [--root-paper-color:var(--color-cream)]'
const CLOSE_BUTTON_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press absolute top-3 right-3 z-2 m-0 flex size-10 items-center justify-center p-0 text-2xl text-parchment [--root-paper-color:var(--color-rust)]'
const ROW_CLASS_NAME = 'item-supply-modal__row flex flex-row items-center gap-3'
const ROW_NAME_CLASS_NAME = 'w-24 font-display text-lg md:text-xl'
const ROW_COUNT_CLASS_NAME = 'ml-auto pl-4 font-mono text-sm md:text-base'
const ITEM_SLOT_CLASS_NAME = 'size-11 object-contain select-none md:size-13'
/** An item already taken from the supply: its slot stays, washed out. */
const TAKEN_ITEM_CLASS_NAME = `${ITEM_SLOT_CLASS_NAME} opacity-20 grayscale`
const EXHAUSTED_ROW_CLASS_NAME = `${ROW_CLASS_NAME} item-supply-modal__row--exhausted text-rust`

function itemImagePath(itemType: string): string | null {
  const textureKey: string | null = itemTextureKey(itemType)
  return textureKey === null ? null : imagePathForAssetKey(textureKey)
}

function ItemSupplyRowView(props: { row: ItemSupplyRow }): JSX.Element {
  const { row } = props
  const imagePath: string | null = itemImagePath(row.itemType)
  const slots: boolean[] = Array.from(
    { length: row.total },
    (_slot: unknown, index: number): boolean => index < row.remaining,
  )
  return (
    <li
      className={row.remaining === 0 ? EXHAUSTED_ROW_CLASS_NAME : ROW_CLASS_NAME}
      data-item-type={row.itemType}
      data-remaining={row.remaining}
    >
      <span className={ROW_NAME_CLASS_NAME}>{row.name}</span>
      {slots.map((inSupply: boolean, index: number): JSX.Element | null =>
        imagePath === null ? null : (
          <img
            key={index}
            className={inSupply ? ITEM_SLOT_CLASS_NAME : TAKEN_ITEM_CLASS_NAME}
            src={imagePath}
            alt={inSupply ? row.name : `${row.name} (taken)`}
            draggable={false}
          />
        ),
      )}
      <span className={ROW_COUNT_CLASS_NAME}>
        {row.remaining === 0
          ? 'none left'
          : `${String(row.remaining)} / ${String(row.total)}`}
      </span>
    </li>
  )
}

function ItemSupplyModal(props: {
  rows: readonly ItemSupplyRow[]
  onClose: () => void
}): JSX.Element {
  return (
    <div
      className={MODAL_CLASS_NAME}
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <div className={VEIL_CLASS_NAME} aria-hidden="true" />
      <button
        type="button"
        className={CLOSE_BUTTON_CLASS_NAME}
        aria-label="Close item supply"
        onClick={(event: MouseEvent<HTMLButtonElement>): void => {
          event.stopPropagation()
          props.onClose()
        }}
      >
        <LuX aria-hidden="true" />
      </button>
      <div
        className={PANEL_CLASS_NAME}
        onClick={(event: MouseEvent<HTMLDivElement>): void => {
          event.stopPropagation()
        }}
      >
        <h2 className="m-0 font-display text-2xl font-normal">Item supply</h2>
        <p className="m-0 text-sm">
          A card that gives an item can only be crafted while that item is left.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {props.rows.map(
            (row: ItemSupplyRow): JSX.Element => (
              <ItemSupplyRowView key={row.itemType} row={row} />
            ),
          )}
        </ul>
      </div>
    </div>
  )
}

/** Drawer chip that opens the item supply, like the Discarded pile chip. */
export function ItemSupplyButton(props: { className: string }): JSX.Element {
  const supply: ItemSupplyCounts | undefined = useSyncExternalStore(
    subscribeHud,
    () => getHudSnapshot().playerRail?.state.itemSupply,
    () => getHudSnapshot().playerRail?.state.itemSupply,
  )
  const [isOpen, setIsOpen] = useState<boolean>(false)

  return (
    <>
      <button
        type="button"
        className={`item-supply-button ${props.className}`}
        onClick={(): void => {
          setIsOpen(true)
        }}
      >
        <LuBackpack aria-hidden="true" />
        {`Items (${String(countItemsInSupply(supply))})`}
      </button>
      {isOpen ? (
        <ItemSupplyModal
          rows={buildItemSupplyRows(supply)}
          onClose={(): void => {
            setIsOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
