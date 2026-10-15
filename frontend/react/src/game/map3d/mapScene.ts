import {
  Group,
  PCFSoftShadowMap,
  PointLight,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three'
import {
  createCampfires,
  type Campfires,
  type CampfireSite,
} from '#game/map3d/campfires.ts'
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
import type {
  MapModels,
  MountainModels,
  PieceModels,
} from '#game/map3d/mapModels.ts'
import type { MapTerrain } from '#game/map3d/mapTerrain.ts'
import type {
  MapGroundPoint,
  MapViewFrame,
} from '#game/map3d/mapWorldSpace.ts'
import { createMountainMeshes } from '#game/map3d/mountainMeshes.ts'
import {
  placeMountains,
  type MountainPlacement,
} from '#game/map3d/mountainPlacement.ts'
import {
  createPieceLayer,
  type MapPiece,
  type PieceLayer,
} from '#game/map3d/pieceMeshes.ts'
import { createRiverFlow, type RiverFlow } from '#game/map3d/riverFlow.ts'
import { createGround } from '#game/map3d/sceneGround.ts'
import { disposeObjectTree } from '#game/map3d/sceneObjects.ts'
import { createTreeMeshes } from '#game/map3d/treeMeshes.ts'
import { placeTrees } from '#game/map3d/treePlacement.ts'
import {
  createTreeSightlines,
  type TreeSightlines,
} from '#game/map3d/treeSightlines.ts'

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
  /** The camera starts higher up and settles into the home view. */
  opensFromAfar: boolean
  forests: readonly ForestGround[]
  /** Each clearing with the ground its campfire must keep away from. */
  campfireSites: readonly CampfireSite[]
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
  /** The 3D models of the pieces arrived, after the woodland was up. */
  setPieceModels: (pieceModels: PieceModels) => void
  /** The mountain models arrived, after the woodland was up. */
  setMountainModels: (mountainModels: MountainModels) => void
  /** The pieces with these keys were just built: play them going up. */
  playBuild: (pieceKeys: readonly string[]) => void
  setClearingRings: (styles: ReadonlyMap<number, ClearingRingStyle>) => void
  setHighlightedForests: (forestIndexes: ReadonlySet<number>) => void
  /** Game log: point at a clearing for a moment. */
  flashClearing: (clearingId: number) => void
  /** Fade the light to that of a phase of the turn. */
  setTimeOfDay: (timeOfDay: TimeOfDay) => void
  /** Where a point above the ground shows up in the view. */
  projectToView: (ground: MapGroundPoint, height: number) => MapViewPoint
  /** Called whenever the camera moved, so overlays can follow. */
  onViewChanged: (listener: () => void) => () => void
  dispose: () => void
}

const TREE_SEED = 1894
const MOUNTAIN_SEED = 41
/** The Vagabond takes its torch out when the campfires are lit. */
const TORCH_TIME_OF_DAY: TimeOfDay = 'evening'
const MAXIMUM_PIXEL_RATIO = 2
const MILLISECONDS_PER_SECOND = 1000
/** A tab coming back from the background must not jump the glide. */
const MAXIMUM_FRAME_SECONDS = 0.1
/**
 * Frames are at least this far apart while only the scenery moves: thirty
 * per second, less a margin so a frame of the screen is not missed by a hair.
 */
const AMBIENT_FRAME_MILLISECONDS = 32
/** The camera counts as moving this long after its last move or touch. */
const CAMERA_SETTLE_MILLISECONDS = 300
const HALF = 0.5

export function createMapScene(input: MapSceneInput): MapScene {
  const renderer: WebGLRenderer = new WebGLRenderer({
    canvas: input.canvas,
    antialias: true,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAXIMUM_PIXEL_RATIO))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  // The woodland stands still: its shadows are drawn again only when the sun
  // or a piece moved, not on every frame.
  renderer.shadowMap.autoUpdate = false

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
  const pieceLayer: PieceLayer = createPieceLayer()
  pieceLayer.setTorchesShown(input.timeOfDay === TORCH_TIME_OF_DAY)
  const riverFlow: RiverFlow = createRiverFlow(input.terrain.river)
  const campfires: Campfires = createCampfires({
    model: input.models.campfire,
    sites: input.campfireSites,
    river: input.terrain.river,
    timeOfDay: input.timeOfDay,
  })
  const treeSightlines: TreeSightlines = createTreeSightlines()
  /** Empty until the mountain models are loaded. */
  const mountainLayer: Group = new Group()
  scene.add(
    campfires.group,
    ...daylight.lights,
    createGround(input.terrain),
    riverFlow.mesh,
    mountainLayer,
    createTreeMeshes(
      placeTrees(input.terrain, TREE_SEED),
      input.models.trees,
      treeSightlines,
    ),
    groundMarkers.group,
    pieceLayer.group,
  )

  const cameraRig: MapCameraRig = createMapCameraRig(
    input.controlElement,
    input.terrain.worldSize,
    { frame: input.frame, opensFromAfar: input.opensFromAfar },
  )
  /**
   * A material is built into a shader the first time it is drawn, and again
   * the first time the campfires are lit: both stall a frame, in the middle
   * of a zoom or of a change of phase. Build them all now, for both lightings,
   * in the background where the browser can.
   */
  const warmUpShaders = (): void => {
    const firelights: PointLight[] = []
    campfires.group.traverse((part: Object3D): void => {
      if (part instanceof PointLight) {
        firelights.push(part)
      }
    })
    for (const firesLit of [true, false]) {
      for (const firelight of firelights) {
        // Put back by the fires themselves on their next frame.
        firelight.visible = firesLit
      }
      void renderer.compileAsync(scene, cameraRig.camera)
    }
  }
  warmUpShaders()

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
  let shadowsAreStale = true
  /** Zoom the shadows were last drawn at: the models grow with it. */
  let shadowZoom: number = cameraRig.zoom()
  /** Until then (page clock) the camera counts as moving. */
  let cameraMovesUntilMilliseconds: number =
    startMilliseconds + CAMERA_SETTLE_MILLISECONDS
  const noteCameraMoved = (): void => {
    cameraMovesUntilMilliseconds =
      performance.now() + CAMERA_SETTLE_MILLISECONDS
  }
  cameraRig.controls.addEventListener('start', noteCameraMoved)
  cameraRig.controls.addEventListener('change', noteCameraMoved)
  const renderFrame = (nowMilliseconds: number): void => {
    // With the camera at rest only the river, the fires and the marks move:
    // they are drawn at a slower pace, which spares the battery.
    const onlyAmbientMotion: boolean =
      nowMilliseconds >= cameraMovesUntilMilliseconds &&
      !shadowsAreStale &&
      !daylight.isSunMoving() &&
      !pieceLayer.isBuildPlaying()
    if (
      onlyAmbientMotion &&
      nowMilliseconds - previousMilliseconds < AMBIENT_FRAME_MILLISECONDS
    ) {
      animationFrame = requestAnimationFrame(renderFrame)
      return
    }
    const deltaSeconds: number = Math.min(
      (nowMilliseconds - previousMilliseconds) / MILLISECONDS_PER_SECOND,
      MAXIMUM_FRAME_SECONDS,
    )
    previousMilliseconds = nowMilliseconds
    cameraRig.update(deltaSeconds)
    const zoom: number = cameraRig.zoom()
    // Read before the update: the last frame of a build still moves a model.
    if (
      shadowsAreStale ||
      zoom !== shadowZoom ||
      daylight.isSunMoving() ||
      pieceLayer.isBuildPlaying()
    ) {
      renderer.shadowMap.needsUpdate = true
      shadowsAreStale = false
      shadowZoom = zoom
    }
    pieceLayer.setZoom(zoom)
    pieceLayer.update(deltaSeconds)
    groundMarkers.setZoom(cameraRig.zoom())
    daylight.followCamera(cameraRig.camera.position, cameraRig.controls.target)
    daylight.update(deltaSeconds)
    riverFlow.update(deltaSeconds)
    campfires.update(deltaSeconds)
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
    setPieces: (pieces: readonly MapPiece[]): void => {
      pieceLayer.setPieces(pieces)
      shadowsAreStale = true
      // Only a Vagabond in a forest stands among the trees that would hide it.
      treeSightlines.setTargets(
        pieces
          .filter((piece: MapPiece): boolean => piece.isInForest === true)
          .map((piece: MapPiece): MapGroundPoint => piece.ground),
      )
    },
    setPieceModels: (pieceModels: PieceModels): void => {
      pieceLayer.setPieceModels(pieceModels)
      shadowsAreStale = true
      warmUpShaders()
    },
    setMountainModels: (mountainModels: MountainModels): void => {
      const mountainPlacements: MountainPlacement[] = placeMountains(
        input.terrain,
        MOUNTAIN_SEED,
        mountainModels.length,
      )
      disposeObjectTree(mountainLayer)
      mountainLayer.clear()
      mountainLayer.add(createMountainMeshes(mountainPlacements, mountainModels))
      shadowsAreStale = true
      warmUpShaders()
    },
    playBuild: pieceLayer.playBuild,
    setClearingRings: groundMarkers.setClearingRings,
    setHighlightedForests: groundMarkers.setHighlightedForests,
    flashClearing: groundMarkers.flashClearing,
    setTimeOfDay: (timeOfDay: TimeOfDay): void => {
      daylight.setTimeOfDay(timeOfDay)
      campfires.setTimeOfDay(timeOfDay)
      groundMarkers.setTimeOfDay(timeOfDay)
      pieceLayer.setTorchesShown(timeOfDay === TORCH_TIME_OF_DAY)
      shadowsAreStale = true
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
      cameraRig.controls.removeEventListener('start', noteCameraMoved)
      cameraRig.controls.removeEventListener('change', noteCameraMoved)
      cameraRig.dispose()
      // First, while every part is still in the scene: the ground and its
      // texture, the trees, the marks and the shadow map have no owner else.
      disposeObjectTree(scene)
      pieceLayer.dispose()
      riverFlow.dispose()
      campfires.dispose()
      renderer.dispose()
    },
  }
}
