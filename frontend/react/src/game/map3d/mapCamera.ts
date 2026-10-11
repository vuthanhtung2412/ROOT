import { MathUtils, MOUSE, PerspectiveCamera, TOUCH, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type {
  MapGroundPoint,
  MapViewFrame,
  MapWorldSize,
} from '#game/map3d/mapWorldSpace.ts'

/**
 * Camera of the 3D map: looks down at the woodland at a fixed tilt, like the
 * digital game. It never turns: wheel / pinch zooms, drag pans.
 */

/** Where the camera is: how far, and which point of the ground it aims at. */
export type MapViewPose = {
  distance: number
  target: MapGroundPoint
}

export type MapCameraRig = {
  camera: PerspectiveCamera
  controls: OrbitControls
  resize: (frame: MapViewFrame) => void
  /** Glide back to the opening view. */
  resetView: () => void
  /** Advance a running glide; call once per frame. */
  update: (deltaSeconds: number) => void
  /** 0 = zoomed all the way out, 1 = all the way in. */
  zoom: () => number
  dispose: () => void
}

const FIELD_OF_VIEW_DEGREES = 30
const NEAR_PLANE = 1
const FAR_PLANE = 900
const HALF = 0.5

/**
 * Tilt from straight down. Zoomed out the camera looks straight down, like
 * at a map; zooming in tips it forward so the 3D pieces show their sides.
 */
const FAR_TILT_ANGLE = MathUtils.degToRad(1)
const NEAR_TILT_ANGLE = MathUtils.degToRad(44)
/** The camera reaches its full tilt at this much zoom (0 = out, 1 = in). */
const FULL_TILT_ZOOM = 0.75
/** Room around the woodland at the home view. */
const HOME_FIT_MARGIN = 1.04
/**
 * The hand covers more of the bottom of the view than the banner does of
 * the top: aim a little south, so the woodland sits a little higher.
 */
const HOME_TARGET_DEPTH_RATIO = 0.035
/** The map opens from a little higher up and settles into the home view. */
const OPENING_DISTANCE_RATIO = 1.35
const MINIMUM_DISTANCE = 26
/** Half-way zoomed in, the camera may already reach every corner. */
const PAN_REACH_GAIN = 2
const DAMPING_FACTOR = 0.14
const GLIDE_SECONDS = 1.4

function easeInOut(progress: number): number {
  return progress * progress * (3 - 2 * progress)
}

export function createMapCameraRig(
  /** Listens for wheel and drag: the map and everything laid over it. */
  controlElement: HTMLElement,
  worldSize: MapWorldSize,
  initialFrame: MapViewFrame,
): MapCameraRig {
  const camera: PerspectiveCamera = new PerspectiveCamera(
    FIELD_OF_VIEW_DEGREES,
    initialFrame.view.width / initialFrame.view.height,
    NEAR_PLANE,
    FAR_PLANE,
  )
  const controls: OrbitControls = new OrbitControls(
    camera,
    controlElement,
  )
  controls.enableRotate = false
  controls.minAzimuthAngle = 0
  controls.maxAzimuthAngle = 0
  controls.enableDamping = true
  controls.dampingFactor = DAMPING_FACTOR
  controls.screenSpacePanning = false
  controls.zoomToCursor = true
  controls.minDistance = MINIMUM_DISTANCE
  controls.mouseButtons = {
    LEFT: MOUSE.PAN,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.PAN,
  }
  controls.touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }

  let frame: MapViewFrame = initialFrame
  const halfViewTangent: number = Math.tan(
    MathUtils.degToRad(FIELD_OF_VIEW_DEGREES) * HALF,
  )

  /** Distance at which the whole woodland fits the focus of the view. */
  const homeDistance = (): number => {
    const fitDepth: number =
      (worldSize.depth * HALF) /
      (halfViewTangent * (frame.focus.height / frame.view.height))
    const fitWidth: number =
      (worldSize.width * HALF) /
      (halfViewTangent * camera.aspect * (frame.focus.width / frame.view.width))
    return Math.max(fitDepth, fitWidth) * HOME_FIT_MARGIN
  }

  const homePose = (): MapViewPose => {
    const distance: number = homeDistance()
    const worldUnitsPerPixel: number =
      (distance * halfViewTangent) / (frame.view.height * HALF)
    return {
      distance,
      // Aim off-centre so the woodland sits in the middle of the focus.
      target: {
        x: -frame.focusOffsetX * worldUnitsPerPixel,
        z: worldSize.depth * HOME_TARGET_DEPTH_RATIO,
      },
    }
  }

  /** 0 = zoomed all the way out (the home view), 1 = all the way in. */
  const zoomFor = (distance: number): number =>
    MathUtils.clamp(
      1 - (distance - MINIMUM_DISTANCE) / (homeDistance() - MINIMUM_DISTANCE),
      0,
      1,
    )

  const tiltFor = (distance: number): number =>
    MathUtils.lerp(
      FAR_TILT_ANGLE,
      NEAR_TILT_ANGLE,
      MathUtils.smoothstep(zoomFor(distance), 0, FULL_TILT_ZOOM),
    )

  const applyPose = (pose: MapViewPose): void => {
    controls.target.set(pose.target.x, 0, pose.target.z)
    const offset: Vector3 = new Vector3().setFromSphericalCoords(
      pose.distance,
      tiltFor(pose.distance),
      0,
    )
    camera.position.copy(controls.target).add(offset)
    camera.lookAt(controls.target)
  }

  const currentPose = (): MapViewPose => ({
    distance: controls.getDistance(),
    target: { x: controls.target.x, z: controls.target.z },
  })

  let glide: { from: MapViewPose; to: MapViewPose; elapsed: number } | null =
    null

  /**
   * Zoomed out, the whole woodland is in view and there is nowhere to pan;
   * the closer the camera, the further it may wander — never off the map.
   */
  const keepTargetOnMap = (): void => {
    const home: MapViewPose = homePose()
    const freedom: number = MathUtils.clamp(
      (1 - controls.getDistance() / home.distance) * PAN_REACH_GAIN,
      0,
      1,
    )
    const reachX: number = worldSize.width * HALF * freedom
    const reachZ: number = worldSize.depth * HALF * freedom
    controls.target.x = MathUtils.clamp(
      controls.target.x,
      home.target.x - reachX,
      home.target.x + reachX,
    )
    controls.target.z = MathUtils.clamp(
      controls.target.z,
      home.target.z - reachZ,
      home.target.z + reachZ,
    )
    controls.target.y = 0
  }
  const stopGlide = (): void => {
    glide = null
    controls.maxDistance = homeDistance()
  }
  controls.addEventListener('start', stopGlide)

  const resize = (nextFrame: MapViewFrame): void => {
    frame = nextFrame
    camera.aspect = nextFrame.view.width / nextFrame.view.height
    camera.updateProjectionMatrix()
    controls.maxDistance = homeDistance()
  }

  resize(initialFrame)
  controls.maxDistance = Number.POSITIVE_INFINITY
  applyPose({
    ...homePose(),
    distance: homeDistance() * OPENING_DISTANCE_RATIO,
  })
  controls.update()
  glide = { from: currentPose(), to: homePose(), elapsed: 0 }

  return {
    camera,
    controls,
    resize,
    resetView: (): void => {
      glide = { from: currentPose(), to: homePose(), elapsed: 0 }
    },
    update: (deltaSeconds: number): void => {
      if (glide !== null) {
        glide.elapsed += deltaSeconds
        const progress: number = Math.min(glide.elapsed / GLIDE_SECONDS, 1)
        const eased: number = easeInOut(progress)
        applyPose({
          distance: MathUtils.lerp(glide.from.distance, glide.to.distance, eased),
          target: {
            x: MathUtils.lerp(glide.from.target.x, glide.to.target.x, eased),
            z: MathUtils.lerp(glide.from.target.z, glide.to.target.z, eased),
          },
        })
        if (progress >= 1) {
          glide = null
          controls.maxDistance = homeDistance()
        }
      } else {
        keepTargetOnMap()
      }
      // The controls may zoom and pan, never turn: the tilt is pinned to
      // what the zoom calls for, the heading to north.
      const tilt: number = tiltFor(controls.getDistance())
      controls.minPolarAngle = tilt
      controls.maxPolarAngle = tilt
      controls.update()
    },
    zoom: (): number => zoomFor(controls.getDistance()),
    dispose: (): void => {
      controls.removeEventListener('start', stopGlide)
      controls.dispose()
      // OrbitControls leaves `cursor: auto` inline; clear so the themed
      // sword cursor from CSS can show again.
      controlElement.style.cursor = ''
    },
  }
}
