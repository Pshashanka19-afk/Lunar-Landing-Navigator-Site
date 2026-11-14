import { describe, it, expect } from 'vitest';
import { TerrainVisibilityService } from '../../services/terrain/terrain-visibility.service';
import { SolarIncidenceService } from '../../services/illumination/solar-incidence.service';
import { HorizonSample } from '../../services/terrain/horizon-profile.service';

describe('Terrain visibility and illumination classification tests', () => {
  const horizonSamples: HorizonSample[] = [
    { azimuthDeg: 0, horizonElevationDeg: 7.0, obstacleDistanceMeters: 500, obstacleElevationMeters: 100 },
    { azimuthDeg: 90, horizonElevationDeg: 7.0, obstacleDistanceMeters: 500, obstacleElevationMeters: 100 },
    { azimuthDeg: 180, horizonElevationDeg: 7.0, obstacleDistanceMeters: 500, obstacleElevationMeters: 100 },
    { azimuthDeg: 270, horizonElevationDeg: 7.0, obstacleDistanceMeters: 500, obstacleElevationMeters: 100 },
  ];

  it('classifies Sun elevation of 5° with terrain horizon 7° as CENTER_BLOCKED', () => {
    const res = TerrainVisibilityService.evaluateTargetVisibility(
      45.0, // azimuth
      5.0,  // target elevation
      horizonSamples,
      0.1   // tolerance
    );

    expect(res.status).toBe('CENTER_BLOCKED');
    expect(res.isGeometricallyVisible).toBe(false);
    expect(res.clearanceDeg).toBeCloseTo(-2.0, 4);
    expect(res.horizonElevationDeg).toBeCloseTo(7.0, 4);
  });

  it('classifies Sun elevation of 9° with terrain horizon 7° as CENTER_CLEAR', () => {
    const res = TerrainVisibilityService.evaluateTargetVisibility(
      45.0, // azimuth
      9.0,  // target elevation
      horizonSamples,
      0.1   // tolerance
    );

    expect(res.status).toBe('CENTER_CLEAR');
    expect(res.isGeometricallyVisible).toBe(true);
    expect(res.clearanceDeg).toBeCloseTo(2.0, 4);
  });

  it('classifies target elevation within tolerance of horizon as BOUNDARY_CASE', () => {
    const res = TerrainVisibilityService.evaluateTargetVisibility(
      45.0,
      7.05, // 0.05 deg above horizon, tolerance is 0.1
      horizonSamples,
      0.1
    );

    expect(res.status).toBe('BOUNDARY_CASE');
    expect(res.isGeometricallyVisible).toBe(true); // >= 0
  });

  it('tests surface-facing status independently from terrain clearance', () => {
    // Normal facing vertical Up (0, 0, 1)
    const normalUp = { x: 0, y: 0, z: 1 };
    // Sun at elevation +10 degrees (above horizon)
    const sunAbove = SolarIncidenceService.calculateSolarIncidence(normalUp, 90.0, 10.0);
    expect(sunAbove.isFacingSun).toBe(true);
    expect(sunAbove.incidenceAngleDeg).toBeCloseTo(80.0, 4);

    // Sun at elevation -10 degrees (below local horizontal)
    const sunBelow = SolarIncidenceService.calculateSolarIncidence(normalUp, 90.0, -10.0);
    expect(sunBelow.isFacingSun).toBe(false);
    expect(sunBelow.incidenceAngleDeg).toBeCloseTo(100.0, 4);
  });
});
