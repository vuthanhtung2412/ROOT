import { useEffect, useMemo, useState, type RefObject } from 'react'
import { autumnMapPublicPath } from '#assets/gameAssets.ts'
import type { BoardLayout, ClearingLayoutPoint } from '#game/boardLayout.ts'
import type {
  ClearingGround,
  ForestGround,
} from '#game/map3d/groundMarkers.ts'
import type { MapViewSize } from '#game/map3d/mapCamera.ts'
import { loadMapModels, type MapModels } from '#game/map3d/mapModels.ts'
import { createMapScene, type MapScene } from '#game/map3d/mapScene.ts'
import {
  mapWorldSize,
  normalizedRadiusToWorld,
  normalizedToGround,
  type MapWorldSize,
  type NormalizedMapPoint,
} from '#game/map3d/mapWorldSpace.ts'
import { fallForestLayouts, type FallForestLayout } from '@root/lib/fall-metadata'

/** What the 3D map needs before it can be drawn. */
type MapSceneAssets = {
  mapImage: HTMLImageElement
  models: MapModels
}

export type MapSceneHandle = {
  /** Null until the map art and the models are loaded. */
  scene: MapScene | null
  clearingGrounds: readonly ClearingGround[]
  forestGrounds: readonly ForestGround[]
  /** Bumps on every camera move: overlays re-project when it changes. */
  viewVersion: number
}

function loadMapImage(path: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>(
    (resolve: (image: HTMLImageElement) => void, reject: () => void): void => {
      const image: HTMLImageElement = new Image()
      image.onload = (): void => {
        resolve(image)
      }
      image.onerror = reject
      image.src = path
    },
  )
}

function clearingGroundsForLayout(
  layout: BoardLayout,
  worldSize: MapWorldSize,
): ClearingGround[] {
  return Object.entries(layout.clearings).map(
    ([clearingId, point]: [string, ClearingLayoutPoint]): ClearingGround => ({
      clearingId: Number(clearingId),
      center: normalizedToGround(point, worldSize),
      radius: normalizedRadiusToWorld(point.r, worldSize),
    }),
  )
}

function forestGroundsForWorld(worldSize: MapWorldSize): ForestGround[] {
  return fallForestLayouts().map(
    (forest: FallForestLayout): ForestGround => ({
      forestIndex: forest.forestIndex,
      corners: forest.corners.map((corner: NormalizedMapPoint) =>
        normalizedToGround(corner, worldSize),
      ),
    }),
  )
}

/** Loads the assets, then owns the three.js scene drawn on the canvas. */
export function useMapScene(
  canvasReference: RefObject<HTMLCanvasElement | null>,
  layout: BoardLayout,
  viewSize: MapViewSize,
): MapSceneHandle {
  const [assets, setAssets] = useState<MapSceneAssets | null>(null)
  const [scene, setScene] = useState<MapScene | null>(null)
  const [viewVersion, setViewVersion] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    void Promise.all([loadMapImage(autumnMapPublicPath()), loadMapModels()]).then(
      ([mapImage, models]: [HTMLImageElement, MapModels]): void => {
        if (!cancelled) {
          setAssets({ mapImage, models })
        }
      },
    )
    return (): void => {
      cancelled = true
    }
  }, [])

  const worldSize: MapWorldSize | null = useMemo(
    () =>
      assets === null
        ? null
        : mapWorldSize({
            width: assets.mapImage.naturalWidth,
            height: assets.mapImage.naturalHeight,
          }),
    [assets],
  )
  const clearingGrounds: ClearingGround[] = useMemo(
    () => (worldSize === null ? [] : clearingGroundsForLayout(layout, worldSize)),
    [layout, worldSize],
  )
  const forestGrounds: ForestGround[] = useMemo(
    () => (worldSize === null ? [] : forestGroundsForWorld(worldSize)),
    [worldSize],
  )

  useEffect(() => {
    const canvas: HTMLCanvasElement | null = canvasReference.current
    if (canvas === null || assets === null || worldSize === null) {
      return undefined
    }
    const created: MapScene = createMapScene({
      canvas,
      mapImage: assets.mapImage,
      models: assets.models,
      worldSize,
      viewSize,
      clearingLayoutPoints: Object.values(layout.clearings),
      clearings: clearingGrounds,
      forests: forestGrounds,
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
    // The view size is applied by the resize effect below, not by a rebuild.
  }, [assets, canvasReference, clearingGrounds, forestGrounds, layout, worldSize])

  useEffect(() => {
    scene?.resize(viewSize)
  }, [scene, viewSize])

  return { scene, clearingGrounds, forestGrounds, viewVersion }
}
