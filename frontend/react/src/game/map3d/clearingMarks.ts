import {
  AdditiveBlending,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  type BufferGeometry,
  type CanvasTexture,
} from 'three'
import type { ClearingGround } from '#game/map3d/mapTerrain.ts'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'
import {
  createDashRingTexture,
  createLightRayTexture,
  createRadialFadeTexture,
  createRisingSparks,
  createSparkTexture,
  MARK_SPAN_RATIO,
  MINIMUM_VISIBLE_GLOW,
  type DashRing,
  type MarkFrame,
  type RisingSparks,
} from '#game/map3d/markParts.ts'

/**
 * Marks of the clearings.
 * - Who rules: a line of the ruler's colour on the rim and a faint tint of
 *   it on the soil; out of daylight the line glows.
 * - Can be picked: instead, six dashes turn round the rim and glide in and
 *   out; out of daylight they glow and send up rays and sparks.
 */
export type ClearingRingStyle = {
  /** 0xRRGGBB. */
  color: number
  opacity: number
  highlighted: boolean
}

export type ClearingMarks = {
  group: Group
  setStyles: (styles: ReadonlyMap<number, ClearingRingStyle>) => void
  /** Call once per frame. */
  update: (frame: MarkFrame) => void
}

const QUARTER_TURN_RADIANS = Math.PI / 2
const FULL_TURN_RADIANS = Math.PI * 2
const CIRCLE_SEGMENT_COUNT = 72

/** Just above the board, each layer a hair higher, so nothing flickers. */
const SOIL_TINT_HEIGHT = 0.05
const RULER_GLOW_HEIGHT = 0.055
const RULER_LINE_HEIGHT = 0.06
const DASH_GLOW_HEIGHT = 0.065
const DASH_HEIGHT = 0.07

/** All sizes below are in clearing radii. */
const RULER_LINE_INNER_RADIUS_RATIO = 0.955
const RULER_LINE_OUTER_RADIUS_RATIO = 1.005
const RULER_LINE_RADIUS_RATIO = 0.98
const RULER_GLOW_HALF_WIDTH_RATIO = 0.12
/** Share of the ruler line's opacity its glow gets. */
const RULER_GLOW_OPACITY_SHARE = 0.55
/** The tint is nothing in the middle and strongest against the rim. */
const SOIL_TINT_MIDWAY_OFFSET = 0.6
const SOIL_TINT_MIDWAY_OPACITY = 0.08
const SOIL_TINT_RIM_OPACITY = 0.34

const PICK_DASHES: DashRing = {
  dashCount: 6,
  litShare: 0.62,
  radiusRatio: 1.07,
  widthRatio: 0.09,
}
const DASH_GLOW_WIDTH_RATIO = 0.144
const DASH_GLOW_BLUR_RATIO = 0.03
const DASH_GLOW_OPACITY = 0.55
/** Negative: the dashes turn clockwise seen from above. */
const DASH_TURN_RADIANS_PER_SECOND = -0.5
const DASH_GLIDE_AMOUNT = 0.04
const DASH_GLIDE_PERIOD_SECONDS = 3.5

const RAY_HEIGHT_RATIO = 0.37
const RAY_OPACITY = 0.35
const RAY_BREATH_RADIANS_PER_SECOND = 2.4
/** The rays stand a little taller and brighter at the top of a breath. */
const RAY_LOWEST_HEIGHT_SHARE = 0.85
const RAY_HEIGHT_BREATH_SHARE = 0.25
const RAY_LOWEST_OPACITY_SHARE = 0.7
const RAY_OPACITY_BREATH_SHARE = 0.5

const SPARK_COUNT = 16
const SPARK_SEED = 21
const SPARK_SIZE = 0.35
const SPARK_RISE_RATIO = 0.85
const SPARK_SWAY_RATIO = 0.027

const HALF = 0.5
const UNLIT_COLOR = 0xffffff

type RulerMark = {
  group: Group
  lineMaterial: MeshBasicMaterial
  tintMaterial: MeshBasicMaterial
  glowMaterial: MeshBasicMaterial
  glow: Mesh
  /** Opacity of the line, as last styled. */
  opacity: number
}

type PickMark = {
  group: Group
  radius: number
  rays: Mesh
}

type ClearingMark = {
  ruler: RulerMark
  pick: PickMark
}

type MarkTextures = {
  soilTint: CanvasTexture
  rulerGlow: CanvasTexture
}

type PickParts = {
  dashMaterial: MeshBasicMaterial
  glowMaterial: MeshBasicMaterial
  rayMaterial: MeshBasicMaterial
  sparkMaterial: PointsMaterial
  markGeometry: BufferGeometry
  rayGeometry: BufferGeometry
  sparks: RisingSparks
}

function createFlatMaterial(texture: CanvasTexture | null): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: UNLIT_COLOR,
    map: texture,
    transparent: true,
    depthWrite: false,
  })
}

function layFlat(mesh: Mesh, height: number): Mesh {
  mesh.rotateX(-QUARTER_TURN_RADIANS)
  mesh.position.setY(height)
  return mesh
}

/** A group on a clearing, one unit of it = one clearing radius. */
function createClearingGroup(clearing: ClearingGround): Group {
  const group: Group = new Group()
  group.position.set(clearing.center.x, 0, clearing.center.z)
  group.scale.set(clearing.radius, 1, clearing.radius)
  return group
}

/** A glow that peaks on the ruler line and is gone a little to each side. */
function createRulerGlowTexture(): CanvasTexture {
  const peak: number = RULER_LINE_RADIUS_RATIO / MARK_SPAN_RATIO
  const halfWidth: number = RULER_GLOW_HALF_WIDTH_RATIO / MARK_SPAN_RATIO
  return createRadialFadeTexture([
    { offset: peak - halfWidth, opacity: 0 },
    { offset: peak, opacity: 1 },
    { offset: peak + halfWidth, opacity: 0 },
  ])
}

function createRulerMark(
  clearing: ClearingGround,
  textures: MarkTextures,
): RulerMark {
  const lineMaterial: MeshBasicMaterial = createFlatMaterial(null)
  const tintMaterial: MeshBasicMaterial = createFlatMaterial(textures.soilTint)
  const glowMaterial: MeshBasicMaterial = createFlatMaterial(textures.rulerGlow)
  const markSide: number = MARK_SPAN_RATIO * 2
  const glow: Mesh = layFlat(
    new Mesh(new PlaneGeometry(markSide, markSide), glowMaterial),
    RULER_GLOW_HEIGHT,
  )
  const group: Group = createClearingGroup(clearing)
  group.add(
    layFlat(
      new Mesh(new CircleGeometry(1, CIRCLE_SEGMENT_COUNT), tintMaterial),
      SOIL_TINT_HEIGHT,
    ),
    glow,
    layFlat(
      new Mesh(
        new RingGeometry(
          RULER_LINE_INNER_RADIUS_RATIO,
          RULER_LINE_OUTER_RADIUS_RATIO,
          CIRCLE_SEGMENT_COUNT,
        ),
        lineMaterial,
      ),
      RULER_LINE_HEIGHT,
    ),
  )
  return { group, lineMaterial, tintMaterial, glowMaterial, glow, opacity: 0 }
}

/** Where one spark rises from: somewhere along one of the dashes. */
function placeSparkOnDash(random: () => number): MapGroundPoint {
  const stepRadians: number = FULL_TURN_RADIANS / PICK_DASHES.dashCount
  const angle: number =
    Math.floor(random() * PICK_DASHES.dashCount) * stepRadians +
    random() * stepRadians * PICK_DASHES.litShare
  return {
    x: Math.cos(angle) * PICK_DASHES.radiusRatio,
    z: Math.sin(angle) * PICK_DASHES.radiusRatio,
  }
}

/** What every pickable clearing shares: one colour, one set of textures. */
function createPickParts(): PickParts {
  const rayTexture: CanvasTexture = createLightRayTexture({
    litShare: PICK_DASHES.litShare,
    // A cylinder is wrapped from the south, a quarter turn on from where
    // the dashes are drawn from: its lit parts end that much later.
    litEndShare: (PICK_DASHES.dashCount * (QUARTER_TURN_RADIANS / FULL_TURN_RADIANS)) % 1,
  })
  rayTexture.repeat.x = PICK_DASHES.dashCount
  const rayMaterial: MeshBasicMaterial = createFlatMaterial(rayTexture)
  rayMaterial.side = DoubleSide
  const markSide: number = MARK_SPAN_RATIO * 2
  const rayGeometry: BufferGeometry = new CylinderGeometry(
    PICK_DASHES.radiusRatio,
    PICK_DASHES.radiusRatio,
    1,
    CIRCLE_SEGMENT_COUNT,
    1,
    true,
  )
  // Stand it on the ground, so it grows upward when stretched.
  rayGeometry.translate(0, HALF, 0)
  return {
    dashMaterial: createFlatMaterial(
      createDashRingTexture({ ring: PICK_DASHES, opacity: 1, blurRatio: 0 }),
    ),
    glowMaterial: createFlatMaterial(
      createDashRingTexture({
        ring: { ...PICK_DASHES, widthRatio: DASH_GLOW_WIDTH_RATIO },
        opacity: 1,
        blurRatio: DASH_GLOW_BLUR_RATIO,
      }),
    ),
    rayMaterial,
    sparkMaterial: new PointsMaterial({
      color: UNLIT_COLOR,
      map: createSparkTexture(),
      size: SPARK_SIZE,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
    markGeometry: new PlaneGeometry(markSide, markSide),
    rayGeometry,
    sparks: createRisingSparks({
      sparkCount: SPARK_COUNT,
      seed: SPARK_SEED,
      place: placeSparkOnDash,
      swayDistance: SPARK_SWAY_RATIO,
    }),
  }
}

function createPickMark(clearing: ClearingGround, parts: PickParts): PickMark {
  const rays: Mesh = new Mesh(parts.rayGeometry, parts.rayMaterial)
  const sparks: Points = new Points(parts.sparks.geometry, parts.sparkMaterial)
  sparks.scale.y = clearing.radius * SPARK_RISE_RATIO
  // The sparks move every frame: their first bounds would cull them wrongly.
  sparks.frustumCulled = false
  const group: Group = createClearingGroup(clearing)
  group.add(
    layFlat(new Mesh(parts.markGeometry, parts.glowMaterial), DASH_GLOW_HEIGHT),
    layFlat(new Mesh(parts.markGeometry, parts.dashMaterial), DASH_HEIGHT),
    rays,
    sparks,
  )
  group.visible = false
  return { group, radius: clearing.radius, rays }
}

export function createClearingMarks(
  clearings: readonly ClearingGround[],
): ClearingMarks {
  const group: Group = new Group()
  const textures: MarkTextures = {
    soilTint: createRadialFadeTexture([
      { offset: 0, opacity: 0 },
      { offset: SOIL_TINT_MIDWAY_OFFSET, opacity: SOIL_TINT_MIDWAY_OPACITY },
      { offset: 1, opacity: SOIL_TINT_RIM_OPACITY },
    ]),
    rulerGlow: createRulerGlowTexture(),
  }
  const pickParts: PickParts = createPickParts()
  const marks: Map<number, ClearingMark> = new Map<number, ClearingMark>()
  for (const clearing of clearings) {
    const mark: ClearingMark = {
      ruler: createRulerMark(clearing, textures),
      pick: createPickMark(clearing, pickParts),
    }
    marks.set(clearing.clearingId, mark)
    group.add(mark.ruler.group, mark.pick.group)
  }

  return {
    group,
    setStyles: (styles: ReadonlyMap<number, ClearingRingStyle>): void => {
      for (const [clearingId, mark] of marks) {
        const style: ClearingRingStyle | undefined = styles.get(clearingId)
        const highlighted: boolean = style?.highlighted === true
        mark.ruler.group.visible = style !== undefined && !highlighted
        mark.pick.group.visible = highlighted
        if (style === undefined) {
          continue
        }
        if (highlighted) {
          // Every clearing to pick is asked of the same player: one colour.
          pickParts.dashMaterial.color.set(style.color)
          pickParts.glowMaterial.color.set(style.color)
          pickParts.rayMaterial.color.set(style.color)
          pickParts.sparkMaterial.color.set(style.color)
        } else {
          mark.ruler.opacity = style.opacity
          mark.ruler.lineMaterial.color.set(style.color)
          mark.ruler.lineMaterial.opacity = style.opacity
          mark.ruler.tintMaterial.color.set(style.color)
          mark.ruler.tintMaterial.opacity = style.opacity
          mark.ruler.glowMaterial.color.set(style.color)
        }
      }
    },
    update: (frame: MarkFrame): void => {
      const glowing: boolean = frame.glowLevel > MINIMUM_VISIBLE_GLOW
      const breath: number =
        HALF +
        HALF * Math.sin(frame.elapsedSeconds * RAY_BREATH_RADIANS_PER_SECOND)
      const glide: number =
        1 +
        DASH_GLIDE_AMOUNT *
          Math.sin(
            (frame.elapsedSeconds * FULL_TURN_RADIANS) /
              DASH_GLIDE_PERIOD_SECONDS,
          )
      pickParts.glowMaterial.opacity = DASH_GLOW_OPACITY * frame.glowLevel
      pickParts.rayMaterial.opacity =
        RAY_OPACITY *
        (RAY_LOWEST_OPACITY_SHARE + RAY_OPACITY_BREATH_SHARE * breath) *
        frame.glowLevel
      pickParts.sparkMaterial.opacity = frame.glowLevel
      pickParts.glowMaterial.visible = glowing
      pickParts.rayMaterial.visible = glowing
      pickParts.sparkMaterial.visible = glowing
      pickParts.sparks.update(frame.elapsedSeconds)
      for (const mark of marks.values()) {
        mark.ruler.glow.visible = glowing
        mark.ruler.glowMaterial.opacity =
          mark.ruler.opacity * RULER_GLOW_OPACITY_SHARE * frame.glowLevel
        if (mark.pick.group.visible) {
          const reach: number = mark.pick.radius * glide
          mark.pick.group.rotation.y =
            frame.elapsedSeconds * DASH_TURN_RADIANS_PER_SECOND
          mark.pick.group.scale.set(reach, 1, reach)
          mark.pick.rays.scale.y =
            mark.pick.radius *
            RAY_HEIGHT_RATIO *
            (RAY_LOWEST_HEIGHT_SHARE + RAY_HEIGHT_BREATH_SHARE * breath)
        }
      }
    },
  }
}
