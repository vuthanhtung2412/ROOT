import { useEffect, useState, type JSX } from 'react'
import {
  factionBoardLayoutForKind,
  placeBoardImage,
  type BoardImagePlacement,
} from '#assets/factionBoardLayout.ts'
import { imagePathForAssetKey } from '#assets/gameAssets.ts'
import { EventBus } from '#game/EventBus.ts'
import {
  FACTION_BOARD_HIDE_EVENT,
  FACTION_BOARD_SHOW_EVENT,
  hideFactionBoard,
} from '#game/factionBoardBridge.ts'
import type { FactionBoardViewModel } from '#ui/factionBoardViewModel.ts'
import '#react/FactionBoardModal.css'

const BOARD_MAX_WIDTH_RATIO = 0.96
const BOARD_MAX_HEIGHT_RATIO = 0.94
const BOARD_TOP_RATIO = 0.02

function computeBoardPlacement(
  view: FactionBoardViewModel,
  viewWidth: number,
  viewHeight: number,
): BoardImagePlacement {
  const layout = factionBoardLayoutForKind(view.kind)
  return placeBoardImage({
    viewWidth,
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

/** React faction/character board shell (veil + art + close). */
export function FactionBoardModal(): JSX.Element | null {
  const [view, setView] = useState<FactionBoardViewModel | null>(null)
  const viewport = useViewportSize()

  useEffect(() => {
    const onShow = (nextView: FactionBoardViewModel): void => {
      setView(nextView)
    }
    const onHide = (): void => {
      setView(null)
    }
    EventBus.on(FACTION_BOARD_SHOW_EVENT, onShow)
    EventBus.on(FACTION_BOARD_HIDE_EVENT, onHide)
    return () => {
      EventBus.off(FACTION_BOARD_SHOW_EVENT, onShow)
      EventBus.off(FACTION_BOARD_HIDE_EVENT, onHide)
    }
  }, [])

  if (view === null) {
    return null
  }

  const placement = computeBoardPlacement(view, viewport.width, viewport.height)
  const boardImagePath = imagePathForAssetKey(view.boardTextureKey)

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
        className="faction-board-modal__board"
        style={{
          left: placement.left,
          top: placement.top,
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
      </div>
    </div>
  )
}
