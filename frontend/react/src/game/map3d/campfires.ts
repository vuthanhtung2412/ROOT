import {
  Box3,
  ConeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  Vector3,
} from 'three'
import {
  createCampfireEmbers,
  type CampfireEmbers,
} from '#game/map3d/campfireEmbers.ts'
import type { TimeOfDay } from '#game/map3d/daylight.ts'
import type { ClearingGround } from '#game/map3d/mapTerrain.ts'
import {
  groundDistance,
  type MapGroundPoint,
} from '#game/map3d/mapWorldSpace.ts'
import { meshesOf } from '#game/map3d/sceneObjects.ts'

/**
 * A small campfire in every clearing, on the spot furthest from its building
 * slots and armies. In the evening the flames
 * go up, throw sparks and light the clearing; at birdsong and in daylight
 * they go down and only the logs in their ring of stones are left.
 */
export type CampfireSite = {
  clearing: ClearingGround
  /** Its building slots and where its armies stand: the fire keeps away. */
  occupied: readonly MapGroundPoint[]
}

export type CampfiresInput = {
  /** Logs in a ring of stones, without flames. */
  model: Group
  sites: readonly CampfireSite[]
  /** The river as a dense line of points, source to mouth. */
  river: readonly MapGroundPoint[]
  timeOfDay: TimeOfDay
}

export type Campfires = {
  group: Group
  /** Let the fires go up or down for a phase of the turn. */
  setTimeOfDay: (timeOfDay: TimeOfDay) => void
  /** Advance the flames; call once per frame. */
  update: (deltaSeconds: number) => void
  dispose: () => void
}

/** How high the fires burn: 0 = out, 1 = full. */
const BURN_LEVEL_BY_TIME_OF_DAY: Readonly<Record<TimeOfDay, number>> = {
  birdsong: 0,
  daylight: 0,
  evening: 1,
}
/** Share of the remaining difference closed per second, like the daylight. */
const BURN_FADE_RATE_PER_SECOND = 2.2
/** Below this the flames are not drawn at all. */
const BURN_LEVEL_HIDDEN_BELOW = 0.02

/** Ring of stones, side to side, world units. */
const CAMPFIRE_WIDTH = 1.5
/** The flames stand on the logs, this far above the ground. */
const FLAME_FOOT_HEIGHT = 0.16
const OUTER_FLAME_RADIUS = 0.38
const OUTER_FLAME_HEIGHT = 1.3
const OUTER_FLAME_COLOR = 0xff7a1c
const OUTER_FLAME_OPACITY = 0.6
const INNER_FLAME_RADIUS = 0.2
const INNER_FLAME_HEIGHT = 0.8
const INNER_FLAME_COLOR = 0xffd866
const FLAME_RADIAL_SEGMENTS = 7

/** Firelight: warm, so a clearing shows its own colours in the blue night. */
const FIRELIGHT_COLOR = 0xffd9a8
const FIRELIGHT_INTENSITY = 16
const FIRELIGHT_HEIGHT = 4
/** Past this distance from its fire the forest gets none of its light. */
const FIRELIGHT_REACH = 20
/** Gentler than a real fire's fall-off, so the whole clearing is lit. */
const FIRELIGHT_DECAY = 1

/** The flames waver: two waves out of step, a different beat per fire. */
const FLICKER_SLOW_FREQUENCY = 5.3
const FLICKER_FAST_FREQUENCY = 12.7
const FLICKER_SLOW_AMOUNT = 0.1
const FLICKER_FAST_AMOUNT = 0.06
const FLICKER_PHASE_STEP = 1.7
/** The light wavers less than the flames, or the whole clearing would blink. */
const FIRELIGHT_FLICKER_SHARE = 0.5

/** Centre of a fire to the middle of the river: half the water, half a fire. */
const RIVER_CLEARANCE = 2
/** A fire stays this near the middle of its clearing (ratio of radius). */
const FIRE_REACH_RATIO = 0.7
/** Grid the dry spots are searched on. */
const SEARCH_STEP = 0.3
const HALF = 0.5

type Campfire = {
  flames: Group
  light: PointLight
  flickerPhase: number
}

type CampfireParts = {
  outerFlameGeometry: ConeGeometry
  outerFlameMaterial: MeshBasicMaterial
  innerFlameGeometry: ConeGeometry
  innerFlameMaterial: MeshBasicMaterial
}

function isDry(
  ground: MapGroundPoint,
  river: readonly MapGroundPoint[],
): boolean {
  return river.every(
    (point: MapGroundPoint): boolean =>
      groundDistance(ground, point) >= RIVER_CLEARANCE,
  )
}

/** How far a spot is from the nearest building slot or army. */
function roomAround(
  ground: MapGroundPoint,
  occupied: readonly MapGroundPoint[],
): number {
  return occupied.reduce(
    (room: number, taken: MapGroundPoint): number =>
      Math.min(room, groundDistance(ground, taken)),
    Number.POSITIVE_INFINITY,
  )
}

/**
 * The dry spot of the clearing with the most room around it: as far as can
 * be from the building slots and from where the armies stand.
 */
function campfireGround(
  site: CampfireSite,
  river: readonly MapGroundPoint[],
): MapGroundPoint {
  const { clearing, occupied } = site
  const reach: number = clearing.radius * FIRE_REACH_RATIO
  const stepCount: number = Math.floor(reach / SEARCH_STEP)
  let roomiest: MapGroundPoint = clearing.center
  let mostRoom: number = Number.NEGATIVE_INFINITY
  for (let stepX = -stepCount; stepX <= stepCount; stepX += 1) {
    for (let stepZ = -stepCount; stepZ <= stepCount; stepZ += 1) {
      const ground: MapGroundPoint = {
        x: clearing.center.x + stepX * SEARCH_STEP,
        z: clearing.center.z + stepZ * SEARCH_STEP,
      }
      const room: number = roomAround(ground, occupied)
      if (
        groundDistance(ground, clearing.center) <= reach &&
        room > mostRoom &&
        isDry(ground, river)
      ) {
        roomiest = ground
        mostRoom = room
      }
    }
  }
  return roomiest
}

function createCampfireParts(): CampfireParts {
  return {
    outerFlameGeometry: new ConeGeometry(
      OUTER_FLAME_RADIUS,
      OUTER_FLAME_HEIGHT,
      FLAME_RADIAL_SEGMENTS,
    ),
    // See-through, so the bright core shows inside it.
    outerFlameMaterial: new MeshBasicMaterial({
      color: OUTER_FLAME_COLOR,
      transparent: true,
      opacity: OUTER_FLAME_OPACITY,
      depthWrite: false,
    }),
    innerFlameGeometry: new ConeGeometry(
      INNER_FLAME_RADIUS,
      INNER_FLAME_HEIGHT,
      FLAME_RADIAL_SEGMENTS,
    ),
    innerFlameMaterial: new MeshBasicMaterial({ color: INNER_FLAME_COLOR }),
  }
}

/** The model at its size in the woodland, standing on the ground. */
function createHearth(model: Group): Group {
  const bounds: Box3 = new Box3().setFromObject(model)
  const size: Vector3 = bounds.getSize(new Vector3())
  const scale: number = CAMPFIRE_WIDTH / Math.max(size.x, size.z)
  const stonesAndLogs: Group = model.clone()
  stonesAndLogs.position.y = -bounds.min.y
  for (const mesh of meshesOf(stonesAndLogs)) {
    mesh.castShadow = true
    mesh.receiveShadow = true
  }
  // Scale lives on a wrapper group so the lift stays in model units.
  const hearth: Group = new Group()
  hearth.scale.setScalar(scale)
  hearth.add(stonesAndLogs)
  return hearth
}

/** Two cones standing on the logs; the group is scaled from its foot. */
function createFlames(parts: CampfireParts): Group {
  const outerFlame: Mesh = new Mesh(
    parts.outerFlameGeometry,
    parts.outerFlameMaterial,
  )
  outerFlame.position.y = OUTER_FLAME_HEIGHT * HALF
  const innerFlame: Mesh = new Mesh(
    parts.innerFlameGeometry,
    parts.innerFlameMaterial,
  )
  innerFlame.position.y = INNER_FLAME_HEIGHT * HALF
  const flames: Group = new Group()
  flames.position.y = FLAME_FOOT_HEIGHT
  flames.add(outerFlame, innerFlame)
  return flames
}

export function createCampfires(input: CampfiresInput): Campfires {
  const group: Group = new Group()
  const parts: CampfireParts = createCampfireParts()
  const grounds: MapGroundPoint[] = input.sites.map(
    (site: CampfireSite): MapGroundPoint => campfireGround(site, input.river),
  )
  const campfires: Campfire[] = grounds.map(
    (ground: MapGroundPoint, index: number): Campfire => {
      const flames: Group = createFlames(parts)
      const light: PointLight = new PointLight(
        FIRELIGHT_COLOR,
        0,
        FIRELIGHT_REACH,
        FIRELIGHT_DECAY,
      )
      light.position.y = FIRELIGHT_HEIGHT
      const campfire: Group = new Group()
      campfire.position.set(ground.x, 0, ground.z)
      campfire.add(createHearth(input.model), flames, light)
      group.add(campfire)
      return { flames, light, flickerPhase: index * FLICKER_PHASE_STEP }
    },
  )
  const embers: CampfireEmbers = createCampfireEmbers(grounds)
  group.add(embers.points)

  let burnLevel: number = BURN_LEVEL_BY_TIME_OF_DAY[input.timeOfDay]
  let targetBurnLevel: number = burnLevel
  let elapsedSeconds = 0

  return {
    group,
    setTimeOfDay: (timeOfDay: TimeOfDay): void => {
      targetBurnLevel = BURN_LEVEL_BY_TIME_OF_DAY[timeOfDay]
    },
    update: (deltaSeconds: number): void => {
      elapsedSeconds += deltaSeconds
      burnLevel = MathUtils.lerp(
        burnLevel,
        targetBurnLevel,
        Math.min(BURN_FADE_RATE_PER_SECOND * deltaSeconds, 1),
      )
      for (const campfire of campfires) {
        const flicker: number =
          Math.sin(
            elapsedSeconds * FLICKER_SLOW_FREQUENCY + campfire.flickerPhase,
          ) *
            FLICKER_SLOW_AMOUNT +
          Math.sin(
            elapsedSeconds * FLICKER_FAST_FREQUENCY + campfire.flickerPhase,
          ) *
            FLICKER_FAST_AMOUNT
        campfire.flames.visible = burnLevel > BURN_LEVEL_HIDDEN_BELOW
        campfire.flames.scale.set(
          burnLevel,
          burnLevel * (1 + flicker),
          burnLevel,
        )
        // A light that is out is still worked out for every pixel it could
        // reach: take it out of the scene until the fire burns.
        campfire.light.visible = burnLevel > BURN_LEVEL_HIDDEN_BELOW
        campfire.light.intensity =
          FIRELIGHT_INTENSITY *
          burnLevel *
          (1 + flicker * FIRELIGHT_FLICKER_SHARE)
      }
      embers.points.visible = burnLevel > BURN_LEVEL_HIDDEN_BELOW
      embers.update(elapsedSeconds, burnLevel)
    },
    dispose: (): void => {
      embers.dispose()
      parts.outerFlameGeometry.dispose()
      parts.outerFlameMaterial.dispose()
      parts.innerFlameGeometry.dispose()
      parts.innerFlameMaterial.dispose()
    },
  }
}
