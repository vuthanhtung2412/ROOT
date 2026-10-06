import { useEffect, useState, useSyncExternalStore, type JSX } from 'react'
import {
  factionBoardLayoutForKind,
  placeBoardImage,
  type BoardImagePlacement,
} from '#assets/factionBoardLayout.ts'
import { imagePathForAssetKey } from '#assets/gameAssets.ts'
import {
  getFactionBoardSnapshot,
  hideFactionBoard,
  subscribeFactionBoard,
} from '#game/factionBoardBridge.ts'
import {
  logicalViewportSize,
  readWindowViewportMeasure,
} from '#game/viewportFit.ts'
import { ExpansionBoardOverlays } from '#react/expansionBoardOverlays.tsx'
import { FactionBoardOverlays } from '#react/factionBoardOverlays.tsx'
import { QuestPilePanel } from '#react/QuestPilePanel.tsx'
import { RevealedCardsPanel } from '#react/RevealedCardsPanel.tsx'
import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'

const BOARD_MAX_WIDTH_RATIO = 0.96
const BOARD_MAX_HEIGHT_RATIO = 0.94
const BOARD_TOP_RATIO = 0.02
const SIDE_PANEL_WIDTH_PIXELS = 220
const SIDE_PANEL_GAP_PIXELS = 12
const STAGE_HORIZONTAL_INSET_PIXELS = 24
const ART_FALLBACK_CLASS_NAME = 'absolute inset-0 z-0 border-2 border-parchment/70'
const ART_FALLBACK_MARQUISE_CLASS_NAME = 'bg-[rgb(184_90_26/0.95)]'
const ART_FALLBACK_EYRIE_CLASS_NAME = 'bg-[rgb(26_42_74/0.95)]'

/** Boards with a card panel beside the art: Vagabond quests, Cult revealed cards. */
function hasSidePanel(view: FactionBoardViewModel): boolean {
  return view.kind === 'vagabond' || view.kind === 'lizard'
}

function computeBoardPlacement(
  view: FactionBoardViewModel,
  viewWidth: number,
  viewHeight: number,
): BoardImagePlacement {
  const layout = factionBoardLayoutForKind(view.kind)
  const reservedSideWidth = hasSidePanel(view)
    ? SIDE_PANEL_WIDTH_PIXELS +
      SIDE_PANEL_GAP_PIXELS +
      STAGE_HORIZONTAL_INSET_PIXELS
    : 0
  return placeBoardImage({
    viewWidth: Math.max(1, viewWidth - reservedSideWidth),
    viewHeight,
    naturalWidth: layout.naturalWidth,
    naturalHeight: layout.naturalHeight,
    maxWidthRatio: BOARD_MAX_WIDTH_RATIO,
    maxHeightRatio: BOARD_MAX_HEIGHT_RATIO,
    topRatio: BOARD_TOP_RATIO,
  })
}

function useViewportSize(): { width: number; height: number } {
  const [size, setSize] = useState(() =>
    logicalViewportSize(readWindowViewportMeasure()),
  )

  useEffect(() => {
    const onResize = (): void => {
      setSize(logicalViewportSize(readWindowViewportMeasure()))
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return size
}

/** React faction/character board (art + layout overlays). */
export function FactionBoardModal(): JSX.Element | null {
  const view = useSyncExternalStore(
    subscribeFactionBoard,
    getFactionBoardSnapshot,
    getFactionBoardSnapshot,
  )
  const viewport = useViewportSize()

  if (view === null) {
    return null
  }

  const layout = factionBoardLayoutForKind(view.kind)
  const placement = computeBoardPlacement(view, viewport.width, viewport.height)
  const boardImagePath = imagePathForAssetKey(view.boardTextureKey)
  const stageWidth =
    placement.displayWidth +
    (hasSidePanel(view) ? SIDE_PANEL_WIDTH_PIXELS + SIDE_PANEL_GAP_PIXELS : 0)
  const stageLeft = Math.max(
    STAGE_HORIZONTAL_INSET_PIXELS / 2,
    (viewport.width - stageWidth) / 2,
  )

  return (
    <div
      className="faction-board-modal pointer-events-auto fixed inset-0 z-360"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-forest-deep/72"
        aria-label="Close faction board"
        onClick={() => {
          hideFactionBoard()
        }}
      />
      <button
        type="button"
        className="faction-board-modal__close absolute top-2.5 right-3 z-2 cursor-pointer bg-parchment px-2 py-1 font-display text-[16px] text-ink"
        aria-label="Close"
        onClick={() => {
          hideFactionBoard()
        }}
      >
        ✕
      </button>
      <div
        className="pointer-events-none absolute z-1 flex flex-row items-stretch gap-3"
        style={{
          left: stageLeft,
          top: placement.top,
          width: stageWidth,
          height: placement.displayHeight,
        }}
      >
        <div
          className="pointer-events-auto relative z-1 flex-none"
          style={{
            width: placement.displayWidth,
            height: placement.displayHeight,
          }}
        >
          {boardImagePath !== null ? (
            <img
              className="absolute inset-0 z-0 block size-full object-fill select-none"
              src={boardImagePath}
              alt={`${view.factionName} faction board`}
              draggable={false}
            />
          ) : (
            <div
              className={`${ART_FALLBACK_CLASS_NAME} ${
                view.kind === 'marquise'
                  ? ART_FALLBACK_MARQUISE_CLASS_NAME
                  : ART_FALLBACK_EYRIE_CLASS_NAME
              }`}
            />
          )}
          <FactionBoardOverlays view={view} layout={layout} />
          <ExpansionBoardOverlays view={view} layout={layout} />
        </div>
        {hasSidePanel(view) ? (
          <aside
            className="pointer-events-auto min-h-0 flex-none"
            style={{
              width: SIDE_PANEL_WIDTH_PIXELS,
              height: placement.displayHeight,
            }}
          >
            {view.kind === 'vagabond' ? <QuestPilePanel view={view} /> : null}
            {view.kind === 'lizard' ? <RevealedCardsPanel view={view} /> : null}
          </aside>
        ) : null}
      </div>
    </div>
  )
}
