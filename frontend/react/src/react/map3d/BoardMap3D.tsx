import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react'
import type { BoardEffectBatch } from '#game/boardEffects.ts'
import { FALL_BOARD_LAYOUT, type BoardLayout } from '#game/boardLayout.ts'
import { GAME_LOGICAL_HEIGHT, GAME_LOGICAL_WIDTH } from '#game/hiDpi.ts'
import type {
  ClearingRingStyle,
  ForestGround,
} from '#game/map3d/groundMarkers.ts'
import type { MapScene, MapViewPoint } from '#game/map3d/mapScene.ts'
import type { ClearingGround } from '#game/map3d/mapTerrain.ts'
import type {
  MapGroundPoint,
  MapViewFrame,
} from '#game/map3d/mapWorldSpace.ts'
import { getHudSnapshot, subscribeHud } from '#game/hudStore.ts'
import { timeOfDayForPhase } from '#game/map3d/daylight.ts'
import { factionColorForSeat } from '#game/theme.ts'
import type { BoardMapProps } from '#react/BoardMap.tsx'
import { LABEL_FAR_HEIGHT, type MapPiece } from '#game/map3d/pieceMeshes.ts'
import {
  BoardEffectsLayer,
  type BoardEffectPosition,
  type BoardEffectStack,
} from '#react/BoardEffectsLayer.tsx'
import {
  builtPieceKeys,
  withoutBuildEffects,
} from '#react/map3d/buildEffects.ts'
import {
  averageGround,
  mapPiecesForBoard,
  stackPieceKey,
} from '#react/map3d/mapPieces.ts'
import {
  rememberPieceGrounds,
  type PieceGrounds,
} from '#react/map3d/stackGrounds.ts'
import { useMapScene, type MapSceneHandle } from '#react/map3d/useMapScene.ts'
import { usePieceModels } from '#react/map3d/usePieceModels.ts'
import {
  useTapOrDrag,
  type TapOrDragHandlers,
} from '#react/map3d/useTapOrDrag.ts'
import { useViewVersion } from '#react/map3d/useViewVersion.ts'
import {
  computeRulerByClearing,
  type ClearingHitCenter,
} from '#react/PieceStack.tsx'

/** Dashes of a clearing to pick, when nobody is known to be picking. */
const HIGHLIGHT_RING_COLOR = 0xe0b352
const NEUTRAL_RING_COLOR = 0xf0e6d3
const DIMMED_RING_OPACITY = 0.18
const RULER_RING_OPACITY = 0.95
/** The click target is a little smaller than the ring it sits on. */
const HIT_RADIUS_RATIO = 0.9
const HALF = 0.5

/** Themed sword over the woodland; finger over a clearing the player can pick. */
const MAP_CANVAS_CLASS_NAME =
  'map-3d-canvas pointer-events-auto absolute inset-0 z-0 block cursor-root-default touch-none'
const CLICKABLE_CLEARING_CLASS_NAME =
  'pointer-events-auto absolute z-4 m-0 cursor-root-pointer rounded-full border-0 bg-transparent p-0'
/** A clearing the player cannot pick: no finger, the gesture goes to the map. */
const IDLE_CLEARING_CLASS_NAME =
  'pointer-events-none absolute z-4 m-0 cursor-root-default rounded-full border-0 bg-transparent p-0'
const CLICKABLE_FOREST_CLASS_NAME =
  'pointer-events-auto absolute inset-0 z-5 m-0 cursor-root-pointer border-0 bg-transparent p-0'

/** A clearing as it shows up in the view right now. */
type ProjectedClearing = {
  clearingId: number
  center: MapViewPoint
  radius: number
}

/** Key of the map piece of the stack an effect names. */
function effectStackKey(stack: BoardEffectStack): string {
  return stackPieceKey({
    clearingId: stack.clearing,
    kind: stack.pieceKind,
    type: stack.pieceType,
    owner: stack.owner,
  })
}

/** The grounds remembered, and the pieces they were last read from. */
type RememberedGrounds = {
  pieces: readonly MapPiece[]
  grounds: PieceGrounds
}

function distanceBetween(left: MapViewPoint, right: MapViewPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function projectClearing(
  scene: MapScene,
  clearing: ClearingGround,
): ProjectedClearing {
  const center: MapViewPoint = scene.projectToView(clearing.center, 0)
  const eastRim: MapGroundPoint = {
    x: clearing.center.x + clearing.radius,
    z: clearing.center.z,
  }
  const southRim: MapGroundPoint = {
    x: clearing.center.x,
    z: clearing.center.z + clearing.radius,
  }
  const radius: number =
    (distanceBetween(center, scene.projectToView(eastRim, 0)) +
      distanceBetween(center, scene.projectToView(southRim, 0))) *
    HALF
  return {
    clearingId: clearing.clearingId,
    center,
    radius: radius * HIT_RADIUS_RATIO,
  }
}

function forestClipPath(scene: MapScene, forest: ForestGround): string {
  const points: string[] = forest.corners.map(
    (corner: MapGroundPoint): string => {
      const point: MapViewPoint = scene.projectToView(corner, 0)
      return `${String(point.x)}px ${String(point.y)}px`
    },
  )
  return `polygon(${points.join(', ')})`
}

/** Where the icon of a piece standing on that ground shows up in the view. */
function piecePosition(
  scene: MapScene,
  ground: MapGroundPoint,
): BoardEffectPosition {
  const point: MapViewPoint = scene.projectToView(ground, LABEL_FAR_HEIGHT)
  return { left: point.x, top: point.y }
}

export type BoardMap3DProps = BoardMapProps & {
  /**
   * The part of the view, in pixels, the playable woodland must fit: the
   * map fills the whole screen, the HUD covers its sides. Default: all of it.
   */
  focusWidth?: number
  focusHeight?: number
  /** Pixels the focus centre sits right of the view centre. */
  focusOffsetX?: number
}

/** The Autumn map as a 3D scene: same props and same hooks as `BoardMap`. */
export function BoardMap3D(props: BoardMap3DProps): JSX.Element {
  const layout: BoardLayout = props.layout ?? FALL_BOARD_LAYOUT
  const viewWidth: number = props.viewWidth ?? GAME_LOGICAL_WIDTH
  const viewHeight: number = props.viewHeight ?? GAME_LOGICAL_HEIGHT
  const focusWidth: number = props.focusWidth ?? viewWidth
  const focusHeight: number = props.focusHeight ?? viewHeight
  const focusOffsetX: number = props.focusOffsetX ?? 0
  const frame: MapViewFrame = useMemo(
    () => ({
      view: { width: viewWidth, height: viewHeight },
      focus: { width: focusWidth, height: focusHeight },
      focusOffsetX,
    }),
    [viewWidth, viewHeight, focusWidth, focusHeight, focusOffsetX],
  )
  // The light follows the phase of the turn shown in the banner.
  const phase: string | null = useSyncExternalStore(
    subscribeHud,
    (): string | null => getHudSnapshot().turnBanner.turn?.phase ?? null,
    (): string | null => getHudSnapshot().turnBanner.turn?.phase ?? null,
  )
  // A clearing to pick is marked in the colour of the player picking it.
  const pickingSeat: number | null = useSyncExternalStore(
    subscribeHud,
    (): number | null => getHudSnapshot().actionTray?.actorSeat ?? null,
    (): number | null => getHudSnapshot().actionTray?.actorSeat ?? null,
  )
  const canvasReference = useRef<HTMLCanvasElement | null>(null)
  const handle: MapSceneHandle = useMapScene(
    canvasReference,
    layout,
    frame,
    timeOfDayForPhase(phase),
  )
  const { scene, clearingGrounds, forestGrounds, river } = handle
  const viewVersion: number = useViewVersion(scene, props.effects)

  const highlighted: Set<number> = useMemo(
    () => new Set(props.highlightedClearingIds ?? []),
    [props.highlightedClearingIds],
  )
  const highlightedForests: Set<number> = useMemo(
    () => new Set(props.highlightedForestIndexes ?? []),
    [props.highlightedForestIndexes],
  )
  const { clearings, factions, forestPawns } = props

  const mapPieces: MapPiece[] = useMemo(
    () =>
      mapPiecesForBoard({
        clearings: clearings ?? [],
        factions: factions ?? [],
        clearingGrounds,
        forestGrounds,
        forestPawns: forestPawns ?? [],
        river,
      }),
    [clearings, factions, forestPawns, clearingGrounds, forestGrounds, river],
  )

  useEffect(() => {
    scene?.setPieces(mapPieces)
  }, [scene, mapPieces])
  usePieceModels(scene, mapPieces)

  const [remembered, setRemembered] = useState<RememberedGrounds>(
    (): RememberedGrounds => ({
      pieces: mapPieces,
      grounds: rememberPieceGrounds(new Map<string, MapGroundPoint>(), mapPieces),
    }),
  )
  // Brought up to date while rendering: an effect reads where its stacks
  // stand when it starts, and never again.
  if (remembered.pieces !== mapPieces) {
    setRemembered({
      pieces: mapPieces,
      grounds: rememberPieceGrounds(remembered.grounds, mapPieces),
    })
  }
  const pieceGrounds: PieceGrounds = remembered.grounds

  const effects: BoardEffectBatch | undefined = props.effects
  // A batch already there when the map mounts is old news: do not replay it.
  const playedBuildSequence = useRef<number | undefined>(effects?.sequence)
  useEffect(() => {
    if (
      effects === undefined ||
      effects.sequence === playedBuildSequence.current
    ) {
      return
    }
    playedBuildSequence.current = effects.sequence
    scene?.playBuild(builtPieceKeys(effects))
  }, [scene, effects])
  const flatEffects: BoardEffectBatch | undefined = useMemo(
    () => (effects === undefined ? undefined : withoutBuildEffects(effects)),
    [effects],
  )

  useEffect(() => {
    if (scene === null) {
      return
    }
    const clearingIds: number[] = clearingGrounds.map(
      (clearing: ClearingGround): number => clearing.clearingId,
    )
    const rulers: Map<number, number | null> =
      clearings === undefined || factions === undefined
        ? new Map<number, number | null>()
        : computeRulerByClearing(clearings, factions, clearingIds)
    const styles: Map<number, ClearingRingStyle> = new Map<
      number,
      ClearingRingStyle
    >()
    for (const clearingId of clearingIds) {
      const rulerSeat: number | null = rulers.get(clearingId) ?? null
      if (highlighted.has(clearingId)) {
        styles.set(clearingId, {
          color:
            pickingSeat !== null && factions !== undefined
              ? factionColorForSeat(pickingSeat, factions)
              : HIGHLIGHT_RING_COLOR,
          opacity: 1,
          highlighted: true,
        })
      } else if (rulerSeat === null || factions === undefined) {
        // Nobody rules it: no mark at all.
      } else if (highlighted.size > 0) {
        styles.set(clearingId, {
          color: NEUTRAL_RING_COLOR,
          opacity: DIMMED_RING_OPACITY,
          highlighted: false,
        })
      } else {
        styles.set(clearingId, {
          color: factionColorForSeat(rulerSeat, factions),
          opacity: RULER_RING_OPACITY,
          highlighted: false,
        })
      }
    }
    scene.setClearingRings(styles)
    scene.setHighlightedForests(highlightedForests)
  }, [
    scene,
    clearings,
    factions,
    clearingGrounds,
    highlighted,
    highlightedForests,
    pickingSeat,
  ])

  const projectedClearings: ProjectedClearing[] = useMemo(
    () =>
      scene === null
        ? []
        : clearingGrounds.map(
            (clearing: ClearingGround): ProjectedClearing =>
              projectClearing(scene, clearing),
          ),
    // viewVersion: the camera moved, so every projection is stale.
    [scene, clearingGrounds, viewVersion],
  )

  const hitCenters: Map<number, ClearingHitCenter> = useMemo(
    () =>
      new Map<number, ClearingHitCenter>(
        projectedClearings.map(
          (clearing: ProjectedClearing): [number, ClearingHitCenter] => [
            clearing.clearingId,
            {
              centerX: clearing.center.x,
              centerY: clearing.center.y,
              radius: clearing.radius,
            },
          ],
        ),
      ),
    [projectedClearings],
  )

  const forestCenters: Map<number, BoardEffectPosition> = useMemo(
    () =>
      new Map<number, BoardEffectPosition>(
        scene === null
          ? []
          : forestGrounds.map(
              (forest: ForestGround): [number, BoardEffectPosition] => [
                forest.forestIndex,
                // Where the pawn of that forest stands.
                piecePosition(scene, averageGround(forest.corners)),
              ],
            ),
      ),
    [scene, forestGrounds, viewVersion],
  )

  // An effect plays on the stack the scene draws, not on a flat-map slot.
  const stackPositionOf = useCallback(
    (stack: BoardEffectStack): BoardEffectPosition | undefined => {
      const ground: MapGroundPoint | undefined = pieceGrounds.get(
        effectStackKey(stack),
      )
      return scene === null || ground === undefined
        ? undefined
        : piecePosition(scene, ground)
    },
    // viewVersion: the camera moved, so every projection is stale.
    [scene, pieceGrounds, viewVersion],
  )
  const stackCountOf = useCallback(
    (stack: BoardEffectStack): number => {
      const key: string = effectStackKey(stack)
      return (
        mapPieces.find((piece: MapPiece): boolean => piece.key === key)
          ?.count ?? 0
      )
    },
    [mapPieces],
  )

  const onClearingSelected = props.onClearingSelected
  const onForestSelected = props.onForestSelected
  const tapOrDragHandlers: TapOrDragHandlers = useTapOrDrag()

  return (
    <div
      className="relative shrink-0 overflow-hidden pointer-events-none"
      style={{ width: viewWidth, height: viewHeight }}
      {...tapOrDragHandlers}
    >
      <canvas
        ref={canvasReference}
        className={MAP_CANVAS_CLASS_NAME}
      />
      {scene !== null
        ? forestGrounds.map((forest: ForestGround) =>
            highlightedForests.has(forest.forestIndex) ? (
              <button
                key={`forest-hit-${String(forest.forestIndex)}`}
                type="button"
                className={CLICKABLE_FOREST_CLASS_NAME}
                aria-label={`Forest ${String(forest.forestIndex)}`}
                onClick={() => {
                  onForestSelected?.(forest.forestIndex)
                }}
                style={{ clipPath: forestClipPath(scene, forest) }}
              />
            ) : null,
          )
        : null}
      {flatEffects !== undefined && factions !== undefined ? (
        <BoardEffectsLayer
          batch={flatEffects}
          factions={factions}
          hitCenters={hitCenters}
          forestCenters={forestCenters}
          stackPositionOf={stackPositionOf}
          stackCountOf={stackCountOf}
        />
      ) : null}
      {projectedClearings.map((clearing: ProjectedClearing) => {
        const diameter: number = clearing.radius * 2
        const isHighlighted: boolean = highlighted.has(clearing.clearingId)
        return (
          <button
            key={clearing.clearingId}
            type="button"
            className={
              isHighlighted
                ? CLICKABLE_CLEARING_CLASS_NAME
                : IDLE_CLEARING_CLASS_NAME
            }
            aria-label={`Clearing ${String(clearing.clearingId)}`}
            data-clearing-id={clearing.clearingId}
            tabIndex={isHighlighted ? 0 : -1}
            onClick={() => {
              if (!isHighlighted) {
                return
              }
              onClearingSelected?.(clearing.clearingId)
            }}
            style={{
              left: clearing.center.x - clearing.radius,
              top: clearing.center.y - clearing.radius,
              width: diameter,
              height: diameter,
            }}
          />
        )
      })}
    </div>
  )
}
