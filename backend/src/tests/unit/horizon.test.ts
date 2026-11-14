import { describe, it, expect } from 'vitest';
import { HorizonProfileService } from '../../services/terrain/horizon-profile.service';
import { SyntheticDemFixture } from '../../services/terrain/synthetic-dem.fixture';

describe('Terrain horizon profile and azimuth interpolation tests', () => {
  it('flat terrain with curvature produces expected negative or zero horizon angle', async () => {
    const flatDem = SyntheticDemFixture.createFlatDem(0.0);
    const result = await HorizonProfileService.calculateHorizonProfile(flatDem, {
      latitudeDeg: -89.5,
      longitudeDeg: 0.0,
      searchRadiusMeters: 1000.0,
      azimuthStepDeg: 45.0,
      radialStepMeters: 50.0,
      observerHeightMeters: 2.0,
      includeLunarCurvature: false,
    });

    expect(result.samples.length).toBe(8);
    // On a flat plane with 2m observer, all terrain is below observer eyes, so apparent angle is <= 0
    for (const sample of result.samples) {
      expect(sample.horizonElevationDeg).toBeLessThanOrEqual(0.0);
    }
  });

  it('synthetic ridge creates expected positive obstacle horizon angle', async () => {
    // 100m ridge at 500m distance at azimuth 90°
    // Apparent angle: atan2(100 - 2, 500) = atan2(98, 500) ~ 11.08°
    const ridgeDem = SyntheticDemFixture.createRidgeDem(0.0, 90.0, 500.0, 100.0, 40.0);

    const result = await HorizonProfileService.calculateHorizonProfile(ridgeDem, {
      latitudeDeg: -90.0, // exact south pole center (0, 0)
      longitudeDeg: 0.0,
      searchRadiusMeters: 1000.0,
      azimuthStepDeg: 15.0,
      radialStepMeters: 20.0,
      observerHeightMeters: 2.0,
      includeLunarCurvature: false,
    });

    const sampleAt90 = result.samples.find((s) => Math.abs(s.azimuthDeg - 90.0) < 1e-4);
    expect(sampleAt90).toBeDefined();
    expect(sampleAt90!.horizonElevationDeg).toBeGreaterThan(10.0);
    expect(sampleAt90!.horizonElevationDeg).toBeLessThan(12.0);
    expect(sampleAt90!.obstacleDistanceMeters).toBeCloseTo(500.0, -1);
  });

  it('interpolates horizon angle smoothly across 359° and 0° boundary', () => {
    const samples = [
      { azimuthDeg: 0, horizonElevationDeg: 5.0, obstacleDistanceMeters: 1000, obstacleElevationMeters: 50 },
      { azimuthDeg: 90, horizonElevationDeg: 2.0, obstacleDistanceMeters: 1000, obstacleElevationMeters: 20 },
      { azimuthDeg: 180, horizonElevationDeg: 4.0, obstacleDistanceMeters: 1000, obstacleElevationMeters: 40 },
      { azimuthDeg: 270, horizonElevationDeg: 1.0, obstacleDistanceMeters: 1000, obstacleElevationMeters: 10 },
      { azimuthDeg: 350, horizonElevationDeg: 3.0, obstacleDistanceMeters: 1000, obstacleElevationMeters: 30 },
    ];

    // Query exactly between 350° and 0° (e.g. 355°)
    const interpolated = HorizonProfileService.interpolateHorizonAtAzimuth(samples, 355.0);
    // 355 is halfway between 350 (val=3.0) and 0 (val=5.0), so expected ~ 4.0
    expect(interpolated).toBeCloseTo(4.0, 1);

    // Exact query on sample
    expect(HorizonProfileService.interpolateHorizonAtAzimuth(samples, 90.0)).toBeCloseTo(2.0, 5);
  });
});
