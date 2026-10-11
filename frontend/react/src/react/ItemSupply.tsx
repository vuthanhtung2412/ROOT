import {
  useState,
  useSyncExternalStore,
  type JSX,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { LuBackpack, LuX } from 'react-icons/lu'
import { imagePathForAssetKey, itemTextureKey } from '#assets/gameAssets.ts'
import { getHudSnapshot, subscribeHud } from '#game/hudStore.ts'
import {
  buildItemSupplyGrid,
  countItemsInSupply,
  type ItemSupplyColumn,
  type ItemSupplyCounts,
  type ItemSupplySlot,
} from '#ui/itemSupply.ts'

/** Same shell as discard / crafted card gallery. */
const MODAL_CLASS_NAME =
  'item-supply-modal pointer-events-auto fixed inset-0 z-380 flex items-center justify-center'
const VEIL_CLASS_NAME = 'absolute inset-0 bg-forest-deep/72'
const CLOSE_BUTTON_CLASS_NAME =
  'root-paper root-paper-fine root-paper-press absolute top-2.5 right-3 z-2 m-0 flex size-10 items-center justify-center p-0 text-2xl text-parchment [--root-paper-color:var(--color-rust)]'
const PANEL_CLASS_NAME =
  'item-supply-modal__panel root-paper relative z-1 box-border flex w-auto max-w-[min(96vw,52rem)] flex-col items-center justify-center px-[18px] py-4 [--root-paper-color:var(--color-cream)]'
/**
 * Rule: 5.1.5 — six columns × two slots, as on the map. `grid-flow-col` fills
 * each column top→bottom before moving right.
 */
const GRID_CLASS_NAME =
  'item-supply-modal__grid m-0 grid list-none grid-flow-col grid-cols-6 grid-rows-2 gap-2 p-0 sm:gap-3'
/** Same footprint as satchel / damaged items on the faction board (`size-16`). */
const SLOT_CLASS_NAME =
  'item-supply-modal__slot flex size-16 shrink-0 items-center justify-center'
/** Real token art (PNG has its own tile). */
const ITEM_ICON_CLASS_NAME = 'block size-full object-contain select-none'
/** An item already taken: washed-out ghost of the token. */
const ITEM_TAKEN_CLASS_NAME = `${ITEM_ICON_CLASS_NAME} opacity-25 grayscale`

function itemImagePath(itemType: string): string | null {
  const textureKey: string | null = itemTextureKey(itemType)
  return textureKey === null ? null : imagePathForAssetKey(textureKey)
}

function ItemSupplySlotView(props: {
  slot: ItemSupplySlot
  columnKey: string
}): JSX.Element {
  const { slot } = props
  const imagePath: string | null = itemImagePath(slot.itemType)
  return (
    <li
      className={SLOT_CLASS_NAME}
      data-item-type={slot.itemType}
      data-supply-column={props.columnKey}
      data-in-supply={slot.inSupply ? 'true' : 'false'}
      aria-label={
        slot.inSupply ? slot.name : `${slot.name} (taken from the supply)`
      }
    >
      {imagePath === null ? null : (
        <img
          className={slot.inSupply ? ITEM_ICON_CLASS_NAME : ITEM_TAKEN_CLASS_NAME}
          src={imagePath}
          alt=""
          draggable={false}
        />
      )}
    </li>
  )
}

function ItemSupplyModal(props: {
  columns: readonly ItemSupplyColumn[]
  onClose: () => void
}): JSX.Element {
  return (
    <div
      className={MODAL_CLASS_NAME}
      role="dialog"
      aria-modal="true"
      aria-label="Item supply"
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
        <ul className={GRID_CLASS_NAME}>
          {props.columns.flatMap(
            (column: ItemSupplyColumn): JSX.Element[] => [
              <ItemSupplySlotView
                key={`${column.key}-top`}
                columnKey={column.key}
                slot={column.top}
              />,
              <ItemSupplySlotView
                key={`${column.key}-bottom`}
                columnKey={column.key}
                slot={column.bottom}
              />,
            ],
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
      {isOpen
        ? createPortal(
            <ItemSupplyModal
              columns={buildItemSupplyGrid(supply)}
              onClose={(): void => {
                setIsOpen(false)
              }}
            />,
            document.body,
          )
        : null}
    </>
  )
}
