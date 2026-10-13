import {
  MeshStandardMaterial,
  Vector3,
  type MeshStandardMaterialParameters,
} from 'three'
import type { MapGroundPoint } from '#game/map3d/mapWorldSpace.ts'

/**
 * Sightlines through the trees: between the camera and every Vagabond pawn
 * standing in a forest runs a tube in which the trees are not drawn, so a
 * tree never hides the pawn. Trees outside the tubes, and behind the pawns,
 * stay whole.
 */
export type TreeSightlines = {
  /** A tree material that leaves the tubes open. */
  createMaterial: (
    parameters: MeshStandardMaterialParameters,
  ) => MeshStandardMaterial
  /** The pieces to keep in sight (the others' tubes close). */
  setTargets: (grounds: readonly MapGroundPoint[]) => void
}

/** Tubes the shader can hold; pieces standing together share one. */
const MAXIMUM_SIGHTLINE_COUNT = 48
/** Pieces nearer than this to a kept one are seen through its tube. */
const SHARED_TUBE_DISTANCE = 1.2
/** A tube aims at the middle of a piece, this far above the ground. */
const SIGHT_TARGET_HEIGHT = 0.8
/** Inside the inner radius no tree is drawn; it is whole past the outer. */
const TUBE_INNER_RADIUS = 1.3
const TUBE_OUTER_RADIUS = 2.3
/** A tube runs this far past its piece: a tree it stands in is opened too. */
const TUBE_PAST_TARGET = 0.9
const PROGRAM_CACHE_KEY = 'tree-sightlines'

const VERTEX_DECLARATIONS = `
varying vec3 sightlineWorldPosition;
`
const VERTEX_WORLD_POSITION = `
vec4 sightlinePosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  sightlinePosition = instanceMatrix * sightlinePosition;
#endif
sightlineWorldPosition = (modelMatrix * sightlinePosition).xyz;
`
const FRAGMENT_DECLARATIONS = `
uniform vec3 sightlineTargets[${String(MAXIMUM_SIGHTLINE_COUNT)}];
uniform int sightlineCount;
varying vec3 sightlineWorldPosition;
`
/**
 * The edge of a tube is dithered: more and more pixels of a tree are dropped
 * towards the middle, which reads as a soft edge without any blending.
 */
const FRAGMENT_OPEN_TUBES = `
float sightlineDither = fract(
  52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))
);
vec3 sightlineFromCamera = sightlineWorldPosition - cameraPosition;
for (int index = 0; index < ${String(MAXIMUM_SIGHTLINE_COUNT)}; index++) {
  if (index >= sightlineCount) {
    break;
  }
  vec3 toTarget = sightlineTargets[index] - cameraPosition;
  float reach = length(toTarget);
  float along = dot(sightlineFromCamera, toTarget) / reach;
  if (along > 0.0 && along < reach + ${TUBE_PAST_TARGET.toFixed(2)}) {
    float away = length(sightlineFromCamera - toTarget * (along / reach));
    float open = 1.0 - smoothstep(
      ${TUBE_INNER_RADIUS.toFixed(2)},
      ${TUBE_OUTER_RADIUS.toFixed(2)},
      away
    );
    if (open > sightlineDither) {
      discard;
    }
  }
}
`

/** One target per group of pieces standing together, up to the maximum. */
function sharedTargets(grounds: readonly MapGroundPoint[]): MapGroundPoint[] {
  return grounds
    .reduce(
      (kept: MapGroundPoint[], ground: MapGroundPoint): MapGroundPoint[] =>
        kept.some(
          (other: MapGroundPoint): boolean =>
            Math.hypot(other.x - ground.x, other.z - ground.z) <
            SHARED_TUBE_DISTANCE,
        )
          ? kept
          : [...kept, ground],
      [],
    )
    .slice(0, MAXIMUM_SIGHTLINE_COUNT)
}

export function createTreeSightlines(): TreeSightlines {
  const targets: Vector3[] = Array.from(
    { length: MAXIMUM_SIGHTLINE_COUNT },
    (): Vector3 => new Vector3(),
  )
  const uniforms: {
    sightlineTargets: { value: Vector3[] }
    sightlineCount: { value: number }
  } = {
    sightlineTargets: { value: targets },
    sightlineCount: { value: 0 },
  }

  return {
    createMaterial: (
      parameters: MeshStandardMaterialParameters,
    ): MeshStandardMaterial => {
      const material: MeshStandardMaterial = new MeshStandardMaterial(
        parameters,
      )
      // three.js hands the shader over to be edited in place.
      material.onBeforeCompile = (shader): void => {
        Object.assign(shader.uniforms, uniforms)
        Object.assign(shader, {
          vertexShader: shader.vertexShader
            .replace(
              '#include <common>',
              `#include <common>${VERTEX_DECLARATIONS}`,
            )
            .replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>${VERTEX_WORLD_POSITION}`,
            ),
          fragmentShader: shader.fragmentShader
            .replace(
              '#include <common>',
              `#include <common>${FRAGMENT_DECLARATIONS}`,
            )
            .replace(
              '#include <clipping_planes_fragment>',
              `${FRAGMENT_OPEN_TUBES}#include <clipping_planes_fragment>`,
            ),
        })
      }
      material.customProgramCacheKey = (): string => PROGRAM_CACHE_KEY
      return material
    },
    setTargets: (grounds: readonly MapGroundPoint[]): void => {
      const shared: MapGroundPoint[] = sharedTargets(grounds)
      shared.forEach((ground: MapGroundPoint, index: number): void => {
        targets[index]?.set(ground.x, SIGHT_TARGET_HEIGHT, ground.z)
      })
      uniforms.sightlineCount.value = shared.length
    },
  }
}
