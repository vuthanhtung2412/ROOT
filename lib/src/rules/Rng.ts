export type RngState = {
  seed: number
  cursor: number
}

export interface Rng {
  /** Root die face 0–3 (battle dice; also entropy for shuffle). */
  roll(): number
  toJSON(): RngState
}

function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s += 0x6d2b79f5
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class SeededRng implements Rng {
  private state: RngState

  constructor(state: RngState) {
    this.state = { seed: state.seed, cursor: state.cursor }
  }

  roll(): number {
    // Rule: Battle 4.3.2 — Root dice faces are 0, 1, 2, 3.
    const rand = mulberry32(this.state.seed + this.state.cursor * 0x9e3779b9)
    this.state.cursor++
    return Math.floor(rand() * 4)
  }

  toJSON(): RngState {
    return { seed: this.state.seed, cursor: this.state.cursor }
  }

  static fromJSON(state: RngState): SeededRng {
    return new SeededRng(state)
  }
}

/**
 * Uniform index in [0, max) built from Root dice (0–3) via rejection sampling.
 */
export function randomIndex(rng: Rng, max: number): number {
  if (max <= 1) {
    return 0
  }
  for (;;) {
    let value = 0
    let range = 1
    while (range < max) {
      value = value * 4 + rng.roll()
      range *= 4
    }
    const acceptable = Math.floor(range / max) * max
    if (value < acceptable) {
      return value % max
    }
  }
}
