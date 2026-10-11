import { PCFSoftShadowMap, Vector3, WebGLRenderer, type Scene } from 'three'
import type { ClearingLayoutPoint } from '#game/boardLayout.ts'
import {
  createGroundMarkers,
  type ClearingGround,
  type ClearingRingStyle,
  type ForestGround,
  type GroundMarkers,
} from '#game/map3d/groundMarkers.ts'
import {
  createMapCameraRig,
  type MapCameraRig,
  type MapViewPose,
  type MapViewSize,
} from '#game/map3d/mapCamera.ts'
import { createMapColorSampler } from '#game/map3d/mapColorSampler.ts'
import type { MapModels } from '#game/map3d/mapModels.ts'
import type {
  MapGroundPoint,
  MapWorldSize,
} from '#game/map3d/mapWorldSpace.ts'
import {
  createPieceLayer,
  type MapPiece,
  type PieceLayer,
} from '#game/map3d/pieceMeshes.ts'
import {
  createMapEnvironment,
  createMapTexture,
} from '#game/map3d/sceneEnvironment.ts'
import { createTreeMeshes } from '#game/map3d/treeMeshes.ts'
import { placeTrees } from '#game/map3d/treePlacement.ts'

export type MapSceneInput = {
  canvas: HTMLCanvasElement
  mapImage: HTMLImageElement
  models: MapModels
  worldSize: MapWorldSize
  viewSize: MapViewSize
  /** Clearings as drawn on the art (0..1), to keep them free of trees. */
  clearingLayoutPoints: readonly ClearingLayoutPoint[]
  clearings: readonly ClearingGround[]
  forests: readonly ForestGround[]
}

/** A point of the view, in CSS pixels from its top-left corner. */
export type MapViewPoint = {
  x: number
  y: number
}

export type MapScene = {
  resize: (viewSize: MapViewSize) => void
  setPieces: (pieces: readonly MapPiece[]) => void
  setClearingRings: (styles: ReadonlyMap<number, ClearingRingStyle>) => void
  setHighlightedForests: (forestIndexes: ReadonlySet<number>) => void
  /** Where a point above the board shows up in the view. */
  projectToView: (ground: MapGroundPoint, height: number) => MapViewPoint
  /** Called whenever the camera moved, so overlays can follow. */
  onViewChanged: (listener: () => void) => () => void
  resetView: () => void
  glideTo: (pose: MapViewPose) => void
  homePose: () => MapViewPose
  dispose: () => void
}

/** Trees per map width: about the density of the painted pines. */
const TREE_COLUMN_COUNT = 78
const TREE_SEED = 1894
const MAXIMUM_PIXEL_RATIO = 2
const MILLISECONDS_PER_SECOND = 1000
/** A tab coming back from the background must not jump the glide. */
const MAXIMUM_FRAME_SECONDS = 0.1
const HALF = 0.5

export function createMapScene(input: MapSceneInput): MapScene {
  const renderer: WebGLRenderer = new WebGLRenderer({
    canvas: input.canvas,
    antialias: true,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAXIMUM_PIXEL_RATIO))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap

  const scene: Scene = createMapEnvironment(
    input.worldSize,
    createMapTexture(input.mapImage),
  )
  const groundMarkers: GroundMarkers = createGroundMarkers(
    input.clearings,
    input.forests,
  )
  const pieceLayer: PieceLayer = createPieceLayer(input.models.meeples)
  scene.add(
    createTreeMeshes(
      placeTrees({
        sampleColor: createMapColorSampler(input.mapImage),
        mapNaturalSize: {
          width: input.mapImage.naturalWidth,
          height: input.mapImage.naturalHeight,
        },
        clearings: input.clearingLayoutPoints,
        columnCount: TREE_COLUMN_COUNT,
        seed: TREE_SEED,
      }),
      input.worldSize,
      input.models.trees,
    ),
    groundMarkers.group,
    pieceLayer.group,
  )

  const cameraRig: MapCameraRig = createMapCameraRig(
    input.canvas,
    input.worldSize,
    input.viewSize,
  )
  let viewSize: MapViewSize = input.viewSize
  const viewListeners: Set<() => void> = new Set<() => void>()
  const notifyViewChanged = (): void => {
    viewListeners.forEach((listener: () => void): void => {
      listener()
    })
  }
  cameraRig.controls.addEventListener('change', notifyViewChanged)

  const resize = (nextViewSize: MapViewSize): void => {
    viewSize = nextViewSize
    renderer.setSize(nextViewSize.width, nextViewSize.height)
    cameraRig.resize(nextViewSize)
    notifyViewChanged()
  }
  resize(input.viewSize)

  const startMilliseconds: number = performance.now()
  let previousMilliseconds: number = startMilliseconds
  let animationFrame = 0
  const renderFrame = (nowMilliseconds: number): void => {
    const deltaSeconds: number = Math.min(
      (nowMilliseconds - previousMilliseconds) / MILLISECONDS_PER_SECOND,
      MAXIMUM_FRAME_SECONDS,
    )
    previousMilliseconds = nowMilliseconds
    cameraRig.update(deltaSeconds)
    pieceLayer.faceCamera(cameraRig.controls.getAzimuthalAngle())
    groundMarkers.update(
      (nowMilliseconds - startMilliseconds) / MILLISECONDS_PER_SECOND,
    )
    renderer.render(scene, cameraRig.camera)
    animationFrame = requestAnimationFrame(renderFrame)
  }
  animationFrame = requestAnimationFrame(renderFrame)

  const projected: Vector3 = new Vector3()
  return {
    resize,
    setPieces: pieceLayer.setPieces,
    setClearingRings: groundMarkers.setClearingRings,
    setHighlightedForests: groundMarkers.setHighlightedForests,
    projectToView: (ground: MapGroundPoint, height: number): MapViewPoint => {
      projected.set(ground.x, height, ground.z).project(cameraRig.camera)
      return {
        x: (projected.x + 1) * HALF * viewSize.width,
        y: (1 - projected.y) * HALF * viewSize.height,
      }
    },
    onViewChanged: (listener: () => void): (() => void) => {
      viewListeners.add(listener)
      return (): void => {
        viewListeners.delete(listener)
      }
    },
    resetView: cameraRig.resetView,
    glideTo: cameraRig.glideTo,
    homePose: cameraRig.homePose,
    dispose: (): void => {
      cancelAnimationFrame(animationFrame)
      cameraRig.controls.removeEventListener('change', notifyViewChanged)
      cameraRig.dispose()
      pieceLayer.dispose()
      renderer.dispose()
    },
  }
}
