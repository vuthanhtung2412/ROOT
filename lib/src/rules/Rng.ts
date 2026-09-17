export type RngState = {
  seed: number
  cursor: number
}

export interface Rng {
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
    const rand = mulberry32(this.state.seed + this.state.cursor * 0x9e3779b9)
    this.state.cursor++
    return Math.floor(rand() * 6) + 1
  }

  toJSON(): RngState {
    return { seed: this.state.seed, cursor: this.state.cursor }
  }

  static fromJSON(state: RngState): SeededRng {
    return new SeededRng(state)
  }
}
