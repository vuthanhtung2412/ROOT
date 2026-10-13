import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  MathUtils,
  Vector3,
  type Light,
} from 'three'

/**
 * Light of the woodland, by the phase of the turn:
 * - birdsong: dawn — a low orange sun in the east, peach sky, warm mist;
 * - daylight: a high warm sun, clear air;
 * - evening: blue moonlight from the west, night-blue sky (the clearings
 *   are lit by their campfires).
 *   In the evening a soft light also shines from the camera.
 * A change of phase fades from one to the next.
 */
export type TimeOfDay = 'birdsong' | 'daylight' | 'evening'

export type DaylightRig = {
  /** To add to the scene. */
  lights: readonly Light[]
  /** To set as the scene's fog and background. */
  fog: Fog
  backdrop: Color
  /** Keep the camera's own light on the camera; call once per frame. */
  followCamera: (cameraPosition: Vector3, lookedAt: Vector3) => void
  setTimeOfDay: (timeOfDay: TimeOfDay) => void
  /** Advance the fade; call once per frame. */
  update: (deltaSeconds: number) => void
  /** The sun is still on its way to its place: the shadows turn with it. */
  isSunMoving: () => boolean
}

type LightingPreset = {
  sunColor: number
  sunIntensity: number
  sunPosition: { x: number; y: number; z: number }
  skyColor: number
  groundColor: number
  skyIntensity: number
  /** Colour the far woodland fades into (also the backdrop). */
  fogColor: number
  fogNear: number
  fogFar: number
  /** Strength of the light that shines from the camera onto what it shows. */
  cameraLightIntensity: number
}

const LIGHTING_PRESETS: Readonly<Record<TimeOfDay, LightingPreset>> = {
  birdsong: {
    sunColor: 0xff9450,
    sunIntensity: 2,
    sunPosition: { x: 95, y: 42, z: 30 },
    skyColor: 0xffc994,
    groundColor: 0x5c4634,
    skyIntensity: 1.35,
    fogColor: 0xc08a5c,
    fogNear: 140,
    fogFar: 520,
    cameraLightIntensity: 0,
  },
  daylight: {
    sunColor: 0xfff0d2,
    sunIntensity: 2.3,
    sunPosition: { x: -35, y: 105, z: 40 },
    skyColor: 0xfff6e2,
    groundColor: 0x3d5644,
    skyIntensity: 1.5,
    fogColor: 0x2a4034,
    fogNear: 230,
    fogFar: 520,
    cameraLightIntensity: 0,
  },
  evening: {
    sunColor: 0x6f9cff,
    sunIntensity: 0.95,
    sunPosition: { x: -100, y: 36, z: 35 },
    skyColor: 0x5b7fe0,
    groundColor: 0x1b2a55,
    skyIntensity: 0.8,
    fogColor: 0x101a38,
    fogNear: 190,
    fogFar: 520,
    cameraLightIntensity: 0.35,
  },
}

/** Cool white: shows the night woodland without tinting it. */
const CAMERA_LIGHT_COLOR = 0xdfe8ff
/** Share of the remaining difference closed per second. */
const FADE_RATE_PER_SECOND = 2.2
/** Nearer than this to its place (world units), the sun counts as arrived. */
const SUN_SETTLED_DISTANCE = 0.05
const SHADOW_MAP_SIZE_PIXELS = 4096
const SHADOW_AREA_HALF_SIZE = 95
const SHADOW_CAMERA_FAR = 320
const SHADOW_BIAS = -0.0006
const SHADOW_NORMAL_BIAS = 0.05

export function timeOfDayForPhase(phase: string | null): TimeOfDay {
  if (phase === 'birdsong' || phase === 'evening') {
    return phase
  }
  // Setup and anything else plays under plain daylight.
  return 'daylight'
}

/** The sky, the sun and the fog of the scene, with their dimmer. */
export function createDaylightRig(initialTimeOfDay: TimeOfDay): DaylightRig {
  const initial: LightingPreset = LIGHTING_PRESETS[initialTimeOfDay]
  const sky: HemisphereLight = new HemisphereLight(
    initial.skyColor,
    initial.groundColor,
    initial.skyIntensity,
  )
  const sun: DirectionalLight = new DirectionalLight(
    initial.sunColor,
    initial.sunIntensity,
  )
  sun.position.set(
    initial.sunPosition.x,
    initial.sunPosition.y,
    initial.sunPosition.z,
  )
  sun.castShadow = true
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE_PIXELS, SHADOW_MAP_SIZE_PIXELS)
  sun.shadow.camera.left = -SHADOW_AREA_HALF_SIZE
  sun.shadow.camera.right = SHADOW_AREA_HALF_SIZE
  sun.shadow.camera.top = SHADOW_AREA_HALF_SIZE
  sun.shadow.camera.bottom = -SHADOW_AREA_HALF_SIZE
  sun.shadow.camera.far = SHADOW_CAMERA_FAR
  sun.shadow.bias = SHADOW_BIAS
  sun.shadow.normalBias = SHADOW_NORMAL_BIAS
  // No shadows: it lights what the viewer looks at, whatever stands there.
  const cameraLight: DirectionalLight = new DirectionalLight(
    CAMERA_LIGHT_COLOR,
    initial.cameraLightIntensity,
  )
  const fog: Fog = new Fog(initial.fogColor, initial.fogNear, initial.fogFar)
  const backdrop: Color = new Color(initial.fogColor)

  let target: LightingPreset = initial
  const targetColor: Color = new Color()
  const targetSunPosition: Vector3 = new Vector3()

  return {
    lights: [sky, sun, cameraLight],
    fog,
    backdrop,
    followCamera: (cameraPosition: Vector3, lookedAt: Vector3): void => {
      cameraLight.position.copy(cameraPosition)
      cameraLight.target.position.copy(lookedAt)
      // The target is not in the scene, so nothing else updates it.
      cameraLight.target.updateMatrixWorld()
    },
    setTimeOfDay: (timeOfDay: TimeOfDay): void => {
      target = LIGHTING_PRESETS[timeOfDay]
    },
    update: (deltaSeconds: number): void => {
      const step: number = Math.min(FADE_RATE_PER_SECOND * deltaSeconds, 1)
      sun.color.lerp(targetColor.set(target.sunColor), step)
      sun.intensity = MathUtils.lerp(sun.intensity, target.sunIntensity, step)
      sun.position.lerp(
        targetSunPosition.set(
          target.sunPosition.x,
          target.sunPosition.y,
          target.sunPosition.z,
        ),
        step,
      )
      sky.color.lerp(targetColor.set(target.skyColor), step)
      sky.groundColor.lerp(targetColor.set(target.groundColor), step)
      sky.intensity = MathUtils.lerp(sky.intensity, target.skyIntensity, step)
      fog.color.lerp(targetColor.set(target.fogColor), step)
      fog.near = MathUtils.lerp(fog.near, target.fogNear, step)
      fog.far = MathUtils.lerp(fog.far, target.fogFar, step)
      backdrop.copy(fog.color)
      cameraLight.intensity = MathUtils.lerp(
        cameraLight.intensity,
        target.cameraLightIntensity,
        step,
      )
    },
    isSunMoving: (): boolean =>
      sun.position.distanceTo(
        targetSunPosition.set(
          target.sunPosition.x,
          target.sunPosition.y,
          target.sunPosition.z,
        ),
      ) > SUN_SETTLED_DISTANCE,
  }
}
