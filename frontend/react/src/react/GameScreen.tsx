import { useEffect, useState, type JSX } from 'react'
import type { BoardEffectBatch } from '#game/boardEffects.ts'
import type { BoardLayout } from '#game/boardLayout.ts'
import type { ClearingFlash } from '#game/clearingFlash.ts'
import type { ForestPawnMarker } from '#game/forestLayout.ts'
import type { GameMapProps } from '#game/gameMapProps.ts'
import { GAME_LOGICAL_HEIGHT, GAME_LOGICAL_WIDTH } from '#game/hiDpi.ts'
import {
  logicalViewportSize,
  readWindowViewportMeasure,
  type ViewportPixelSize,
} from '#game/viewportFit.ts'
import {
  landscapeMapHostSize,
  portraitMapHostSize,
  type ViewportLayoutMode,
} from '#game/viewportLayout.ts'
import { BoardMap3D } from '#react/map3d/BoardMap3D.tsx'
import type { BoardClearingPieces } from '#react/PieceStack.tsx'

/**
 * Share of the screen width kept free of clearings in landscape: the player
 * rail hugs the left edge.
 */
const MAP_3D_LEFT_HUD_WIDTH_RATIO = 0.1
/**
 * A thin margin only: the map never moves when the action tray folds or
 * unfolds. An open tray lies over the bottom right clearing; fold it to see.
 */
const MAP_3D_RIGHT_HUD_WIDTH_RATIO = 0.04
const HALF = 0.5

export type GameScreenProps = {
  layout: BoardLayout | null
  layoutMode: ViewportLayoutMode
  clearings: readonly BoardClearingPieces[] | null
  factions: readonly string[] | null
  forestPawns: readonly ForestPawnMarker[]
  effects: BoardEffectBatch
  flashedClearing: ClearingFlash | null
  highlightedClearingIds: readonly number[]
  highlightedForestIndexes: readonly number[]
  onClearingSelected: (clearingId: number) => void
  onForestSelected: (forestIndex: number) => void
}

function useViewportPixelSize(): ViewportPixelSize {
  const [size, setSize] = useState<ViewportPixelSize>(() =>
    typeof window === 'undefined'
      ? { width: GAME_LOGICAL_WIDTH, height: GAME_LOGICAL_HEIGHT }
      : logicalViewportSize(readWindowViewportMeasure()),
  )
  useEffect(() => {
    const updateSize = (): void => {
      setSize(logicalViewportSize(readWindowViewportMeasure()))
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    window.addEventListener('orientationchange', updateSize)
    return () => {
      window.removeEventListener('resize', updateSize)
      window.removeEventListener('orientationchange', updateSize)
    }
  }, [])
  return size
}

export function GameScreen(props: GameScreenProps): JSX.Element {
  const viewport = useViewportPixelSize()
  const isPortrait = props.layoutMode === 'portrait'
  const portraitHost = portraitMapHostSize(viewport)
  const landscapeHost = landscapeMapHostSize(viewport)
  const mapHost = isPortrait ? portraitHost : landscapeHost

  const mapProps: GameMapProps | null =
    props.layout !== null
      ? {
          layout: props.layout,
          layoutMode: props.layoutMode,
          viewWidth: mapHost.width,
          viewHeight: mapHost.height,
          ...(props.clearings !== null ? { clearings: props.clearings } : {}),
          ...(props.factions !== null ? { factions: props.factions } : {}),
          forestPawns: props.forestPawns,
          effects: props.effects,
          flashedClearing: props.flashedClearing,
          highlightedClearingIds: props.highlightedClearingIds,
          highlightedForestIndexes: props.highlightedForestIndexes,
          onClearingSelected: props.onClearingSelected,
          onForestSelected: props.onForestSelected,
        }
      : null

  // The 3D map is the whole backdrop; the playable woodland keeps to the
  // part of the screen the side HUD leaves free.
  const focusWidth: number = isPortrait
    ? portraitHost.width
    : viewport.width *
      (1 - MAP_3D_LEFT_HUD_WIDTH_RATIO - MAP_3D_RIGHT_HUD_WIDTH_RATIO)
  const focusOffsetX: number = isPortrait
    ? 0
    : viewport.width *
      (MAP_3D_LEFT_HUD_WIDTH_RATIO - MAP_3D_RIGHT_HUD_WIDTH_RATIO) *
      HALF

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-forest-deep">
      {mapProps !== null ? (
        <div className="absolute inset-0 z-1">
          <BoardMap3D
            {...mapProps}
            viewWidth={viewport.width}
            viewHeight={viewport.height}
            focusWidth={focusWidth}
            focusHeight={mapHost.height}
            focusOffsetX={focusOffsetX}
          />
        </div>
      ) : null}
    </div>
  )
}
