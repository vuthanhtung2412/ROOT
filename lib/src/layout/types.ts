export type Point = {
  x: number
  y: number
}

export type ClearingLayout = Point & {
  r: number
}

export type MapLayout = {
  image: string
  clearings: Record<number, ClearingLayout>
}
