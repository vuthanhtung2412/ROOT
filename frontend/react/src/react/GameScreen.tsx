import { lazy, Suspense, useEffect, useState, type JSX } from 'react'
import {
  GAME_ASSET_KEYS,
  imagePathForAssetKey,
} from '#assets/gameAssets.ts'
import type { BoardEffectBatch } from '#game/boardEffects.ts'
import type { BoardLayout } from '#game/boardLayout.ts'
import { GAME_LOGICAL_HEIGHT, GAME_LOGICAL_WIDTH } from '#game/hiDpi.ts'
import {
  logicalViewportSize,
  readWindowViewportMeasure,
  type ViewportPixelSize,
} from '#game/viewportFit.ts'
import {
  landscapeMapHostSize,
  PORTRAIT_MAP_TOP_INSET_PIXELS,
  portraitMapHostSize,
  type ViewportLayoutMode,
} from '#game/viewportLayout.ts'
import { BoardMap, type BoardMapProps } from '#react/BoardMap.tsx'
import { useMapViewMode } from '#react/map3d/useMapViewMode.ts'
import type { BoardClearingPieces } from '#react/PieceStack.tsx'
import type { ForestPawnMarker } from '#game/forestLayout.ts'

/** Loaded on demand: three.js stays out of the bundle of the flat map. */
const BoardMap3D = lazy(async () => {
  const module = await import('#react/map3d/BoardMap3D.tsx')
  return { default: module.BoardMap3D }
})

/**
 * Share of the screen width kept free of clearings in landscape: the player
 * rail hugs the left edge; on the right the action tray fills the bottom
 * corner, so the clearing down there must stay clear of it.
 */
const MAP_3D_LEFT_HUD_WIDTH_RATIO = 0.07
const MAP_3D_RIGHT_HUD_WIDTH_RATIO = 0.13
const HALF = 0.5
/** Gap between the toggle and the corner of the map area. */
const MAP_VIEW_TOGGLE_INSET_PIXELS = 8
const MAP_VIEW_TOGGLE_CLASS_NAME =
  'map-view-toggle pointer-events-auto absolute z-6 cursor-pointer rounded border border-parchment-shadow bg-[#1a2438cc] px-2 py-1 font-body text-xs font-bold text-parchment'

export type GameScreenProps = {
  layout: BoardLayout | null
  layoutMode: ViewportLayoutMode
  clearings: readonly BoardClearingPieces[] | null
  factions: readonly string[] | null
  forestPawns: readonly ForestPawnMarker[]
  effects: BoardEffectBatch
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
  const wallpaperPath = imagePathForAssetKey(GAME_ASSET_KEYS.gameWallpaper)
  const viewport = useViewportPixelSize()
  const isPortrait = props.layoutMode === 'portrait'
  const portraitHost = portraitMapHostSize(viewport)
  const landscapeHost = landscapeMapHostSize(viewport)
  const mapHost = isPortrait ? portraitHost : landscapeHost

  const { mapViewMode, toggleMapViewMode } = useMapViewMode()
  const is3d = mapViewMode === '3d'

  const mapProps: BoardMapProps | null =
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
          highlightedClearingIds: props.highlightedClearingIds,
          highlightedForestIndexes: props.highlightedForestIndexes,
          onClearingSelected: props.onClearingSelected,
          onForestSelected: props.onForestSelected,
        }
      : null
  const boardMap = mapProps !== null && !is3d ? <BoardMap {...mapProps} /> : null

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
  const toggleLeft: number =
    (viewport.width - mapHost.width) * HALF + MAP_VIEW_TOGGLE_INSET_PIXELS
  const toggleTop: number =
    (isPortrait ? PORTRAIT_MAP_TOP_INSET_PIXELS : 0) +
    MAP_VIEW_TOGGLE_INSET_PIXELS

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-forest-deep">
      {mapProps !== null ? (
        <button
          type="button"
          className={MAP_VIEW_TOGGLE_CLASS_NAME}
          style={{ left: toggleLeft, top: toggleTop }}
          aria-pressed={is3d}
          onClick={toggleMapViewMode}
        >
          {is3d ? '2D map' : '3D map'}
        </button>
      ) : null}
      {mapProps !== null && is3d ? (
        <div className="absolute inset-0 z-1">
          <Suspense fallback={null}>
            <BoardMap3D
              {...mapProps}
              viewWidth={viewport.width}
              viewHeight={viewport.height}
              focusWidth={focusWidth}
              focusHeight={mapHost.height}
              focusOffsetX={focusOffsetX}
            />
          </Suspense>
        </div>
      ) : null}
      {is3d ? null : wallpaperPath !== null ? (
        <img
          className="pointer-events-none absolute inset-0 size-full object-cover select-none brightness-92 contrast-103 saturate-90"
          src={wallpaperPath}
          alt=""
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-forest-deep" />
      )}
      {is3d ? null : isPortrait ? (
        <div className="absolute top-(--root-portrait-map-top-inset) right-0 bottom-(--root-portrait-map-bottom-inset) left-0 z-1 box-border flex items-center justify-center overflow-hidden px-2.5">
          <div
            className="relative max-h-full max-w-full shrink-0"
            style={{
              width: portraitHost.width,
              height: portraitHost.height,
            }}
          >
            {boardMap}
          </div>
        </div>
      ) : (
        <div className="absolute inset-y-0 left-(--root-landscape-side-percent) z-1 box-border flex w-(--root-landscape-center-percent) items-center justify-center overflow-hidden">
          <div
            className="relative max-h-full max-w-full shrink-0"
            style={{
              width: landscapeHost.width,
              height: landscapeHost.height,
            }}
          >
            {boardMap}
          </div>
        </div>
      )}
    </div>
  )
}
