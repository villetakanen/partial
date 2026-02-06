/** Parameters for the D3 force simulation, scaled by graph size. */
export interface SimParams {
  linkDistance: number
  chargeStrength: number
  collisionRadius: number
  alphaDecay: number
}

/**
 * Compute D3 force simulation parameters that scale with graph size.
 *
 * - **Small** (<20 nodes): tight defaults for compact graphs.
 * - **Medium** (20–50 nodes): increased spacing to avoid label overlap.
 * - **Large** (50+ nodes): wide spacing with faster convergence.
 */
export function getSimParams(nodeCount: number): SimParams {
  if (nodeCount >= 50) {
    return {
      linkDistance: 180,
      chargeStrength: -600,
      collisionRadius: 60,
      alphaDecay: 0.03,
    }
  }

  if (nodeCount >= 20) {
    return {
      linkDistance: 140,
      chargeStrength: -450,
      collisionRadius: 50,
      alphaDecay: 0.02,
    }
  }

  return {
    linkDistance: 100,
    chargeStrength: -300,
    collisionRadius: 40,
    alphaDecay: 0.02,
  }
}
