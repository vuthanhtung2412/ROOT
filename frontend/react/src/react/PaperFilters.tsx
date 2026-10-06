import type { JSX } from 'react'

/** Filter ids referenced by the `root-paper` utilities in `style.css`. */
const TORN_EDGE_FILTER_ID = 'root-torn-edge'
const TORN_EDGE_FINE_FILTER_ID = 'root-torn-edge-fine'

type TornEdge = {
  filterId: string
  /** Lower = longer waves along the edge. */
  noiseFrequency: number
  noiseOctaves: number
  noiseSeed: number
  /** How far the edge is pushed, in pixels. */
  displacementScale: number
}

const TORN_EDGES: readonly TornEdge[] = [
  {
    filterId: TORN_EDGE_FILTER_ID,
    noiseFrequency: 0.03,
    noiseOctaves: 3,
    noiseSeed: 4,
    displacementScale: 8,
  },
  {
    filterId: TORN_EDGE_FINE_FILTER_ID,
    noiseFrequency: 0.06,
    noiseOctaves: 2,
    noiseSeed: 9,
    displacementScale: 4,
  },
]

/** Room around the element so the displaced edge is not clipped. */
const FILTER_REGION_OFFSET = '-10%'
const FILTER_REGION_SIZE = '120%'

/** SVG filters that tear the edge of every `root-paper` element. */
export function PaperFilters(): JSX.Element {
  return (
    <svg className="pointer-events-none absolute size-0" aria-hidden="true">
      {TORN_EDGES.map((edge: TornEdge) => (
        <filter
          key={edge.filterId}
          id={edge.filterId}
          x={FILTER_REGION_OFFSET}
          y={FILTER_REGION_OFFSET}
          width={FILTER_REGION_SIZE}
          height={FILTER_REGION_SIZE}
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency={edge.noiseFrequency}
            numOctaves={edge.noiseOctaves}
            seed={edge.noiseSeed}
          />
          <feDisplacementMap in="SourceGraphic" scale={edge.displacementScale} />
        </filter>
      ))}
    </svg>
  )
}
