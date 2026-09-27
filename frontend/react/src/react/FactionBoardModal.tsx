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
import { FactionBoardOverlays } from '#react/factionBoardOverlays.tsx'
import { QuestPilePanel } from '#react/QuestPilePanel.tsx'
import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'
import '#react/FactionBoardModal.css'

const BOARD_MAX_WIDTH_RATIO = 0.96
const BOARD_MAX_HEIGHT_RATIO = 0.94
const BOARD_TOP_RATIO = 0.02
const QUEST_SIDE_PANEL_WIDTH_PIXELS = 220
const QUEST_SIDE_PANEL_GAP_PIXELS = 12
const STAGE_HORIZONTAL_INSET_PIXELS = 24

function computeBoardPlacement(
  view: FactionBoardViewModel,
  viewWidth: number,
  viewHeight: number,
): BoardImagePlacement {
  const layout = factionBoardLayoutForKind(view.kind)
  const reservedSideWidth =
    view.kind === 'vagabond'
      ? QUEST_SIDE_PANEL_WIDTH_PIXELS +
        QUEST_SIDE_PANEL_GAP_PIXELS +
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
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))

  useEffect(() => {
    const onResize = (): void => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
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
  const showQuestSidePanel = view.kind === 'vagabond'
  const stageWidth =
    placement.displayWidth +
    (showQuestSidePanel
      ? QUEST_SIDE_PANEL_WIDTH_PIXELS + QUEST_SIDE_PANEL_GAP_PIXELS
      : 0)
  const stageLeft = Math.max(
    STAGE_HORIZONTAL_INSET_PIXELS / 2,
    (viewport.width - stageWidth) / 2,
  )

  return (
    <div className="faction-board-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="faction-board-modal__veil"
        aria-label="Close faction board"
        onClick={() => {
          hideFactionBoard()
        }}
      />
      <button
        type="button"
        className="faction-board-modal__close"
        aria-label="Close"
        onClick={() => {
          hideFactionBoard()
        }}
      >
        ✕
      </button>
      <div
        className="faction-board-modal__stage"
        style={{
          left: stageLeft,
          top: placement.top,
          width: stageWidth,
          height: placement.displayHeight,
        }}
      >
        <div
          className="faction-board-modal__board"
          style={{
            width: placement.displayWidth,
            height: placement.displayHeight,
          }}
        >
          {boardImagePath !== null ? (
            <img
              className="faction-board-modal__art"
              src={boardImagePath}
              alt={`${view.factionName} faction board`}
              draggable={false}
            />
          ) : (
            <div
              className={
                view.kind === 'marquise'
                  ? 'faction-board-modal__art-fallback faction-board-modal__art-fallback--marquise'
                  : 'faction-board-modal__art-fallback faction-board-modal__art-fallback--eyrie'
              }
            />
          )}
          <FactionBoardOverlays view={view} layout={layout} />
        </div>
        {showQuestSidePanel ? (
          <aside
            className="faction-board-modal__quest-side"
            style={{
              width: QUEST_SIDE_PANEL_WIDTH_PIXELS,
              height: placement.displayHeight,
            }}
          >
            <QuestPilePanel view={view} />
          </aside>
        ) : null}
      </div>
    </div>
  )
}
