import { describe, it, expect } from 'vitest';
import { SurfaceNormalService } from '../../services/terrain/surface-normal.service';
import { SyntheticDemFixture } from '../../services/terrain/synthetic-dem.fixture';

describe('Surface normal, slope, and aspect tests', () => {
  it('flat terrain yields a vertical upward normal (0, 0, 1), 0° slope, isFlat: true', async () => {
    const flatDem = SyntheticDemFixture.createFlatDem(100.0);
    const result = await SurfaceNormalService.analyzeSurface(flatDem, {
      latitudeDeg: -89.0,
      longitudeDeg: 0.0,
    });

    expect(result.elevationMeters).toBe(100.0);
    expect(result.surfaceNormalEnu.x).toBeCloseTo(0, 5);
    expect(result.surfaceNormalEnu.y).toBeCloseTo(0, 5);
    expect(result.surfaceNormalEnu.z).toBeCloseTo(1, 5);
    expect(result.slopeDeg).toBeCloseTo(0, 5);
    expect(result.isFlat).toBe(true);
  });

  it('known eastward gradient produces expected normal and downhill aspect', async () => {
    // p = dz/dx = 0.1 (rises to the East), q = dz/dy = 0
    // Expected normal = (-0.1, 0, 1) / sqrt(1 + 0.01)
    const p = 0.1;
    const tiltedDem = SyntheticDemFixture.createTiltedDem(0.0, p, 0.0);

    const result = await SurfaceNormalService.analyzeSurface(tiltedDem, {
      latitudeDeg: -89.0,
      longitudeDeg: 0.0,
    });

    const expectedNormalZ = 1.0 / Math.sqrt(p * p + 1.0);
    const expectedNormalX = -p / Math.sqrt(p * p + 1.0);
    const expectedSlopeDeg = (Math.atan(p) * 180.0) / Math.PI;

    expect(result.surfaceNormalEnu.x).toBeCloseTo(expectedNormalX, 4);
    expect(result.surfaceNormalEnu.y).toBeCloseTo(0.0, 4);
    expect(result.surfaceNormalEnu.z).toBeCloseTo(expectedNormalZ, 4);
    expect(result.slopeDeg).toBeCloseTo(expectedSlopeDeg, 4);

    // Downhill is towards West (270°) since terrain rises to the East
    expect(result.aspectDeg).toBeCloseTo(270.0, 2);
  });

  it('known southward drop produces downhill aspect of 180°', async () => {
    // Terrain drops towards South: q = dz/dy = +0.2 (higher towards North, lower towards South)
    // Downhill is South (180°)
    const tiltedDem = SyntheticDemFixture.createTiltedDem(0.0, 0.0, 0.2);

    const result = await SurfaceNormalService.analyzeSurface(tiltedDem, {
      latitudeDeg: -89.0,
      longitudeDeg: 0.0,
    });

    expect(result.aspectDeg).toBeCloseTo(180.0, 2);
  });

  it('works with local plane fit derivative method', async () => {
    const tiltedDem = SyntheticDemFixture.createTiltedDem(50.0, 0.05, 0.05);

    const result = await SurfaceNormalService.analyzeSurface(tiltedDem, {
      latitudeDeg: -89.0,
      longitudeDeg: 0.0,
      derivativeMethod: 'LOCAL_PLANE_FIT',
    });

    expect(result.derivativeMethod).toBe('LOCAL_PLANE_FIT');
    expect(result.slopeDeg).toBeGreaterThan(0);
    expect(result.surfaceNormalEnu.z).toBeGreaterThan(0.9);
  });
});
