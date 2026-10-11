import { MathUtils, PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type {
  MapGroundPoint,
  MapWorldSize,
} from '#game/map3d/mapWorldSpace.ts'

/**
 * Camera of the 3D map: looks down at the board at a tilt, like the digital
 * game. Drag turns it, wheel / pinch zooms, right-drag or two fingers pan.
 */

export type MapViewSize = {
  width: number
  height: number
}

/** Where the camera is, as an orbit around a point of the board. */
export type MapViewPose = {
  /** Tilt from straight down, radians. */
  polarAngle: number
  /** Turn around the board, radians. */
  azimuthAngle: number
  distance: number
  target: MapGroundPoint
}

export type MapCameraRig = {
  camera: PerspectiveCamera
  controls: OrbitControls
  resize: (viewSize: MapViewSize) => void
  /** Glide back to the opening view. */
  resetView: () => void
  glideTo: (pose: MapViewPose) => void
  currentPose: () => MapViewPose
  homePose: () => MapViewPose
  /** Advance a running glide; call once per frame. */
  update: (deltaSeconds: number) => void
  dispose: () => void
}

const FIELD_OF_VIEW_DEGREES = 32
const NEAR_PLANE = 1
const FAR_PLANE = 900
const HALF = 0.5

const HOME_POLAR_ANGLE = MathUtils.degToRad(36)
/** The map opens seen from straight above, then tilts into the home view. */
const OPENING_POLAR_ANGLE = MathUtils.degToRad(2)
const MINIMUM_POLAR_ANGLE = MathUtils.degToRad(2)
const MAXIMUM_POLAR_ANGLE = MathUtils.degToRad(72)
/** Room around the board at the home view. */
const HOME_FIT_MARGIN = 1.12
const OPENING_DISTANCE_RATIO = 1.15
const MINIMUM_DISTANCE = 22
const MAXIMUM_DISTANCE_RATIO = 1.5
const DAMPING_FACTOR = 0.12
const GLIDE_SECONDS = 1.6
/** The tilted board looks centred when the camera aims a little south. */
const HOME_TARGET_DEPTH_RATIO = 0.1

function easeInOut(progress: number): number {
  return progress * progress * (3 - 2 * progress)
}

function mixPoses(
  from: MapViewPose,
  to: MapViewPose,
  progress: number,
): MapViewPose {
  return {
    polarAngle: MathUtils.lerp(from.polarAngle, to.polarAngle, progress),
    azimuthAngle: MathUtils.lerp(from.azimuthAngle, to.azimuthAngle, progress),
    distance: MathUtils.lerp(from.distance, to.distance, progress),
    target: {
      x: MathUtils.lerp(from.target.x, to.target.x, progress),
      z: MathUtils.lerp(from.target.z, to.target.z, progress),
    },
  }
}

export function createMapCameraRig(
  canvas: HTMLCanvasElement,
  worldSize: MapWorldSize,
  initialViewSize: MapViewSize,
): MapCameraRig {
  const camera: PerspectiveCamera = new PerspectiveCamera(
    FIELD_OF_VIEW_DEGREES,
    initialViewSize.width / initialViewSize.height,
    NEAR_PLANE,
    FAR_PLANE,
  )
  const controls: OrbitControls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = DAMPING_FACTOR
  controls.screenSpacePanning = false
  controls.minPolarAngle = MINIMUM_POLAR_ANGLE
  controls.maxPolarAngle = MAXIMUM_POLAR_ANGLE
  controls.minDistance = MINIMUM_DISTANCE

  /** Distance at which the whole board fits the view, seen from above. */
  const fitDistance = (): number => {
    const halfViewTangent: number = Math.tan(
      MathUtils.degToRad(FIELD_OF_VIEW_DEGREES) * HALF,
    )
    const fitDepth: number = (worldSize.depth * HALF) / halfViewTangent
    const fitWidth: number =
      (worldSize.width * HALF) / (halfViewTangent * camera.aspect)
    return Math.max(fitDepth, fitWidth)
  }

  const homePose = (): MapViewPose => ({
    polarAngle: HOME_POLAR_ANGLE,
    azimuthAngle: 0,
    distance: fitDistance() * HOME_FIT_MARGIN,
    target: { x: 0, z: worldSize.depth * HOME_TARGET_DEPTH_RATIO },
  })

  const applyPose = (pose: MapViewPose): void => {
    controls.target.set(pose.target.x, 0, pose.target.z)
    const offset: Vector3 = new Vector3().setFromSphericalCoords(
      pose.distance,
      pose.polarAngle,
      pose.azimuthAngle,
    )
    camera.position.copy(controls.target).add(offset)
    camera.lookAt(controls.target)
  }

  const currentPose = (): MapViewPose => ({
    polarAngle: controls.getPolarAngle(),
    azimuthAngle: controls.getAzimuthalAngle(),
    distance: controls.getDistance(),
    target: { x: controls.target.x, z: controls.target.z },
  })

  let glide: { from: MapViewPose; to: MapViewPose; elapsed: number } | null =
    null

  const glideTo = (pose: MapViewPose): void => {
    glide = { from: currentPose(), to: pose, elapsed: 0 }
  }

  /** The camera never leaves the board behind. */
  const keepTargetOnBoard = (): void => {
    controls.target.x = MathUtils.clamp(
      controls.target.x,
      -worldSize.width * HALF,
      worldSize.width * HALF,
    )
    controls.target.z = MathUtils.clamp(
      controls.target.z,
      -worldSize.depth * HALF,
      worldSize.depth * HALF,
    )
    controls.target.y = 0
  }
  const stopGlide = (): void => {
    glide = null
  }
  controls.addEventListener('change', keepTargetOnBoard)
  controls.addEventListener('start', stopGlide)

  const resize = (viewSize: MapViewSize): void => {
    camera.aspect = viewSize.width / viewSize.height
    camera.updateProjectionMatrix()
    controls.maxDistance = fitDistance() * MAXIMUM_DISTANCE_RATIO
  }

  resize(initialViewSize)
  applyPose({
    ...homePose(),
    polarAngle: OPENING_POLAR_ANGLE,
    distance: fitDistance() * OPENING_DISTANCE_RATIO,
  })
  controls.update()
  glideTo(homePose())

  return {
    camera,
    controls,
    resize,
    resetView: (): void => {
      glideTo(homePose())
    },
    glideTo,
    currentPose,
    homePose,
    update: (deltaSeconds: number): void => {
      if (glide !== null) {
        glide.elapsed += deltaSeconds
        const progress: number = Math.min(glide.elapsed / GLIDE_SECONDS, 1)
        applyPose(mixPoses(glide.from, glide.to, easeInOut(progress)))
        if (progress >= 1) {
          glide = null
        }
      }
      controls.update()
    },
    dispose: (): void => {
      controls.removeEventListener('change', keepTargetOnBoard)
      controls.removeEventListener('start', stopGlide)
      controls.dispose()
    },
  }
}
