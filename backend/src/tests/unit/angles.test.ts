import { describe, it, expect } from 'vitest';
import {
  enuVectorToAzEl,
  azElToEnuVector,
  normalizeDegrees,
  normalizeDegrees180,
  angularDifferenceDeg,
  interpolateAzimuthDeg,
} from '../../utils/angles';

describe('angles utility tests', () => {
  it('converts pure North vector to 0° azimuth, 0° elevation', () => {
    const res = enuVectorToAzEl({ x: 0, y: 100, z: 0 });
    expect(res.azimuthDeg).toBeCloseTo(0.0, 5);
    expect(res.elevationDeg).toBeCloseTo(0.0, 5);
  });

  it('converts pure East vector to 90° azimuth, 0° elevation', () => {
    const res = enuVectorToAzEl({ x: 100, y: 0, z: 0 });
    expect(res.azimuthDeg).toBeCloseTo(90.0, 5);
    expect(res.elevationDeg).toBeCloseTo(0.0, 5);
  });

  it('converts pure South vector to 180° azimuth, 0° elevation', () => {
    const res = enuVectorToAzEl({ x: 0, y: -100, z: 0 });
    expect(res.azimuthDeg).toBeCloseTo(180.0, 5);
    expect(res.elevationDeg).toBeCloseTo(0.0, 5);
  });

  it('converts pure West vector to 270° azimuth, 0° elevation', () => {
    const res = enuVectorToAzEl({ x: -100, y: 0, z: 0 });
    expect(res.azimuthDeg).toBeCloseTo(270.0, 5);
    expect(res.elevationDeg).toBeCloseTo(0.0, 5);
  });

  it('handles positive and negative elevation above and below local horizontal', () => {
    // 45 degrees up towards North
    const upRes = enuVectorToAzEl({ x: 0, y: 10, z: 10 });
    expect(upRes.azimuthDeg).toBeCloseTo(0.0, 5);
    expect(upRes.elevationDeg).toBeCloseTo(45.0, 5);

    // 45 degrees down towards South
    const downRes = enuVectorToAzEl({ x: 0, y: -10, z: -10 });
    expect(downRes.azimuthDeg).toBeCloseTo(180.0, 5);
    expect(downRes.elevationDeg).toBeCloseTo(-45.0, 5);
  });

  it('handles zero horizontal distance edge cases (zenith and nadir)', () => {
    const zenith = enuVectorToAzEl({ x: 0, y: 0, z: 50 });
    expect(zenith.elevationDeg).toBeCloseTo(90.0, 5);

    const nadir = enuVectorToAzEl({ x: 0, y: 0, z: -50 });
    expect(nadir.elevationDeg).toBeCloseTo(-90.0, 5);

    const zero = enuVectorToAzEl({ x: 0, y: 0, z: 0 });
    expect(zero.elevationDeg).toBeCloseTo(0.0, 5);
  });

  it('normalizes degrees to [0, 360)', () => {
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(725)).toBe(5);
    expect(normalizeDegrees(-30)).toBe(330);
    expect(normalizeDegrees(-360)).toBe(0);
  });

  it('normalizes degrees to [-180, 180)', () => {
    expect(normalizeDegrees180(190)).toBe(-170);
    expect(normalizeDegrees180(350)).toBe(-10);
    expect(normalizeDegrees180(-190)).toBe(170);
  });

  it('calculates angular differences and circular interpolation correctly', () => {
    expect(angularDifferenceDeg(350, 10)).toBeCloseTo(20, 5);
    expect(angularDifferenceDeg(10, 350)).toBeCloseTo(-20, 5);

    // Midpoint between 350° and 10° is 0° / 360°
    expect(interpolateAzimuthDeg(350, 10, 0.5)).toBeCloseTo(0, 5);
  });

  it('roundtrips between az/el and unit vector', () => {
    const az = 135.5;
    const el = 12.3;
    const vec = azElToEnuVector(az, el);
    const converted = enuVectorToAzEl(vec);

    expect(converted.azimuthDeg).toBeCloseTo(az, 4);
    expect(converted.elevationDeg).toBeCloseTo(el, 4);
  });
});
