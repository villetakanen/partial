import { describe, expect, it } from 'vitest'
import { getSimParams } from '../../src/renderer/views/graphSimParams'

describe('getSimParams', () => {
  it('returns small-graph defaults for 0 nodes', () => {
    const params = getSimParams(0)
    expect(params.linkDistance).toBe(100)
    expect(params.chargeStrength).toBe(-300)
    expect(params.collisionRadius).toBe(40)
    expect(params.alphaDecay).toBe(0.02)
  })

  it('returns small-graph defaults for < 20 nodes', () => {
    const params = getSimParams(19)
    expect(params.linkDistance).toBe(100)
    expect(params.chargeStrength).toBe(-300)
    expect(params.collisionRadius).toBe(40)
    expect(params.alphaDecay).toBe(0.02)
  })

  it('returns medium-graph params at 20 nodes', () => {
    const params = getSimParams(20)
    expect(params.linkDistance).toBe(140)
    expect(params.chargeStrength).toBe(-450)
    expect(params.collisionRadius).toBe(50)
    expect(params.alphaDecay).toBe(0.02)
  })

  it('returns medium-graph params for 49 nodes', () => {
    const params = getSimParams(49)
    expect(params.linkDistance).toBe(140)
    expect(params.chargeStrength).toBe(-450)
    expect(params.collisionRadius).toBe(50)
    expect(params.alphaDecay).toBe(0.02)
  })

  it('returns large-graph params at 50 nodes', () => {
    const params = getSimParams(50)
    expect(params.linkDistance).toBe(180)
    expect(params.chargeStrength).toBe(-600)
    expect(params.collisionRadius).toBe(60)
    expect(params.alphaDecay).toBe(0.03)
  })

  it('returns large-graph params for 100 nodes', () => {
    const params = getSimParams(100)
    expect(params.linkDistance).toBe(180)
    expect(params.chargeStrength).toBe(-600)
    expect(params.collisionRadius).toBe(60)
    expect(params.alphaDecay).toBe(0.03)
  })

  it('increases spacing as node count grows', () => {
    const small = getSimParams(10)
    const medium = getSimParams(30)
    const large = getSimParams(60)

    expect(medium.linkDistance).toBeGreaterThan(small.linkDistance)
    expect(large.linkDistance).toBeGreaterThan(medium.linkDistance)

    expect(medium.chargeStrength).toBeLessThan(small.chargeStrength)
    expect(large.chargeStrength).toBeLessThan(medium.chargeStrength)
  })
})
