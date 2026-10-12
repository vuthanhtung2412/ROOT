import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { GAME_ASSET_KEYS, imagePathForAssetKey } from '#assets/gameAssets.ts'
import {
  fallClearingSuit,
  type BoardLayout,
  type ClearingSuit,
} from '#game/boardLayout.ts'
import type { CampfireSite } from '#game/map3d/campfires.ts'
import type { TimeOfDay } from '#game/map3d/daylight.ts'
import type { ForestGround } from '#game/map3d/groundMarkers.ts'
import { loadMapModels, type MapModels } from '#game/map3d/mapModels.ts'
import { createMapScene, type MapScene } from '#game/map3d/mapScene.ts'
import {
  createMapTerrain,
  type ClearingGround,
  type MapTerrain,
} from '#game/map3d/mapTerrain.ts'
import {
  mapWorldSizeForView,
  normalizedToGround,
  type MapGroundPoint,
  type MapViewFrame,
  type MapWorldSize,
  type NormalizedMapPoint,
} from '#game/map3d/mapWorldSpace.ts'
import { occupiedGroundsOfClearing } from '#react/map3d/mapPieces.ts'
import { fallForestLayouts, type FallForestLayout } from '@root/lib/fall-metadata'

export type MapSceneHandle = {
  /** Null until the models are loaded. */
  scene: MapScene | null
  clearingGrounds: readonly ClearingGround[]
  forestGrounds: readonly ForestGround[]
  river: MapTerrain['river']
  /** Bumps on every camera move: overlays re-project when it changes. */
  viewVersion: number
}

/** Digits kept of "how much larger than its focus is the view". */
const COVER_RATIO_DIGITS = 1

const SUIT_TEXTURE_KEY_BY_SUIT: Readonly<Record<ClearingSuit, string>> = {
  fox: GAME_ASSET_KEYS.suitFox,
  mouse: GAME_ASSET_KEYS.suitMouse,
  rabbit: GAME_ASSET_KEYS.suitRabbit,
}

function forestGroundsForWorld(worldSize: MapWorldSize): ForestGround[] {
  return fallForestLayouts().map(
    (forest: FallForestLayout): ForestGround => ({
      forestIndex: forest.forestIndex,
      corners: forest.corners.map(
        (corner: NormalizedMapPoint): MapGroundPoint =>
          normalizedToGround(corner, worldSize),
      ),
    }),
  )
}

function suitTexturePathsFor(
  clearings: readonly ClearingGround[],
): Map<number, string> {
  const paths: Map<number, string> = new Map<number, string>()
  for (const clearing of clearings) {
    const suit: ClearingSuit | null = fallClearingSuit(clearing.clearingId)
    const path: string | null =
      suit === null ? null : imagePathForAssetKey(SUIT_TEXTURE_KEY_BY_SUIT[suit])
    if (path !== null) {
      paths.set(clearing.clearingId, path)
    }
  }
  return paths
}

/** Loads the models, then owns the three.js scene drawn on the canvas. */
export function useMapScene(
  canvasReference: RefObject<HTMLCanvasElement | null>,
  layout: BoardLayout,
  frame: MapViewFrame,
  timeOfDay: TimeOfDay,
): MapSceneHandle {
  const [models, setModels] = useState<MapModels | null>(null)
  const [scene, setScene] = useState<MapScene | null>(null)
  const [viewVersion, setViewVersion] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    void loadMapModels().then((loaded: MapModels): void => {
      if (!cancelled) {
        setModels(loaded)
      }
    })
    return (): void => {
      cancelled = true
    }
  }, [])

  // The woodland takes the shape of the part of the screen it fills. Its
  // shape is rounded to steps, so dragging a window edge rebuilds it rarely.
  const terrainShape: string = [
    mapWorldSizeForView(frame.focus).depth,
    (frame.view.width / frame.focus.width).toFixed(COVER_RATIO_DIGITS),
    (frame.view.height / frame.focus.height).toFixed(COVER_RATIO_DIGITS),
  ].join(':')
  const terrain: MapTerrain = useMemo(
    () => createMapTerrain(layout, frame),
    // `frame` is read when the shape it rounds to changes, not on each pixel.
    [layout, terrainShape],
  )
  const forestGrounds: ForestGround[] = useMemo(
    () => forestGroundsForWorld(terrain.worldSize),
    [terrain],
  )
  const initialTimeOfDay = useRef<TimeOfDay>(timeOfDay)

  useEffect(() => {
    const canvas: HTMLCanvasElement | null = canvasReference.current
    if (canvas === null || models === null) {
      return undefined
    }
    const created: MapScene = createMapScene({
      canvas,
      controlElement: canvas.parentElement ?? canvas,
      models,
      terrain,
      frame,
      timeOfDay: initialTimeOfDay.current,
      forests: forestGrounds,
      campfireSites: terrain.clearings.map(
        (clearing: ClearingGround): CampfireSite => ({
          clearing,
          occupied: occupiedGroundsOfClearing({
            clearing,
            river: terrain.river,
          }),
        }),
      ),
      suitTexturePaths: suitTexturePathsFor(terrain.clearings),
    })
    const stopListening: () => void = created.onViewChanged((): void => {
      setViewVersion((version: number): number => version + 1)
    })
    setScene(created)
    return (): void => {
      stopListening()
      created.dispose()
      setScene(null)
    }
    // A new frame only rebuilds the scene through `terrain`.
  }, [canvasReference, forestGrounds, models, terrain])

  useEffect(() => {
    scene?.resize(frame)
  }, [scene, frame])

  useEffect(() => {
    initialTimeOfDay.current = timeOfDay
    scene?.setTimeOfDay(timeOfDay)
  }, [scene, timeOfDay])

  return {
    scene,
    clearingGrounds: terrain.clearings,
    forestGrounds,
    river: terrain.river,
    viewVersion,
  }
}
