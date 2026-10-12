import { PCFSoftShadowMap, Scene, Vector3, WebGLRenderer } from 'three'
import {
  createDaylightRig,
  type DaylightRig,
  type TimeOfDay,
} from '#game/map3d/daylight.ts'
import {
  createGroundMarkers,
  type ClearingRingStyle,
  type ForestGround,
  type GroundMarkers,
} from '#game/map3d/groundMarkers.ts'
import { createMapCameraRig, type MapCameraRig } from '#game/map3d/mapCamera.ts'
import type { MapModels } from '#game/map3d/mapModels.ts'
import type { MapTerrain } from '#game/map3d/mapTerrain.ts'
import type {
  MapGroundPoint,
  MapViewFrame,
} from '#game/map3d/mapWorldSpace.ts'
import {
  createPieceLayer,
  type MapPiece,
  type PieceLayer,
} from '#game/map3d/pieceMeshes.ts'
import { createRiverFlow, type RiverFlow } from '#game/map3d/riverFlow.ts'
import { createGround } from '#game/map3d/sceneGround.ts'
import { createTreeMeshes } from '#game/map3d/treeMeshes.ts'
import { placeTrees } from '#game/map3d/treePlacement.ts'

export type MapSceneInput = {
  canvas: HTMLCanvasElement
  /**
   * Takes the wheel and drag gestures. The element around the canvas, so a
   * gesture that starts on a clearing button still moves the camera.
   */
  controlElement: HTMLElement
  models: MapModels
  terrain: MapTerrain
  frame: MapViewFrame
  timeOfDay: TimeOfDay
  forests: readonly ForestGround[]
  /** Suit icon of each clearing (clearing id → image path). */
  suitTexturePaths: ReadonlyMap<number, string>
}

/** A point of the view, in CSS pixels from its top-left corner. */
export type MapViewPoint = {
  x: number
  y: number
}

export type MapScene = {
  resize: (frame: MapViewFrame) => void
  setPieces: (pieces: readonly MapPiece[]) => void
  /** The pieces with these keys were just built: play them going up. */
  playBuild: (pieceKeys: readonly string[]) => void
  setClearingRings: (styles: ReadonlyMap<number, ClearingRingStyle>) => void
  setHighlightedForests: (forestIndexes: ReadonlySet<number>) => void
  /** Fade the light to that of a phase of the turn. */
  setTimeOfDay: (timeOfDay: TimeOfDay) => void
  /** Where a point above the ground shows up in the view. */
  projectToView: (ground: MapGroundPoint, height: number) => MapViewPoint
  /** Called whenever the camera moved, so overlays can follow. */
  onViewChanged: (listener: () => void) => () => void
  dispose: () => void
}

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

  const scene: Scene = new Scene()
  const daylight: DaylightRig = createDaylightRig(input.timeOfDay)
  scene.fog = daylight.fog
  scene.background = daylight.backdrop
  const groundMarkers: GroundMarkers = createGroundMarkers({
    clearings: input.terrain.clearings,
    forests: input.forests,
    suitTexturePaths: input.suitTexturePaths,
    timeOfDay: input.timeOfDay,
  })
  const pieceLayer: PieceLayer = createPieceLayer(input.models.pieces)
  const riverFlow: RiverFlow = createRiverFlow(input.terrain.river)
  scene.add(
    ...daylight.lights,
    createGround(input.terrain),
    riverFlow.mesh,
    createTreeMeshes(placeTrees(input.terrain, TREE_SEED), input.models.trees),
    groundMarkers.group,
    pieceLayer.group,
  )

  const cameraRig: MapCameraRig = createMapCameraRig(
    input.controlElement,
    input.terrain.worldSize,
    input.frame,
  )
  let frame: MapViewFrame = input.frame
  const viewListeners: Set<() => void> = new Set<() => void>()
  const notifyViewChanged = (): void => {
    viewListeners.forEach((listener: () => void): void => {
      listener()
    })
  }
  cameraRig.controls.addEventListener('change', notifyViewChanged)

  const resize = (nextFrame: MapViewFrame): void => {
    frame = nextFrame
    renderer.setSize(nextFrame.view.width, nextFrame.view.height)
    cameraRig.resize(nextFrame)
    notifyViewChanged()
  }
  resize(input.frame)

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
    pieceLayer.setZoom(cameraRig.zoom())
    pieceLayer.update(deltaSeconds)
    groundMarkers.setZoom(cameraRig.zoom())
    daylight.update(deltaSeconds)
    riverFlow.update(deltaSeconds)
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
    playBuild: pieceLayer.playBuild,
    setClearingRings: groundMarkers.setClearingRings,
    setHighlightedForests: groundMarkers.setHighlightedForests,
    setTimeOfDay: (timeOfDay: TimeOfDay): void => {
      daylight.setTimeOfDay(timeOfDay)
      groundMarkers.setTimeOfDay(timeOfDay)
    },
    projectToView: (ground: MapGroundPoint, height: number): MapViewPoint => {
      projected.set(ground.x, height, ground.z).project(cameraRig.camera)
      return {
        x: (projected.x + 1) * HALF * frame.view.width,
        y: (1 - projected.y) * HALF * frame.view.height,
      }
    },
    onViewChanged: (listener: () => void): (() => void) => {
      viewListeners.add(listener)
      return (): void => {
        viewListeners.delete(listener)
      }
    },
    dispose: (): void => {
      cancelAnimationFrame(animationFrame)
      cameraRig.controls.removeEventListener('change', notifyViewChanged)
      cameraRig.dispose()
      pieceLayer.dispose()
      riverFlow.dispose()
      renderer.dispose()
    },
  }
}
