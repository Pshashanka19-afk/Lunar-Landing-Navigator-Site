import { describe, it, expect } from 'vitest';
import {
  createVector,
  magnitude,
  dot,
  cross,
  normalize,
  add,
  subtract,
  scale,
  clamp,
} from '../../utils/vectors';

describe('vector utilities tests', () => {
  it('computes magnitude and normalize', () => {
    const v = createVector(3, 4, 0);
    expect(magnitude(v)).toBe(5);

    const norm = normalize(v);
    expect(norm.x).toBeCloseTo(0.6, 5);
    expect(norm.y).toBeCloseTo(0.8, 5);
    expect(norm.z).toBeCloseTo(0, 5);
    expect(magnitude(norm)).toBeCloseTo(1, 5);
  });

  it('computes dot product', () => {
    const a = createVector(1, 2, 3);
    const b = createVector(4, -5, 6);
    expect(dot(a, b)).toBe(1 * 4 + 2 * -5 + 3 * 6); // 4 - 10 + 18 = 12
  });

  it('computes cross product', () => {
    const xUnit = createVector(1, 0, 0);
    const yUnit = createVector(0, 1, 0);
    const zUnit = cross(xUnit, yUnit);
    expect(zUnit).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('adds, subtracts, and scales vectors', () => {
    const a = createVector(1, 2, 3);
    const b = createVector(4, 5, 6);

    expect(add(a, b)).toEqual({ x: 5, y: 7, z: 9 });
    expect(subtract(a, b)).toEqual({ x: -3, y: -3, z: -3 });
    expect(scale(a, 2)).toEqual({ x: 2, y: 4, z: 6 });
  });

  it('clamps values correctly', () => {
    expect(clamp(1.5, -1, 1)).toBe(1);
    expect(clamp(-2.5, -1, 1)).toBe(-1);
    expect(clamp(0.5, -1, 1)).toBe(0.5);
  });
});
