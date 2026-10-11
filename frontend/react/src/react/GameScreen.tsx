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
  portraitMapHostSize,
  type ViewportLayoutMode,
} from '#game/viewportLayout.ts'
import { BoardMap } from '#react/BoardMap.tsx'
import { useMapViewMode } from '#react/map3d/useMapViewMode.ts'
import type { BoardClearingPieces } from '#react/PieceStack.tsx'
import type { ForestPawnMarker } from '#game/forestLayout.ts'

/** Loaded on demand: three.js stays out of the bundle of the flat map. */
const BoardMap3D = lazy(async () => {
  const module = await import('#react/map3d/BoardMap3D.tsx')
  return { default: module.BoardMap3D }
})

const MAP_VIEW_TOGGLE_CLASS_NAME =
  'map-view-toggle pointer-events-auto absolute top-2 left-2 z-6 cursor-pointer rounded border border-parchment-shadow bg-[#1a2438cc] px-2 py-1 font-body text-xs font-bold text-parchment'

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
  const MapComponent = mapViewMode === '3d' ? BoardMap3D : BoardMap

  const boardMap =
    props.layout !== null ? (
      <Suspense fallback={null}>
        <button
          type="button"
          className={MAP_VIEW_TOGGLE_CLASS_NAME}
          aria-pressed={mapViewMode === '3d'}
          onClick={toggleMapViewMode}
        >
          {mapViewMode === '3d' ? '2D map' : '3D map'}
        </button>
        <MapComponent
          layout={props.layout}
          layoutMode={props.layoutMode}
          viewWidth={mapHost.width}
          viewHeight={mapHost.height}
          {...(props.clearings !== null ? { clearings: props.clearings } : {})}
          {...(props.factions !== null ? { factions: props.factions } : {})}
          forestPawns={props.forestPawns}
          effects={props.effects}
          highlightedClearingIds={props.highlightedClearingIds}
          highlightedForestIndexes={props.highlightedForestIndexes}
          onClearingSelected={props.onClearingSelected}
          onForestSelected={props.onForestSelected}
        />
      </Suspense>
    ) : null

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-forest-deep">
      {wallpaperPath !== null ? (
        <img
          className="pointer-events-none absolute inset-0 size-full object-cover select-none brightness-92 contrast-103 saturate-90"
          src={wallpaperPath}
          alt=""
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-forest-deep" />
      )}
      {isPortrait ? (
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
